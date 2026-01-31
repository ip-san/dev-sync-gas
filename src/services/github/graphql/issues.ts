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
import { MAX_PR_CHAIN_DEPTH } from '../../../config/apiConfig';
import type {
  IssuesQueryResponse,
  IssueWithLinkedPRsQueryResponse,
  GraphQLIssue,
  CommitAssociatedPRsQueryResponse,
} from './types';
import type { IssueDateRange } from '../api';
import { getPullRequestWithBranchesGraphQL } from './pullRequests';

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

    if (!queryResult.success || !queryResult.data?.repository?.issues) {
      if (page === 0) {
        return { success: false, error: queryResult.error };
      }
      break;
    }

    const issuesData = queryResult.data.repository.issues;
    const nodes: GraphQLIssue[] = issuesData.nodes;
    const pageInfo = issuesData.pageInfo;

    for (const issue of nodes) {
      const createdAt = new Date(issue.createdAt);

      // 日付範囲チェック
      if (options?.dateRange?.start) {
        const startDate = new Date(options.dateRange.start);
        if (createdAt < startDate) {
          continue;
        }
      }
      if (options?.dateRange?.end) {
        const endDate = new Date(options.dateRange.end);
        if (createdAt > endDate) {
          continue;
        }
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

  if (!result.success || !result.data?.repository?.issue) {
    return { success: false, error: result.error };
  }

  const timeline = result.data.repository.issue.timelineItems.nodes;
  const linkedPRs: {
    number: number;
    createdAt: string;
    mergedAt: string | null;
    baseRefName: string;
    headRefName: string;
    mergeCommitSha: string | null;
  }[] = [];

  for (const event of timeline) {
    const source = event.source;
    if (!source?.number) {
      continue;
    }

    // 同じリポジトリのPRのみ
    const sourceRepo = source.repository?.nameWithOwner;
    if (sourceRepo && sourceRepo !== `${owner}/${repo}`) {
      continue;
    }

    // 重複チェック
    if (linkedPRs.some((pr) => pr.number === source.number)) {
      continue;
    }

    linkedPRs.push({
      number: source.number,
      createdAt: source.createdAt ?? '',
      mergedAt: source.mergedAt ?? null,
      baseRefName: source.baseRefName ?? '',
      headRefName: source.headRefName ?? '',
      mergeCommitSha: source.mergeCommit?.oid ?? null,
    });
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
 * PRチェーンを追跡してproductionブランチへのマージを検出（GraphQL版）
 */
export function trackToProductionMergeGraphQL(
  owner: string,
  repo: string,
  initialPRNumber: number,
  token: string,
  productionPattern: string = 'production'
): ApiResponse<{
  productionMergedAt: string | null;
  prChain: PRChainItem[];
}> {
  const { logger } = getContainer();
  const prChain: PRChainItem[] = [];
  let currentPRNumber = initialPRNumber;
  let productionMergedAt: string | null = null;

  for (let depth = 0; depth < MAX_PR_CHAIN_DEPTH; depth++) {
    const prResult = getPullRequestWithBranchesGraphQL(owner, repo, currentPRNumber, token);

    if (!prResult.success || !prResult.data) {
      logger.log(`    ⚠️ Failed to fetch PR #${currentPRNumber}`);
      break;
    }

    const pr = prResult.data;
    prChain.push({
      prNumber: pr.number,
      baseBranch: pr.baseBranch ?? 'unknown',
      headBranch: pr.headBranch ?? 'unknown',
      mergedAt: pr.mergedAt,
    });

    // productionブランチへのマージを検出
    if (pr.baseBranch && pr.baseBranch.toLowerCase().includes(productionPattern.toLowerCase())) {
      if (pr.mergedAt) {
        productionMergedAt = pr.mergedAt;
        logger.log(
          `    ✅ Found production merge: PR #${pr.number} → ${pr.baseBranch} at ${pr.mergedAt}`
        );
      }
      break;
    }

    // マージされていない場合は追跡終了
    if (!pr.mergedAt || !pr.mergeCommitSha) {
      break;
    }

    // マージコミットSHAから次のPRを検索
    const nextPRResult = findPRContainingCommitGraphQL(owner, repo, pr.mergeCommitSha, token);

    if (!nextPRResult.success || !nextPRResult.data) {
      break;
    }

    // 同じPRの場合は無限ループを防止
    if (nextPRResult.data.number === currentPRNumber) {
      break;
    }

    currentPRNumber = nextPRResult.data.number;
  }

  return { success: true, data: { productionMergedAt, prChain } };
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
      let bestResult: {
        productionMergedAt: string | null;
        prChain: PRChainItem[];
      } | null = null;

      for (const linkedPR of linkedPRsResult.data) {
        const trackResult = trackToProductionMergeGraphQL(
          repo.owner,
          repo.name,
          linkedPR.number,
          token,
          productionPattern
        );

        if (trackResult.success && trackResult.data) {
          if (trackResult.data.productionMergedAt) {
            if (
              !bestResult?.productionMergedAt ||
              new Date(trackResult.data.productionMergedAt) <
                new Date(bestResult.productionMergedAt)
            ) {
              bestResult = trackResult.data;
            }
          } else if (!bestResult) {
            bestResult = trackResult.data;
          }
        }
      }

      const prChain = bestResult?.prChain ?? [];
      const productionMergedAt = bestResult?.productionMergedAt ?? null;

      // サイクルタイム計算
      let cycleTimeHours: number | null = null;
      if (productionMergedAt) {
        const startTime = new Date(issue.createdAt).getTime();
        const endTime = new Date(productionMergedAt).getTime();
        cycleTimeHours = Math.round(((endTime - startTime) / (1000 * 60 * 60)) * 10) / 10;
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
        Math.round(((prCreatedTime - issueCreatedTime) / (1000 * 60 * 60)) * 10) / 10;

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
