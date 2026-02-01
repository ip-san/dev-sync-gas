/**
 * GitHub GraphQL API - Pull Request 操作
 *
 * REST APIからの移行:
 * - getPullRequests: 100件取得に1リクエスト → 同じ（ただしサイズ情報も含む）
 * - getPRDetails: 各PRに1リクエスト → バッチ取得で大幅削減
 * - getReworkDataForPRs: PR数×3リクエスト → バッチ取得で削減
 * - getReviewEfficiencyDataForPRs: PR数×3リクエスト → バッチ取得で削減
 */

import type {
  GitHubPullRequest,
  GitHubRepository,
  ApiResponse,
  PRReworkData,
  PRReviewData,
  PRSizeData,
} from '../../../types';
import { getContainer } from '../../../container';
import { executeGraphQLWithRetry, DEFAULT_PAGE_SIZE } from './client';
import { PULL_REQUESTS_QUERY, PULL_REQUEST_DETAIL_QUERY, buildBatchPRDetailQuery } from './queries';
import { isWithinPRDateRange } from './issueHelpers.js';
import { validatePaginatedResponse, validateSingleResponse } from './errorHelpers.js';
import type {
  PullRequestsQueryResponse,
  PullRequestDetailQueryResponse,
  GraphQLPullRequest,
  GraphQLPullRequestDetail,
} from './types';
import type { DateRange } from '../api';
import { DEFAULT_BATCH_SIZE } from '../../../config/apiConfig';
import { calculateReviewDataForPR, createDefaultReviewData } from './reviewEfficiencyHelpers.js';
import { calculateReworkDataForPR, createDefaultReworkData } from './reworkHelpers.js';
import { calculatePRSizeData } from './prSizeHelpers.js';
import { groupPRsByRepository, parseRepository } from './batchProcessing.js';
import { parseGraphQLNodeIdOrZero } from '../../../utils/graphqlParser';

// =============================================================================
// PR一覧取得
// =============================================================================

/**
 * リポジトリのPR一覧を取得（GraphQL版）
 *
 * REST APIとの違い:
 * - additions, deletions, changedFilesも同時に取得可能
 * - ブランチ情報（baseRefName, headRefName）も取得
 */
export function getPullRequestsGraphQL(
  repo: GitHubRepository,
  token: string,
  state: 'open' | 'closed' | 'all' = 'all',
  dateRange?: DateRange,
  maxPages: number = 5
): ApiResponse<GitHubPullRequest[]> {
  const { logger } = getContainer();
  const allPRs: GitHubPullRequest[] = [];
  let cursor: string | null = null;
  let page = 0;

  // GraphQL用のstate変換
  const states =
    state === 'all'
      ? ['MERGED', 'OPEN', 'CLOSED']
      : state === 'open'
        ? ['OPEN']
        : ['MERGED', 'CLOSED'];

  while (page < maxPages) {
    const queryResult: ApiResponse<PullRequestsQueryResponse> =
      executeGraphQLWithRetry<PullRequestsQueryResponse>(
        PULL_REQUESTS_QUERY,
        {
          owner: repo.owner,
          name: repo.name,
          first: DEFAULT_PAGE_SIZE,
          after: cursor,
          states,
        },
        token
      );

    const validationError = validatePaginatedResponse(queryResult, page, 'repository.pullRequests');
    if (validationError) {
      return validationError;
    }
    if (!queryResult.success) {
      break; // 2ページ目以降のエラー
    }

    const prsData = queryResult.data!.repository!.pullRequests;
    const nodes: GraphQLPullRequest[] = prsData.nodes;
    const pageInfo = prsData.pageInfo;

    for (const pr of nodes) {
      // 期間フィルタリング（Early Return）
      const createdAt = new Date(pr.createdAt);
      if (!isWithinPRDateRange(createdAt, dateRange)) {
        continue;
      }

      allPRs.push(convertToPullRequest(pr, repo.fullName));
    }

    if (!pageInfo.hasNextPage) {
      break;
    }
    cursor = pageInfo.endCursor;
    page++;
  }

  logger.log(`  📦 Fetched ${allPRs.length} PRs via GraphQL`);
  return { success: true, data: allPRs };
}

/**
 * GraphQL PRノードを内部型に変換
 */
function convertToPullRequest(pr: GraphQLPullRequest, repository: string): GitHubPullRequest {
  // GraphQLのstateはOPEN/MERGED/CLOSEDだが、GitHubPullRequestの型は"open"|"closed"
  // MERGEDはclosedとして扱う（REST APIとの互換性維持）
  const state: 'open' | 'closed' = pr.state === 'OPEN' ? 'open' : 'closed';
  return {
    id: parseGraphQLNodeIdOrZero(pr.id),
    number: pr.number,
    title: pr.title,
    state,
    createdAt: pr.createdAt,
    mergedAt: pr.mergedAt,
    closedAt: pr.closedAt,
    author: pr.author?.login ?? 'unknown',
    repository,
    baseBranch: pr.baseRefName,
    headBranch: pr.headRefName,
    mergeCommitSha: pr.mergeCommit?.oid,
  };
}

// =============================================================================
// PR詳細取得
// =============================================================================

/**
 * PR詳細を取得（GraphQL版）
 */
export function getPRDetailsGraphQL(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<{
  additions: number;
  deletions: number;
  changedFiles: number;
}> {
  const result = executeGraphQLWithRetry<PullRequestDetailQueryResponse>(
    PULL_REQUEST_DETAIL_QUERY,
    {
      owner,
      name: repo,
      number: prNumber,
    },
    token
  );

  const validationError = validateSingleResponse(result, 'repository.pullRequest');
  if (validationError) {
    return validationError;
  }

  const pr = result.data!.repository!.pullRequest!;
  return {
    success: true,
    data: {
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
    },
  };
}

/**
 * PRのブランチ情報を含む詳細を取得（GraphQL版）
 */
export function getPullRequestWithBranchesGraphQL(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<GitHubPullRequest> {
  const result = executeGraphQLWithRetry<PullRequestDetailQueryResponse>(
    PULL_REQUEST_DETAIL_QUERY,
    {
      owner,
      name: repo,
      number: prNumber,
    },
    token
  );

  const validationError = validateSingleResponse(result, 'repository.pullRequest');
  if (validationError) {
    return validationError;
  }

  const pr = result.data!.repository!.pullRequest!;
  return {
    success: true,
    data: convertToPullRequest(pr, `${owner}/${repo}`),
  };
}

// =============================================================================
// 手戻りデータ取得（バッチ処理）
// =============================================================================

/**
 * 複数PRの手戻りデータを一括取得（GraphQL版）
 *
 * REST APIでは PR数 × 3 リクエスト必要だったものを
 * ceil(PR数 / 10) リクエストに削減。
 */
export function getReworkDataForPRsGraphQL(
  pullRequests: GitHubPullRequest[],
  token: string
): PRReworkData[] {
  const { logger } = getContainer();
  const reworkData: PRReworkData[] = [];

  // リポジトリごとにグループ化
  const prsByRepo = groupPRsByRepository(pullRequests);

  for (const [repoFullName, prs] of prsByRepo) {
    const parsed = parseRepository(repoFullName);
    if (!parsed) {
      continue;
    }
    const { owner, repo } = parsed;

    // バッチ処理（設定可能なバッチサイズ）
    for (let i = 0; i < prs.length; i += DEFAULT_BATCH_SIZE) {
      const batch = prs.slice(i, i + DEFAULT_BATCH_SIZE);
      const prNumbers = batch.map((pr) => pr.number);

      const query = buildBatchPRDetailQuery(prNumbers);
      const result = executeGraphQLWithRetry<{
        repository: Record<string, GraphQLPullRequestDetail | null>;
      }>(query, { owner, name: repo }, token);

      if (!result.success || !result.data?.repository) {
        logger.log(`  ⚠️ Failed to fetch batch PR details: ${result.error}`);
        // フォールバック: 空データを追加
        for (const pr of batch) {
          reworkData.push(createDefaultReworkData(pr));
        }
        continue;
      }

      // 各PRのデータを処理
      for (let j = 0; j < batch.length; j++) {
        const pr = batch[j];
        const prData = result.data.repository[`pr${j}`];

        if (!prData) {
          reworkData.push(createDefaultReworkData(pr));
          continue;
        }

        reworkData.push(calculateReworkDataForPR(prData, pr));
      }
    }
  }

  return reworkData;
}

// =============================================================================
// PRサイズデータ取得
// =============================================================================

/**
 * 複数PRのサイズデータを取得（GraphQL版）
 *
 * getPullRequestsGraphQLでサイズ情報も取得済みの場合は
 * 追加リクエスト不要。
 */
export function getPRSizeDataForPRsGraphQL(
  pullRequests: GitHubPullRequest[],
  token: string
): PRSizeData[] {
  const { logger } = getContainer();
  const sizeData: PRSizeData[] = [];

  // リポジトリごとにグループ化
  const prsByRepo = groupPRsByRepository(pullRequests);

  for (const [repoFullName, prs] of prsByRepo) {
    const parsed = parseRepository(repoFullName);
    if (!parsed) {
      continue;
    }
    const { owner, repo } = parsed;

    // バッチ処理（設定可能なバッチサイズ）
    for (let i = 0; i < prs.length; i += DEFAULT_BATCH_SIZE) {
      const batch = prs.slice(i, i + DEFAULT_BATCH_SIZE);
      const prNumbers = batch.map((pr) => pr.number);

      // サイズ情報取得用の簡易クエリ
      const query = `
        query GetBatchPRSize($owner: String!, $name: String!) {
          repository(owner: $owner, name: $name) {
            ${prNumbers
              .map(
                (num, idx) => `
              pr${idx}: pullRequest(number: ${num}) {
                number
                title
                createdAt
                mergedAt
                additions
                deletions
                changedFiles
              }
            `
              )
              .join('\n')}
          }
        }
      `;

      const result = executeGraphQLWithRetry<{
        repository: Record<
          string,
          {
            number: number;
            title: string;
            createdAt: string;
            mergedAt: string | null;
            additions: number;
            deletions: number;
            changedFiles: number;
          } | null
        >;
      }>(query, { owner, name: repo }, token);

      if (!result.success || !result.data?.repository) {
        logger.log(`  ⚠️ Failed to fetch batch PR size: ${result.error}`);
        continue;
      }

      for (let j = 0; j < batch.length; j++) {
        const prData = result.data.repository[`pr${j}`];

        if (!prData) {
          continue;
        }

        sizeData.push(calculatePRSizeData(prData, repoFullName));
      }
    }
  }

  return sizeData;
}

// =============================================================================
// レビュー効率データ取得（バッチ処理）
// =============================================================================

/**
 * 複数PRのレビュー効率データを一括取得（GraphQL版）
 *
 * REST APIでは PR数 × 3 リクエスト必要だったものを
 * ceil(PR数 / 10) リクエストに削減。
 */
export function getReviewEfficiencyDataForPRsGraphQL(
  pullRequests: GitHubPullRequest[],
  token: string
): PRReviewData[] {
  const { logger } = getContainer();
  const reviewData: PRReviewData[] = [];

  // リポジトリごとにグループ化
  const prsByRepo = groupPRsByRepository(pullRequests);

  for (const [repoFullName, prs] of prsByRepo) {
    const parsed = parseRepository(repoFullName);
    if (!parsed) {
      continue;
    }
    const { owner, repo } = parsed;

    // バッチ処理（設定可能なバッチサイズ）
    for (let i = 0; i < prs.length; i += DEFAULT_BATCH_SIZE) {
      const batch = prs.slice(i, i + DEFAULT_BATCH_SIZE);
      const prNumbers = batch.map((pr) => pr.number);

      const query = buildBatchPRDetailQuery(prNumbers);
      const result = executeGraphQLWithRetry<{
        repository: Record<string, GraphQLPullRequestDetail | null>;
      }>(query, { owner, name: repo }, token);

      if (!result.success || !result.data?.repository) {
        logger.log(`  ⚠️ Failed to fetch batch PR reviews: ${result.error}`);
        continue;
      }

      for (let j = 0; j < batch.length; j++) {
        const pr = batch[j];
        const prData = result.data.repository[`pr${j}`];

        if (!prData) {
          reviewData.push(createDefaultReviewData(pr));
          continue;
        }

        reviewData.push(calculateReviewDataForPR(prData, repoFullName));
      }
    }
  }

  return reviewData;
}
