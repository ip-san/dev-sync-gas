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
import { shouldExcludeByLabels } from '../../../utils/labelFilter.js';
import { getExcludeMetricsLabels } from '../../../config/settings.js';

// =============================================================================
// PR一覧取得
// =============================================================================

/**
 * Pull Requests取得のパラメータ
 */
export interface GetPullRequestsGraphQLParams {
  repo: GitHubRepository;
  token: string;
  state?: 'open' | 'closed' | 'all';
  dateRange?: DateRange;
  maxPages?: number;
}

/**
 * PR状態をGraphQL形式のstatesに変換
 */
function convertPRStateToGraphQLStates(state: 'open' | 'closed' | 'all'): string[] {
  if (state === 'all') {
    return ['MERGED', 'OPEN', 'CLOSED'];
  }
  if (state === 'open') {
    return ['OPEN'];
  }
  return ['MERGED', 'CLOSED'];
}

/**
 * GraphQL Pull Requests Query用の変数を構築
 */
function buildPullRequestsQueryVariables(
  repo: GitHubRepository,
  cursor: string | null,
  states: string[]
): Record<string, unknown> {
  return {
    owner: repo.owner,
    name: repo.name,
    first: DEFAULT_PAGE_SIZE,
    after: cursor,
    states,
  };
}

/**
 * 日付範囲と除外ラベルでPRをフィルタリング
 */
function filterPRsByDateRange(
  prs: GraphQLPullRequest[],
  dateRange: DateRange | undefined,
  repository: string
): GitHubPullRequest[] {
  const filtered: GitHubPullRequest[] = [];
  const excludeLabels = getExcludeMetricsLabels();
  let excludedCount = 0;

  for (const pr of prs) {
    const createdAt = new Date(pr.createdAt);

    if (!isWithinPRDateRange(createdAt, dateRange)) {
      continue;
    }

    const prLabels = pr.labels.nodes.map((l) => l.name);
    if (shouldExcludeByLabels(prLabels, excludeLabels)) {
      excludedCount++;
      continue;
    }

    filtered.push(convertToPullRequest(pr, repository));
  }

  if (excludedCount > 0) {
    const { logger } = getContainer();
    logger.log(`  ℹ️ Excluded ${excludedCount} PRs by labels`);
  }

  return filtered;
}

/**
 * リポジトリのPR一覧を取得（GraphQL版）
 *
 * REST APIとの違い:
 * - additions, deletions, changedFilesも同時に取得可能
 * - ブランチ情報（baseRefName, headRefName）も取得
 */
export function getPullRequestsGraphQL(
  params: GetPullRequestsGraphQLParams
): ApiResponse<GitHubPullRequest[]> {
  const { repo, token, state = 'all', dateRange, maxPages = 5 } = params;
  const { logger } = getContainer();
  const allPRs: GitHubPullRequest[] = [];
  let cursor: string | null = null;
  let page = 0;

  const states = convertPRStateToGraphQLStates(state);

  while (page < maxPages) {
    const variables = buildPullRequestsQueryVariables(repo, cursor, states);
    const queryResult: ApiResponse<PullRequestsQueryResponse> =
      executeGraphQLWithRetry<PullRequestsQueryResponse>(PULL_REQUESTS_QUERY, variables, token);

    const validationError = validatePaginatedResponse(queryResult, page, 'repository.pullRequests');
    if (validationError) {
      return validationError;
    }
    if (!queryResult.success) {
      break;
    }

    const prsData = queryResult.data!.repository!.pullRequests;
    const filteredPRs = filterPRsByDateRange(prsData.nodes, dateRange, repo.fullName);
    allPRs.push(...filteredPRs);

    if (!prsData.pageInfo.hasNextPage) {
      break;
    }
    cursor = prsData.pageInfo.endCursor;
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
 * PR手戻りデータ処理のパラメータ
 */
interface ProcessBatchReworkDataParams {
  batch: GitHubPullRequest[];
  owner: string;
  repo: string;
  token: string;
  logger: { log: (msg: string) => void };
}

/**
 * 1バッチ分のPR手戻りデータを処理
 */
function processBatchReworkData(params: ProcessBatchReworkDataParams): PRReworkData[] {
  const { batch, owner, repo, token, logger } = params;
  const reworkData: PRReworkData[] = [];
  const prNumbers = batch.map((pr) => pr.number);

  const query = buildBatchPRDetailQuery(prNumbers);
  const result = executeGraphQLWithRetry<{
    repository: Record<string, GraphQLPullRequestDetail | null>;
  }>(query, { owner, name: repo }, token);

  if (!result.success || !result.data?.repository) {
    logger.log(`  ⚠️ Failed to fetch batch PR details: ${result.error}`);
    // フォールバック: 空データを追加
    return batch.map((pr) => createDefaultReworkData(pr));
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

  return reworkData;
}

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
      const batchResults = processBatchReworkData({ batch, owner, repo, token, logger });
      reworkData.push(...batchResults);
    }
  }

  return reworkData;
}

// =============================================================================
// PRサイズデータ取得
// =============================================================================

/**
 * PRサイズデータ処理のパラメータ
 */
interface ProcessBatchSizeDataParams {
  batch: GitHubPullRequest[];
  owner: string;
  repo: string;
  repoFullName: string;
  token: string;
  logger: { log: (msg: string) => void };
}

/**
 * バッチPRサイズ取得用のGraphQLクエリを構築
 */
function buildBatchPRSizeQuery(prNumbers: number[]): string {
  return `
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
}

/**
 * 1バッチ分のPRサイズデータを処理
 */
function processBatchSizeData(params: ProcessBatchSizeDataParams): PRSizeData[] {
  const { batch, owner, repo, repoFullName, token, logger } = params;
  const sizeData: PRSizeData[] = [];
  const prNumbers = batch.map((pr) => pr.number);

  const query = buildBatchPRSizeQuery(prNumbers);
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
    return [];
  }

  for (let j = 0; j < batch.length; j++) {
    const prData = result.data.repository[`pr${j}`];

    if (!prData) {
      continue;
    }

    sizeData.push(calculatePRSizeData(prData, repoFullName));
  }

  return sizeData;
}

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
      const batchResults = processBatchSizeData({
        batch,
        owner,
        repo,
        repoFullName,
        token,
        logger,
      });
      sizeData.push(...batchResults);
    }
  }

  return sizeData;
}

// =============================================================================
// レビュー効率データ取得（バッチ処理）
// =============================================================================

/**
 * PRレビューデータ処理のパラメータ
 */
interface ProcessBatchReviewDataParams {
  batch: GitHubPullRequest[];
  owner: string;
  repo: string;
  repoFullName: string;
  token: string;
  logger: { log: (msg: string) => void };
}

/**
 * 1バッチ分のPRレビュー効率データを処理
 */
function processBatchReviewData(params: ProcessBatchReviewDataParams): PRReviewData[] {
  const { batch, owner, repo, repoFullName, token, logger } = params;
  const reviewData: PRReviewData[] = [];
  const prNumbers = batch.map((pr) => pr.number);

  const query = buildBatchPRDetailQuery(prNumbers);
  const result = executeGraphQLWithRetry<{
    repository: Record<string, GraphQLPullRequestDetail | null>;
  }>(query, { owner, name: repo }, token);

  if (!result.success || !result.data?.repository) {
    logger.log(`  ⚠️ Failed to fetch batch PR reviews: ${result.error}`);
    return [];
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

  return reviewData;
}

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
      const batchResults = processBatchReviewData({
        batch,
        owner,
        repo,
        repoFullName,
        token,
        logger,
      });
      reviewData.push(...batchResults);
    }
  }

  return reviewData;
}
