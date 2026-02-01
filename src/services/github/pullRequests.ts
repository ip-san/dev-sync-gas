/**
 * GitHub Pull Request 関連モジュール
 *
 * PR一覧取得、PR詳細取得、PRコミット取得など
 * Pull Requestに関するGitHub API操作を提供。
 */

import type {
  GitHubPullRequest,
  GitHubRepository,
  ApiResponse,
  PRReworkData,
  PRReviewData,
  PRSizeData,
  GitHubPRResponse,
  GitHubCommitResponse,
  GitHubTimelineEventResponse,
  GitHubReviewResponse,
} from '../../types';
import { getContainer } from '../../container';
import {
  fetchGitHub,
  DEFAULT_MAX_PAGES,
  PER_PAGE,
  STATUS_FETCH_WARNING_THRESHOLD,
  type DateRange,
} from './api';
import { paginateAPI, paginateAndReduce } from '../../utils/pagination';
import { parseRepositorySafe } from '../../utils/repositoryParser';
import { MS_TO_HOURS } from '../../utils/timeConstants.js';

// =============================================================================
// PR一覧取得
// =============================================================================

/**
 * リポジトリのプルリクエスト一覧を取得
 *
 * @param repo - 対象リポジトリ
 * @param token - GitHub Personal Access Token
 * @param state - 取得するPRの状態（デフォルト: "all"）
 * @param dateRange - 期間フィルタ（オプション）
 * @param maxPages - 最大取得ページ数（デフォルト: 5）
 */
/**
 * getPullRequests のオプション
 */
export interface GetPullRequestsOptions {
  repo: GitHubRepository;
  token: string;
  state?: 'open' | 'closed' | 'all';
  dateRange?: DateRange;
  maxPages?: number;
}

export function getPullRequests(options: GetPullRequestsOptions): ApiResponse<GitHubPullRequest[]> {
  const { repo, token, state = 'all', dateRange, maxPages = DEFAULT_MAX_PAGES } = options;
  const { logger } = getContainer();
  const result = paginateAPI({
    getEndpoint: (page) =>
      `/repos/${repo.fullName}/pulls?state=${state}&per_page=${PER_PAGE}&page=${page}&sort=updated&direction=desc`,
    fetchFn: (endpoint) => fetchGitHub<GitHubPRResponse[]>(endpoint, token),
    transform: (pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state as 'open' | 'closed',
      createdAt: pr.created_at,
      mergedAt: pr.merged_at,
      closedAt: pr.closed_at,
      author: pr.user?.login ?? 'unknown',
      repository: repo.fullName,
    }),
    filter: (pr) => {
      const createdAt = new Date(pr.createdAt);
      if (dateRange?.until && createdAt > dateRange.until) {
        return false;
      }
      if (dateRange?.since && createdAt < dateRange.since) {
        return false;
      }
      return true;
    },
    config: { maxPages },
  });

  // 部分的な失敗の警告をログ出力
  if (result.warning) {
    logger.log(`  ⚠️ ${result.warning}`);
  }

  return result;
}

// =============================================================================
// PR詳細取得
// =============================================================================

/**
 * PRの詳細情報を取得（additions, deletions, changed_files を含む）
 */
export function getPRDetails(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<{ additions: number; deletions: number; changedFiles: number }> {
  const endpoint = `/repos/${owner}/${repo}/pulls/${prNumber}`;
  const response = fetchGitHub<GitHubPRResponse>(endpoint, token);

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  return {
    success: true,
    data: {
      additions: response.data.additions ?? 0,
      deletions: response.data.deletions ?? 0,
      changedFiles: response.data.changed_files ?? 0,
    },
  };
}

/**
 * PR詳細を取得（ブランチ情報、マージコミットSHA含む）
 */
export function getPullRequestWithBranches(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<GitHubPullRequest> {
  const endpoint = `/repos/${owner}/${repo}/pulls/${prNumber}`;
  const response = fetchGitHub<GitHubPRResponse>(endpoint, token);

  if (!response.success || !response.data) {
    return { success: false, error: response.error };
  }

  const pr = response.data;
  return {
    success: true,
    data: {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state as 'open' | 'closed',
      createdAt: pr.created_at,
      closedAt: pr.closed_at,
      mergedAt: pr.merged_at,
      repository: `${owner}/${repo}`,
      author: pr.user?.login ?? 'unknown',
      baseBranch: pr.base?.ref,
      headBranch: pr.head?.ref,
      mergeCommitSha: pr.merge_commit_sha,
    },
  };
}

// =============================================================================
// PRコミット・タイムライン
// =============================================================================

/**
 * PRのコミット一覧を取得
 */
function getPRCommits(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<{ sha: string; date: string }[]> {
  return paginateAPI({
    getEndpoint: (page) =>
      `/repos/${owner}/${repo}/pulls/${prNumber}/commits?per_page=${PER_PAGE}&page=${page}`,
    fetchFn: (endpoint) => fetchGitHub<GitHubCommitResponse[]>(endpoint, token),
    transform: (commit) => ({
      sha: commit.sha,
      date: commit.commit?.author?.date ?? commit.commit?.committer?.date ?? '',
    }),
    config: { maxPages: DEFAULT_MAX_PAGES },
  });
}

/**
 * PRのタイムラインイベントを取得してforce push回数をカウント
 */
function getPRForcePushCount(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<number> {
  return paginateAndReduce(
    {
      getEndpoint: (page) =>
        `/repos/${owner}/${repo}/issues/${prNumber}/timeline?per_page=${PER_PAGE}&page=${page}`,
      fetchFn: (endpoint) => fetchGitHub<GitHubTimelineEventResponse[]>(endpoint, token),
      transform: (event) => event,
      config: { maxPages: DEFAULT_MAX_PAGES },
    },
    (count, event) => (event.event === 'head_ref_force_pushed' ? count + 1 : count),
    0
  );
}

// =============================================================================
// 手戻りデータ取得
// =============================================================================

/**
 * 複数PRの手戻りデータを一括取得
 */
export function getReworkDataForPRs(
  pullRequests: GitHubPullRequest[],
  token: string
): PRReworkData[] {
  const { logger } = getContainer();
  const reworkData: PRReworkData[] = [];

  for (const pr of pullRequests) {
    const parseResult = parseRepositorySafe(pr.repository);
    if (!parseResult.success || !parseResult.data) {
      logger.log(`  ⚠️ ${parseResult.success ? 'No data returned' : parseResult.error}`);
      continue;
    }
    const { owner, repo } = parseResult.data;

    const prCreatedAt = new Date(pr.createdAt);

    // コミット一覧を取得
    const commitsResult = getPRCommits(owner, repo, pr.number, token);
    let totalCommits = 0;
    let additionalCommits = 0;

    if (commitsResult.success && commitsResult.data) {
      totalCommits = commitsResult.data.length;
      // PR作成後のコミットをカウント
      for (const commit of commitsResult.data) {
        if (!commit.date || new Date(commit.date) <= prCreatedAt) {
          continue;
        }
        additionalCommits++;
      }
    } else {
      logger.log(`  ⚠️ Failed to fetch commits for PR #${pr.number}: ${commitsResult.error}`);
    }

    // Force Push回数を取得
    const forcePushResult = getPRForcePushCount(owner, repo, pr.number, token);
    let forcePushCount = 0;

    if (forcePushResult.success && forcePushResult.data !== undefined) {
      forcePushCount = forcePushResult.data;
    } else {
      logger.log(
        `  ⚠️ Failed to fetch force push count for PR #${pr.number}: ${forcePushResult.error}`
      );
    }

    reworkData.push({
      prNumber: pr.number,
      title: pr.title,
      repository: pr.repository,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      additionalCommits,
      forcePushCount,
      totalCommits,
    });
  }

  return reworkData;
}

// =============================================================================
// PRサイズデータ取得
// =============================================================================

/**
 * 複数PRのサイズデータを一括取得
 */
export function getPRSizeDataForPRs(
  pullRequests: GitHubPullRequest[],
  token: string
): PRSizeData[] {
  const { logger } = getContainer();
  const sizeData: PRSizeData[] = [];

  if (pullRequests.length > STATUS_FETCH_WARNING_THRESHOLD) {
    logger.log(`  ⚠️ Fetching size data for ${pullRequests.length} PRs. This may take a while.`);
  }

  let skippedCount = 0;

  for (const pr of pullRequests) {
    const [owner, repo] = pr.repository.split('/');
    if (!owner || !repo) {
      logger.log(`  ⚠️ Invalid repository format: ${pr.repository}`);
      skippedCount++;
      continue;
    }

    const detailsResult = getPRDetails(owner, repo, pr.number, token);

    if (!detailsResult.success || !detailsResult.data) {
      logger.log(`  ⚠️ Failed to fetch details for PR #${pr.number}: ${detailsResult.error}`);
      skippedCount++;
      continue;
    }

    const { additions, deletions, changedFiles } = detailsResult.data;

    sizeData.push({
      prNumber: pr.number,
      title: pr.title,
      repository: pr.repository,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      additions,
      deletions,
      linesOfCode: additions + deletions,
      filesChanged: changedFiles,
    });
  }

  if (skippedCount > 0) {
    logger.log(`  ⚠️ Skipped ${skippedCount} PRs due to API errors`);
  }

  return sizeData;
}

// =============================================================================
// レビュー効率データ取得
// =============================================================================

/** GitHub Reviewの状態 */
type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';

/**
 * PRのレビュー一覧を取得
 */
function getPRReviews(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<{ state: ReviewState; submittedAt: string; user: string }[]> {
  const allReviews: { state: ReviewState; submittedAt: string; user: string }[] = [];
  let page = 1;

  while (page <= DEFAULT_MAX_PAGES) {
    const endpoint = `/repos/${owner}/${repo}/pulls/${prNumber}/reviews?per_page=${PER_PAGE}&page=${page}`;
    const response = fetchGitHub<GitHubReviewResponse[]>(endpoint, token);

    if (!response.success || !response.data) {
      if (page === 1) {
        return { success: false, error: response.error };
      }
      break;
    }

    if (response.data.length === 0) {
      break;
    }

    for (const review of response.data) {
      if (review.state === 'PENDING') {
        continue;
      } // 未提出はスキップ

      allReviews.push({
        state: review.state,
        submittedAt: review.submitted_at,
        user: review.user?.login ?? 'unknown',
      });
    }

    page++;
  }

  return { success: true, data: allReviews };
}

/**
 * PRのready_for_review時刻を取得（Timeline APIから）
 */
function getPRReadyForReviewAt(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<string | null> {
  let page = 1;

  while (page <= DEFAULT_MAX_PAGES) {
    const endpoint = `/repos/${owner}/${repo}/issues/${prNumber}/timeline?per_page=${PER_PAGE}&page=${page}`;
    const response = fetchGitHub<GitHubTimelineEventResponse[]>(endpoint, token);

    if (!response.success || !response.data) {
      if (page === 1) {
        return { success: false, error: response.error };
      }
      break;
    }

    if (response.data.length === 0) {
      break;
    }

    for (const event of response.data) {
      if (event.event === 'ready_for_review' && event.created_at) {
        return { success: true, data: event.created_at };
      }
    }

    page++;
  }

  // ready_for_reviewイベントがない = 最初からドラフトでなかった
  return { success: true, data: null };
}

// =============================================================================
// レビュー効率データ計算のヘルパー関数
// =============================================================================

/**
 * fetchReadyForReviewTime のオプション
 */
interface FetchReadyForReviewTimeOptions {
  owner: string;
  repo: string;
  prNumber: number;
  prCreatedAt: string;
  token: string;
  logger: ReturnType<typeof getContainer>['logger'];
}

/**
 * Ready for Review時刻を取得
 */
function fetchReadyForReviewTime(options: FetchReadyForReviewTimeOptions): string {
  const { owner, repo, prNumber, prCreatedAt, token, logger } = options;
  const readyResult = getPRReadyForReviewAt(owner, repo, prNumber, token);

  if (readyResult.success && readyResult.data) {
    return readyResult.data;
  }

  if (!readyResult.success) {
    logger.log(`  ⚠️ Failed to fetch timeline for PR #${prNumber}: ${readyResult.error}`);
  }

  return prCreatedAt;
}

/**
 * レビュー情報取得結果
 */
interface ReviewInfo {
  firstReviewAt: string | null;
  approvedAt: string | null;
}

/**
 * fetchAndSortReviews のオプション
 */
interface FetchAndSortReviewsOptions {
  owner: string;
  repo: string;
  prNumber: number;
  token: string;
  logger: ReturnType<typeof getContainer>['logger'];
}

/**
 * PRのレビュー情報を取得してソート
 */
function fetchAndSortReviews(options: FetchAndSortReviewsOptions): ReviewInfo {
  const { owner, repo, prNumber, token, logger } = options;
  const reviewsResult = getPRReviews(owner, repo, prNumber, token);
  let firstReviewAt: string | null = null;
  let approvedAt: string | null = null;

  if (reviewsResult.success && reviewsResult.data) {
    const sortedReviews = [...reviewsResult.data].sort(
      (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
    );

    if (sortedReviews.length > 0) {
      firstReviewAt = sortedReviews[0].submittedAt;
    }

    const approvalReview = sortedReviews.find((r) => r.state === 'APPROVED');
    if (approvalReview) {
      approvedAt = approvalReview.submittedAt;
    }
  } else {
    logger.log(`  ⚠️ Failed to fetch reviews for PR #${prNumber}: ${reviewsResult.error}`);
  }

  return { firstReviewAt, approvedAt };
}

/**
 * レビュー効率指標を計算
 */
interface ReviewMetrics {
  timeToFirstReviewHours: number | null;
  reviewDurationHours: number | null;
  timeToMergeHours: number | null;
  totalTimeHours: number | null;
}

function calculateReviewMetrics(
  readyForReviewAt: string,
  firstReviewAt: string | null,
  approvedAt: string | null,
  mergedAt: string | null
): ReviewMetrics {
  const readyAt = new Date(readyForReviewAt).getTime();
  let timeToFirstReviewHours: number | null = null;
  let reviewDurationHours: number | null = null;
  let timeToMergeHours: number | null = null;
  let totalTimeHours: number | null = null;

  if (firstReviewAt) {
    timeToFirstReviewHours =
      Math.round(((new Date(firstReviewAt).getTime() - readyAt) / MS_TO_HOURS) * 10) / 10;
  }

  if (firstReviewAt && approvedAt) {
    reviewDurationHours =
      Math.round(
        ((new Date(approvedAt).getTime() - new Date(firstReviewAt).getTime()) / MS_TO_HOURS) * 10
      ) / 10;
  }

  if (approvedAt && mergedAt) {
    timeToMergeHours =
      Math.round(
        ((new Date(mergedAt).getTime() - new Date(approvedAt).getTime()) / MS_TO_HOURS) * 10
      ) / 10;
  }

  if (mergedAt) {
    totalTimeHours = Math.round(((new Date(mergedAt).getTime() - readyAt) / MS_TO_HOURS) * 10) / 10;
  }

  return {
    timeToFirstReviewHours,
    reviewDurationHours,
    timeToMergeHours,
    totalTimeHours,
  };
}

/**
 * 複数PRのレビュー効率データを一括取得
 */
export function getReviewEfficiencyDataForPRs(
  pullRequests: GitHubPullRequest[],
  token: string
): PRReviewData[] {
  const { logger } = getContainer();
  const reviewData: PRReviewData[] = [];

  for (const pr of pullRequests) {
    const parseResult = parseRepositorySafe(pr.repository);
    if (!parseResult.success || !parseResult.data) {
      logger.log(`  ⚠️ ${parseResult.success ? 'No data returned' : parseResult.error}`);
      continue;
    }
    const { owner, repo } = parseResult.data;

    // Ready for Review時刻を取得
    const readyForReviewAt = fetchReadyForReviewTime({
      owner,
      repo,
      prNumber: pr.number,
      prCreatedAt: pr.createdAt,
      token,
      logger,
    });

    // レビュー情報を取得
    const { firstReviewAt, approvedAt } = fetchAndSortReviews({
      owner,
      repo,
      prNumber: pr.number,
      token,
      logger,
    });

    // レビュー効率指標を計算
    const metrics = calculateReviewMetrics(
      readyForReviewAt,
      firstReviewAt,
      approvedAt,
      pr.mergedAt
    );

    reviewData.push({
      prNumber: pr.number,
      title: pr.title,
      repository: pr.repository,
      createdAt: pr.createdAt,
      readyForReviewAt,
      firstReviewAt,
      approvedAt,
      mergedAt: pr.mergedAt,
      ...metrics,
    });
  }

  return reviewData;
}

/**
 * コミットSHAを含むPRを検索
 */
export function findPRContainingCommit(
  owner: string,
  repo: string,
  commitSha: string,
  token: string
): ApiResponse<GitHubPullRequest | null> {
  const endpoint = `/repos/${owner}/${repo}/commits/${commitSha}/pulls`;
  const response = fetchGitHub<GitHubPRResponse[]>(endpoint, token);

  if (!response.success) {
    if (response.error?.includes('404')) {
      return { success: true, data: null };
    }
    return { success: false, error: response.error };
  }

  if (!response.data || response.data.length === 0) {
    return { success: true, data: null };
  }

  // マージ済みのPRを優先
  const mergedPR = response.data.find((pr) => pr.merged_at !== null);
  const targetPR = mergedPR ?? response.data[0];

  return {
    success: true,
    data: {
      id: targetPR.id,
      number: targetPR.number,
      title: targetPR.title,
      state: targetPR.state as 'open' | 'closed',
      createdAt: targetPR.created_at,
      closedAt: targetPR.closed_at,
      mergedAt: targetPR.merged_at,
      repository: `${owner}/${repo}`,
      author: targetPR.user?.login ?? 'unknown',
      baseBranch: targetPR.base?.ref,
      headBranch: targetPR.head?.ref,
      mergeCommitSha: targetPR.merge_commit_sha,
    },
  };
}
