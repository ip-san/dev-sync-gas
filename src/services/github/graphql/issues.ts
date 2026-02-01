/**
 * GitHub GraphQL API - Issue 操作
 *
 * REST APIからの移行:
 * - getIssues: 同等（ただしPRフィルタリング不要）
 * - getLinkedPRsForIssue: Timeline取得 → 1リクエストでPR情報も取得
 *
 * 効率化ポイント:
 * - IssueとリンクPRを1リクエストで取得
 * - サイクルタイム計測に必要なPRブランチ情報も同時取得
 */

import type {
  GitHubIssue,
  GitHubRepository,
  ApiResponse,
  PRChainItem,
  IssueCycleTime,
  IssueCodingTime,
} from '../../../types';
import { getContainer } from '../../../container';
import { executeGraphQLWithRetry, DEFAULT_PAGE_SIZE } from './client';
import { ISSUES_QUERY, ISSUE_WITH_LINKED_PRS_QUERY, COMMIT_ASSOCIATED_PRS_QUERY } from './queries';
import {
  trackToProductionMerge as trackToProductionMergeShared,
  selectBestTrackResult,
} from '../shared/prTracking.js';
import type { PRFetcher, MinimalPRInfo } from '../shared/prTracking.js';
import { getPullRequestWithBranchesGraphQL } from './pullRequests.js';
import type {
  IssuesQueryResponse,
  IssueWithLinkedPRsQueryResponse,
  GraphQLIssue,
  CommitAssociatedPRsQueryResponse,
  CrossReferencedEvent,
} from './types';
import type { IssueDateRange } from '../api';
import { MS_TO_HOURS } from '../../../utils/timeConstants.js';
import { isWithinDateRange } from './issueHelpers.js';
import { validatePaginatedResponse, validateSingleResponse } from './errorHelpers.js';

// =============================================================================
// Issue一覧取得
// =============================================================================

/**
 * リポジトリのIssue一覧を取得（GraphQL版）
 *
 * REST APIとの違い:
 * - PRは含まれない（Issues APIではPRも返される）
 * - ラベルフィルタをAPI側で処理
 */
export function getIssuesGraphQL(
  repo: GitHubRepository,
  token: string,
  options?: {
    dateRange?: IssueDateRange;
    labels?: string[];
  }
): ApiResponse<GitHubIssue[]> {
  const { logger } = getContainer();
  const allIssues: GitHubIssue[] = [];
  let cursor: string | null = null;
  let page = 0;
  const maxPages = 10;

  logger.log(`  📋 Fetching issues from ${repo.fullName}...`);

  while (page < maxPages) {
    const queryResult: ApiResponse<IssuesQueryResponse> =
      executeGraphQLWithRetry<IssuesQueryResponse>(
        ISSUES_QUERY,
        {
          owner: repo.owner,
          name: repo.name,
          first: DEFAULT_PAGE_SIZE,
          after: cursor,
          labels: options?.labels?.length ? options.labels : null,
          states: ['OPEN', 'CLOSED'],
        },
        token
      );

    const validationError = validatePaginatedResponse(queryResult, page, 'repository.issues');
    if (validationError) {
      return validationError;
    }
    if (!queryResult.success) {
      break; // 2ページ目以降のエラー
    }

    const issuesData = queryResult.data!.repository!.issues;
    const nodes: GraphQLIssue[] = issuesData.nodes;
    const pageInfo = issuesData.pageInfo;

    for (const issue of nodes) {
      const createdAt = new Date(issue.createdAt);

      // 日付範囲チェック
      if (!isWithinDateRange(createdAt, options?.dateRange)) {
        continue;
      }

      allIssues.push(convertToIssue(issue, repo.fullName));
    }

    if (!pageInfo.hasNextPage) {
      break;
    }
    cursor = pageInfo.endCursor;
    page++;
  }

  logger.log(`  ✅ Found ${allIssues.length} issues`);
  return { success: true, data: allIssues };
}

/**
 * GraphQL Issueノードを内部型に変換
 */
function convertToIssue(issue: GraphQLIssue, repository: string): GitHubIssue {
  return {
    id: parseInt(issue.id.replace(/\D/g, ''), 10) || 0,
    number: issue.number,
    title: issue.title,
    state: issue.state.toLowerCase() as 'open' | 'closed',
    createdAt: issue.createdAt,
    closedAt: issue.closedAt,
    labels: issue.labels.nodes.map((l) => l.name),
    repository,
  };
}

// =============================================================================
// IssueリンクPR取得
// =============================================================================

/**
 * IssueにリンクされたPR番号を取得（GraphQL版）
 *
 * REST APIのTimeline APIと比較して、
 * PR情報（createdAt, mergedAt, branches）も同時取得。
 */
/**
 * タイムラインイベントから有効なPRを抽出するかチェック
 */
function isValidLinkedPR(
  source: CrossReferencedEvent['source'],
  owner: string,
  repo: string,
  existingPRNumbers: Set<number>
): boolean {
  if (!source?.number) {
    return false;
  }

  // 同じリポジトリのPRのみ
  const sourceRepo = source.repository?.nameWithOwner;
  if (sourceRepo && sourceRepo !== `${owner}/${repo}`) {
    return false;
  }

  // 重複チェック
  if (existingPRNumbers.has(source.number)) {
    return false;
  }

  return true;
}

/**
 * タイムラインイベントからPR情報を抽出
 */
function extractPRInfo(source: NonNullable<CrossReferencedEvent['source']>): {
  number: number;
  createdAt: string;
  mergedAt: string | null;
  baseRefName: string;
  headRefName: string;
  mergeCommitSha: string | null;
} {
  return {
    number: source.number!,
    createdAt: source.createdAt ?? '',
    mergedAt: source.mergedAt ?? null,
    baseRefName: source.baseRefName ?? '',
    headRefName: source.headRefName ?? '',
    mergeCommitSha: source.mergeCommit?.oid ?? null,
  };
}

export function getLinkedPRsForIssueGraphQL(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string
): ApiResponse<
  {
    number: number;
    createdAt: string;
    mergedAt: string | null;
    baseRefName: string;
    headRefName: string;
    mergeCommitSha: string | null;
  }[]
> {
  const result = executeGraphQLWithRetry<IssueWithLinkedPRsQueryResponse>(
    ISSUE_WITH_LINKED_PRS_QUERY,
    {
      owner,
      name: repo,
      number: issueNumber,
    },
    token
  );

  const validationError = validateSingleResponse(result, 'repository.issue');
  if (validationError) {
    return validationError;
  }

  const timeline = result.data!.repository!.issue!.timelineItems.nodes;
  const linkedPRs: {
    number: number;
    createdAt: string;
    mergedAt: string | null;
    baseRefName: string;
    headRefName: string;
    mergeCommitSha: string | null;
  }[] = [];
  const prNumbers = new Set<number>();

  for (const event of timeline) {
    const source = event.source;
    if (isValidLinkedPR(source, owner, repo, prNumbers) && source) {
      const prInfo = extractPRInfo(source);
      linkedPRs.push(prInfo);
      prNumbers.add(prInfo.number);
    }
  }

  return { success: true, data: linkedPRs };
}

// =============================================================================
// サイクルタイムデータ取得
// =============================================================================

/**
 * コミットSHAからPRを検索（GraphQL版）
 */
export function findPRContainingCommitGraphQL(
  owner: string,
  repo: string,
  commitSha: string,
  token: string
): ApiResponse<{
  number: number;
  baseRefName: string;
  headRefName: string;
  mergedAt: string | null;
  mergeCommitSha: string | null;
} | null> {
  const result = executeGraphQLWithRetry<CommitAssociatedPRsQueryResponse>(
    COMMIT_ASSOCIATED_PRS_QUERY,
    {
      owner,
      name: repo,
      oid: commitSha,
    },
    token
  );

  if (!result.success) {
    if (result.error?.includes('Could not resolve')) {
      // コミットが見つからない場合
      return { success: true, data: null };
    }
    return { success: false, error: result.error };
  }

  const prs = result.data?.repository?.object?.associatedPullRequests?.nodes;
  if (!prs || prs.length === 0) {
    return { success: true, data: null };
  }

  // マージ済みのPRを優先
  const mergedPR = prs.find((pr) => pr.mergedAt !== null);
  const targetPR = mergedPR ?? prs[0];

  return {
    success: true,
    data: {
      number: targetPR.number,
      baseRefName: targetPR.baseRefName,
      headRefName: targetPR.headRefName,
      mergedAt: targetPR.mergedAt,
      mergeCommitSha: targetPR.mergeCommit?.oid ?? null,
    },
  };
}

/**
 * GraphQL API版PRFetcherの作成
 *
 * 共通のPR追跡ロジックで使用するためのアダプター
 */
function createGraphQLFetcher(owner: string, repo: string, token: string): PRFetcher {
  return {
    getPR(prNumber: number): ApiResponse<MinimalPRInfo | null> {
      const result = getPullRequestWithBranchesGraphQL(owner, repo, prNumber, token);

      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }

      const pr = result.data;
      return {
        success: true,
        data: {
          number: pr.number,
          baseBranch: pr.baseBranch ?? null,
          headBranch: pr.headBranch ?? null,
          mergedAt: pr.mergedAt,
          mergeCommitSha: pr.mergeCommitSha ?? null,
        },
      };
    },

    findPRByCommit(commitSha: string, currentPRNumber: number): ApiResponse<number | null> {
      const result = findPRContainingCommitGraphQL(owner, repo, commitSha, token);

      if (!result.success || !result.data) {
        return { success: true, data: null };
      }

      // 同じPRの場合は無限ループを防止
      if (result.data.number === currentPRNumber) {
        return { success: true, data: null };
      }

      return { success: true, data: result.data.number };
    },
  };
}

/**
 * PRチェーンを追跡してproductionブランチへのマージを検出（GraphQL版）
 */
/**
 * trackToProductionMergeGraphQL のオプション
 */
export interface TrackToProductionGraphQLOptions {
  owner: string;
  repo: string;
  initialPRNumber: number;
  token: string;
  productionPattern?: string;
}

export function trackToProductionMergeGraphQL(
  options: TrackToProductionGraphQLOptions
): ApiResponse<{
  productionMergedAt: string | null;
  prChain: PRChainItem[];
}> {
  const { owner, repo, initialPRNumber, token, productionPattern = 'production' } = options;
  const { logger } = getContainer();

  // 共通のPR追跡ロジックを使用（GraphQL API版のfetcherを提供）
  const fetcher = createGraphQLFetcher(owner, repo, token);
  return trackToProductionMergeShared(fetcher, initialPRNumber, productionPattern, logger);
}

/**
 * サイクルタイムデータを取得（GraphQL版）
 */
export function getCycleTimeDataGraphQL(
  repositories: GitHubRepository[],
  token: string,
  options: {
    dateRange?: IssueDateRange;
    productionBranchPattern?: string;
    labels?: string[];
  } = {}
): ApiResponse<IssueCycleTime[]> {
  const { logger } = getContainer();
  const productionPattern = options.productionBranchPattern ?? 'production';
  const allCycleTimeData: IssueCycleTime[] = [];

  for (const repo of repositories) {
    logger.log(`🔍 Processing ${repo.fullName}...`);

    // Issueを取得
    const issuesResult = getIssuesGraphQL(repo, token, {
      dateRange: options.dateRange,
      labels: options.labels,
    });

    if (!issuesResult.success || !issuesResult.data) {
      logger.log(`  ⚠️ Failed to fetch issues: ${issuesResult.error}`);
      continue;
    }

    const issues = issuesResult.data;
    logger.log(`  📋 Found ${issues.length} issues to process`);

    for (const issue of issues) {
      logger.log(`  📌 Processing Issue #${issue.number}: ${issue.title}`);

      // リンクPRを取得（GraphQLで詳細情報も同時取得）
      const linkedPRsResult = getLinkedPRsForIssueGraphQL(
        repo.owner,
        repo.name,
        issue.number,
        token
      );

      if (!linkedPRsResult.success || !linkedPRsResult.data || linkedPRsResult.data.length === 0) {
        logger.log(`    ⏭️ No linked PRs found`);
        allCycleTimeData.push({
          issueNumber: issue.number,
          issueTitle: issue.title,
          repository: repo.fullName,
          issueCreatedAt: issue.createdAt,
          productionMergedAt: null,
          cycleTimeHours: null,
          prChain: [],
        });
        continue;
      }

      logger.log(
        `    🔗 Found ${linkedPRsResult.data.length} linked PRs: ${linkedPRsResult.data.map((p) => p.number).join(', ')}`
      );

      // 最初のリンクPRからproductionマージを追跡
      const trackResults = linkedPRsResult.data.map((linkedPR) => {
        const trackResult = trackToProductionMergeGraphQL({
          owner: repo.owner,
          repo: repo.name,
          initialPRNumber: linkedPR.number,
          token,
          productionPattern,
        });
        return trackResult.success && trackResult.data ? trackResult.data : null;
      });

      const { productionMergedAt, prChain } = selectBestTrackResult(trackResults);

      // サイクルタイム計算
      let cycleTimeHours: number | null = null;
      if (productionMergedAt) {
        const startTime = new Date(issue.createdAt).getTime();
        const endTime = new Date(productionMergedAt).getTime();
        cycleTimeHours = Math.round(((endTime - startTime) / MS_TO_HOURS) * 10) / 10;
      }

      allCycleTimeData.push({
        issueNumber: issue.number,
        issueTitle: issue.title,
        repository: repo.fullName,
        issueCreatedAt: issue.createdAt,
        productionMergedAt,
        cycleTimeHours,
        prChain,
      });
    }
  }

  logger.log(`✅ Total: ${allCycleTimeData.length} issues processed`);
  return { success: true, data: allCycleTimeData };
}

/**
 * コーディングタイムデータを取得（GraphQL版）
 */
export function getCodingTimeDataGraphQL(
  repositories: GitHubRepository[],
  token: string,
  options: {
    dateRange?: IssueDateRange;
    labels?: string[];
  } = {}
): ApiResponse<IssueCodingTime[]> {
  const { logger } = getContainer();
  const allCodingTimeData: IssueCodingTime[] = [];

  for (const repo of repositories) {
    logger.log(`🔍 Processing ${repo.fullName} for coding time...`);

    // Issueを取得
    const issuesResult = getIssuesGraphQL(repo, token, {
      dateRange: options.dateRange,
      labels: options.labels,
    });

    if (!issuesResult.success || !issuesResult.data) {
      logger.log(`  ⚠️ Failed to fetch issues: ${issuesResult.error}`);
      continue;
    }

    const issues = issuesResult.data;
    logger.log(`  📋 Found ${issues.length} issues to process`);

    for (const issue of issues) {
      logger.log(`  📌 Processing Issue #${issue.number}: ${issue.title}`);

      // リンクPRを取得（createdAtも含む）
      const linkedPRsResult = getLinkedPRsForIssueGraphQL(
        repo.owner,
        repo.name,
        issue.number,
        token
      );

      if (!linkedPRsResult.success || !linkedPRsResult.data || linkedPRsResult.data.length === 0) {
        logger.log(`    ⏭️ No linked PRs found`);
        allCodingTimeData.push({
          issueNumber: issue.number,
          issueTitle: issue.title,
          repository: repo.fullName,
          issueCreatedAt: issue.createdAt,
          prCreatedAt: null,
          prNumber: null,
          codingTimeHours: null,
        });
        continue;
      }

      logger.log(`    🔗 Found ${linkedPRsResult.data.length} linked PRs`);

      // 最も早く作成されたPRを使用
      const sortedPRs = [...linkedPRsResult.data].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const earliestPR = sortedPRs[0];

      // コーディングタイム計算
      const issueCreatedTime = new Date(issue.createdAt).getTime();
      const prCreatedTime = new Date(earliestPR.createdAt).getTime();
      const codingTimeHours =
        Math.round(((prCreatedTime - issueCreatedTime) / MS_TO_HOURS) * 10) / 10;

      logger.log(`    ✅ Coding time: ${codingTimeHours}h (Issue → PR #${earliestPR.number})`);

      allCodingTimeData.push({
        issueNumber: issue.number,
        issueTitle: issue.title,
        repository: repo.fullName,
        issueCreatedAt: issue.createdAt,
        prCreatedAt: earliestPR.createdAt,
        prNumber: earliestPR.number,
        codingTimeHours,
      });
    }
  }

  logger.log(`✅ Total: ${allCodingTimeData.length} issues processed for coding time`);
  return { success: true, data: allCodingTimeData };
}
