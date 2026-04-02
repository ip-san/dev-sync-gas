/**
 * GitHub GraphQL API - サイクルタイム計算
 *
 * Issue作成からproductionマージまでのサイクルタイム計測
 */

import { getContainer } from '../../../../container';
import type { ApiResponse, GitHubIssue, GitHubRepository, IssueCycleTime } from '../../../../types';
import { MS_TO_HOURS } from '../../../../utils/timeConstants.js';
import type { IssueDateRange } from '../../api';
import { selectBestTrackResult } from '../../shared/prTracking.js';
import { getIssuesGraphQL } from './fetch';
import { getLinkedPRsForIssueGraphQL } from './linkedPRs';
import { trackToProductionMergeGraphQL } from './tracking';

/**
 * サイクルタイムを計算
 */
function calculateCycleTimeHours(issueCreatedAt: string, productionMergedAt: string): number {
  const startTime = new Date(issueCreatedAt).getTime();
  const endTime = new Date(productionMergedAt).getTime();
  return Math.round(((endTime - startTime) / MS_TO_HOURS) * 10) / 10;
}

/**
 * リンクPRなしのサイクルタイムエントリを作成
 */
function createEmptyCycleTimeEntry(issue: GitHubIssue, repository: string): IssueCycleTime {
  return {
    issueNumber: issue.number,
    issueTitle: issue.title,
    repository,
    issueCreatedAt: issue.createdAt,
    productionMergedAt: null,
    cycleTimeHours: null,
    prChain: [],
  };
}

/**
 * Issueサイクルタイム処理のパラメータ
 */
interface ProcessIssueCycleTimeParams {
  issue: GitHubIssue;
  repo: GitHubRepository;
  token: string;
  productionPattern: string;
  logger: { log: (msg: string) => void };
}

/**
 * 1つのIssueをサイクルタイム処理
 */
function processIssueForCycleTime(params: ProcessIssueCycleTimeParams): IssueCycleTime {
  const { issue, repo, token, productionPattern, logger } = params;

  logger.log(`  📌 Processing Issue #${issue.number}: ${issue.title}`);

  const linkedPRsResult = getLinkedPRsForIssueGraphQL(repo.owner, repo.name, issue.number, token);

  if (!linkedPRsResult.success || !linkedPRsResult.data || linkedPRsResult.data.length === 0) {
    logger.log(`    ⏭️ No linked PRs found`);
    return createEmptyCycleTimeEntry(issue, repo.fullName);
  }

  logger.log(
    `    🔗 Found ${linkedPRsResult.data.length} linked PRs: ${linkedPRsResult.data.map((p) => p.number).join(', ')}`
  );

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

  const cycleTimeHours = productionMergedAt
    ? calculateCycleTimeHours(issue.createdAt, productionMergedAt)
    : null;

  return {
    issueNumber: issue.number,
    issueTitle: issue.title,
    repository: repo.fullName,
    issueCreatedAt: issue.createdAt,
    productionMergedAt,
    cycleTimeHours,
    prChain,
  };
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

    const issuesResult = getIssuesGraphQL(repo, token, {
      dateRange: options.dateRange,
      labels: options.labels,
    });

    if (!issuesResult.success || !issuesResult.data) {
      logger.log(`  ⚠️ Failed to fetch issues: ${issuesResult.error}`);
      continue;
    }

    logger.log(`  📋 Found ${issuesResult.data.length} issues to process`);

    for (const issue of issuesResult.data) {
      const cycleTimeEntry = processIssueForCycleTime({
        issue,
        repo,
        token,
        productionPattern,
        logger,
      });
      allCycleTimeData.push(cycleTimeEntry);
    }
  }

  logger.log(`✅ Total: ${allCycleTimeData.length} issues processed`);
  return { success: true, data: allCycleTimeData };
}
