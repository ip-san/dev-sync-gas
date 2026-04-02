/**
 * GitHub GraphQL API - コーディングタイム計算
 *
 * Issue作成からPR作成までのコーディングタイム計測
 */

import { getContainer } from '../../../../container';
import type {
  ApiResponse,
  GitHubIssue,
  GitHubRepository,
  IssueCodingTime,
} from '../../../../types';
import { MS_TO_HOURS } from '../../../../utils/timeConstants.js';
import type { IssueDateRange } from '../../api';
import { getIssuesGraphQL } from './fetch';
import { getLinkedPRsForIssueGraphQL } from './linkedPRs';

/**
 * リンクPRがない場合の空コーディングタイムエントリを作成
 */
function createEmptyCodingTimeEntry(issue: GitHubIssue, repository: string): IssueCodingTime {
  return {
    issueNumber: issue.number,
    issueTitle: issue.title,
    repository,
    issueCreatedAt: issue.createdAt,
    prCreatedAt: null,
    prNumber: null,
    codingTimeHours: null,
  };
}

/**
 * コーディングタイム（Issue作成→PR作成）を時間で計算
 */
function calculateCodingTime(issueCreatedAt: string, prCreatedAt: string): number {
  const issueCreatedTime = new Date(issueCreatedAt).getTime();
  const prCreatedTime = new Date(prCreatedAt).getTime();
  return Math.round(((prCreatedTime - issueCreatedTime) / MS_TO_HOURS) * 10) / 10;
}

/**
 * 1つのIssueを処理してコーディングタイムを計算
 */
function processIssueForCodingTime(
  issue: GitHubIssue,
  repo: GitHubRepository,
  token: string,
  logger: { log: (msg: string) => void }
): IssueCodingTime {
  logger.log(`  📌 Processing Issue #${issue.number}: ${issue.title}`);

  const linkedPRsResult = getLinkedPRsForIssueGraphQL(repo.owner, repo.name, issue.number, token);

  if (!linkedPRsResult.success || !linkedPRsResult.data || linkedPRsResult.data.length === 0) {
    logger.log(`    ⏭️ No linked PRs found`);
    return createEmptyCodingTimeEntry(issue, repo.fullName);
  }

  logger.log(`    🔗 Found ${linkedPRsResult.data.length} linked PRs`);

  const sortedPRs = [...linkedPRsResult.data].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const earliestPR = sortedPRs[0];

  const codingTimeHours = calculateCodingTime(issue.createdAt, earliestPR.createdAt);

  logger.log(`    ✅ Coding time: ${codingTimeHours}h (Issue → PR #${earliestPR.number})`);

  return {
    issueNumber: issue.number,
    issueTitle: issue.title,
    repository: repo.fullName,
    issueCreatedAt: issue.createdAt,
    prCreatedAt: earliestPR.createdAt,
    prNumber: earliestPR.number,
    codingTimeHours,
  };
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
      const codingTimeEntry = processIssueForCodingTime(issue, repo, token, logger);
      allCodingTimeData.push(codingTimeEntry);
    }
  }

  logger.log(`✅ Total: ${allCodingTimeData.length} issues processed for coding time`);
  return { success: true, data: allCodingTimeData };
}
