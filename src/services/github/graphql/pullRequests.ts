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
import type {
  PullRequestsQueryResponse,
  PullRequestDetailQueryResponse,
  GraphQLPullRequest,
  GraphQLPullRequestDetail,
} from './types';
import type { DateRange } from '../api';

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

    if (!queryResult.success || !queryResult.data?.repository?.pullRequests) {
      if (page === 0) {
        return { success: false, error: queryResult.error };
      }
      break;
    }

    const prsData = queryResult.data.repository.pullRequests;
    const nodes: GraphQLPullRequest[] = prsData.nodes;
    const pageInfo = prsData.pageInfo;

    for (const pr of nodes) {
      const createdAt = new Date(pr.createdAt);

      // 期間フィルタリング
      if (dateRange?.until && createdAt > dateRange.until) {
        continue;
      }
      if (dateRange?.since && createdAt < dateRange.since) {
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
    id: parseInt(pr.id.replace(/\D/g, ''), 10) || 0,
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

  if (!result.success || !result.data?.repository?.pullRequest) {
    return { success: false, error: result.error };
  }

  const pr = result.data.repository.pullRequest;
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

  if (!result.success || !result.data?.repository?.pullRequest) {
    return { success: false, error: result.error };
  }

  const pr = result.data.repository.pullRequest;
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
  const prsByRepo = new Map<string, GitHubPullRequest[]>();
  for (const pr of pullRequests) {
    const existing = prsByRepo.get(pr.repository) ?? [];
    existing.push(pr);
    prsByRepo.set(pr.repository, existing);
  }

  for (const [repoFullName, prs] of prsByRepo) {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      continue;
    }

    // 10件ずつバッチ処理
    const batchSize = 10;
    for (let i = 0; i < prs.length; i += batchSize) {
      const batch = prs.slice(i, i + batchSize);
      const prNumbers = batch.map((pr) => pr.number);

      const query = buildBatchPRDetailQuery(prNumbers);
      const result = executeGraphQLWithRetry<{
        repository: Record<string, GraphQLPullRequestDetail | null>;
      }>(query, { owner, name: repo }, token);

      if (!result.success || !result.data?.repository) {
        logger.log(`  ⚠️ Failed to fetch batch PR details: ${result.error}`);
        // フォールバック: 空データを追加
        for (const pr of batch) {
          reworkData.push({
            prNumber: pr.number,
            title: pr.title,
            repository: pr.repository,
            createdAt: pr.createdAt,
            mergedAt: pr.mergedAt,
            additionalCommits: 0,
            forcePushCount: 0,
            totalCommits: 0,
          });
        }
        continue;
      }

      // 各PRのデータを処理
      for (let j = 0; j < batch.length; j++) {
        const pr = batch[j];
        const prData = result.data.repository[`pr${j}`];

        if (!prData) {
          reworkData.push({
            prNumber: pr.number,
            title: pr.title,
            repository: pr.repository,
            createdAt: pr.createdAt,
            mergedAt: pr.mergedAt,
            additionalCommits: 0,
            forcePushCount: 0,
            totalCommits: 0,
          });
          continue;
        }

        const prCreatedAt = new Date(pr.createdAt);
        const commits = prData.commits?.nodes ?? [];
        const timeline = prData.timelineItems?.nodes ?? [];

        // 追加コミット数を計算
        let additionalCommits = 0;
        for (const commitNode of commits) {
          const commitDate = new Date(commitNode.commit.committedDate);
          if (commitDate > prCreatedAt) {
            additionalCommits++;
          }
        }

        // Force Push回数を計算
        const forcePushCount = timeline.filter(
          (event) => event.__typename === 'HeadRefForcePushedEvent'
        ).length;

        reworkData.push({
          prNumber: pr.number,
          title: prData.title,
          repository: pr.repository,
          createdAt: prData.createdAt,
          mergedAt: prData.mergedAt,
          additionalCommits,
          forcePushCount,
          totalCommits: commits.length,
        });
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
  const prsByRepo = new Map<string, GitHubPullRequest[]>();
  for (const pr of pullRequests) {
    const existing = prsByRepo.get(pr.repository) ?? [];
    existing.push(pr);
    prsByRepo.set(pr.repository, existing);
  }

  for (const [repoFullName, prs] of prsByRepo) {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      continue;
    }

    // 10件ずつバッチ処理
    const batchSize = 10;
    for (let i = 0; i < prs.length; i += batchSize) {
      const batch = prs.slice(i, i + batchSize);
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

        sizeData.push({
          prNumber: prData.number,
          title: prData.title,
          repository: repoFullName,
          createdAt: prData.createdAt,
          mergedAt: prData.mergedAt,
          additions: prData.additions,
          deletions: prData.deletions,
          linesOfCode: prData.additions + prData.deletions,
          filesChanged: prData.changedFiles,
        });
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
  const msToHours = 1000 * 60 * 60;

  // リポジトリごとにグループ化
  const prsByRepo = new Map<string, GitHubPullRequest[]>();
  for (const pr of pullRequests) {
    const existing = prsByRepo.get(pr.repository) ?? [];
    existing.push(pr);
    prsByRepo.set(pr.repository, existing);
  }

  for (const [repoFullName, prs] of prsByRepo) {
    const [owner, repo] = repoFullName.split('/');
    if (!owner || !repo) {
      continue;
    }

    // 10件ずつバッチ処理
    const batchSize = 10;
    for (let i = 0; i < prs.length; i += batchSize) {
      const batch = prs.slice(i, i + batchSize);
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
          reviewData.push({
            prNumber: pr.number,
            title: pr.title,
            repository: pr.repository,
            createdAt: pr.createdAt,
            readyForReviewAt: pr.createdAt,
            firstReviewAt: null,
            approvedAt: null,
            mergedAt: pr.mergedAt,
            timeToFirstReviewHours: null,
            reviewDurationHours: null,
            timeToMergeHours: null,
            totalTimeHours: null,
          });
          continue;
        }

        const reviews = prData.reviews?.nodes ?? [];
        const timeline = prData.timelineItems?.nodes ?? [];

        // Ready for Review時刻を取得
        let readyForReviewAt = prData.createdAt;
        const readyEvent = timeline.find((e) => e.__typename === 'ReadyForReviewEvent');
        if (readyEvent?.createdAt) {
          readyForReviewAt = readyEvent.createdAt;
        }

        // レビュー情報を処理
        const validReviews = reviews
          .filter((r) => r.state !== 'PENDING' && r.submittedAt)
          .sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime());

        const firstReviewAt = validReviews.length > 0 ? validReviews[0].submittedAt : null;
        const approvedReview = validReviews.find((r) => r.state === 'APPROVED');
        const approvedAt = approvedReview?.submittedAt ?? null;

        // 各時間を計算
        const readyAt = new Date(readyForReviewAt).getTime();
        let timeToFirstReviewHours: number | null = null;
        let reviewDurationHours: number | null = null;
        let timeToMergeHours: number | null = null;
        let totalTimeHours: number | null = null;

        if (firstReviewAt) {
          timeToFirstReviewHours =
            Math.round(((new Date(firstReviewAt).getTime() - readyAt) / msToHours) * 10) / 10;
        }

        if (firstReviewAt && approvedAt) {
          reviewDurationHours =
            Math.round(
              ((new Date(approvedAt).getTime() - new Date(firstReviewAt).getTime()) / msToHours) *
                10
            ) / 10;
        }

        if (approvedAt && prData.mergedAt) {
          timeToMergeHours =
            Math.round(
              ((new Date(prData.mergedAt).getTime() - new Date(approvedAt).getTime()) / msToHours) *
                10
            ) / 10;
        }

        if (prData.mergedAt) {
          totalTimeHours =
            Math.round(((new Date(prData.mergedAt).getTime() - readyAt) / msToHours) * 10) / 10;
        }

        reviewData.push({
          prNumber: prData.number,
          title: prData.title,
          repository: repoFullName,
          createdAt: prData.createdAt,
          readyForReviewAt,
          firstReviewAt,
          approvedAt,
          mergedAt: prData.mergedAt,
          timeToFirstReviewHours,
          reviewDurationHours,
          timeToMergeHours,
          totalTimeHours,
        });
      }
    }
  }

  return reviewData;
}
