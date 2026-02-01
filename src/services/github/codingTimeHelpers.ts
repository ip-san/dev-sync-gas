/**
 * コーディングタイム計算のヘルパー関数
 *
 * getCodingTimeData の複雑度削減のため分離
 */

import type { IssueCodingTime } from '../../types/index.js';
import type { LoggerClient } from '../../interfaces/index.js';
import { getPullRequestWithBranches } from './pullRequests.js';
import { MS_TO_HOURS } from '../../utils/timeConstants.js';

/**
 * PRがない場合のデフォルトコーディングタイムデータを生成
 */
export function createDefaultCodingTimeData(
  issue: { number: number; title: string; createdAt: string },
  repository: string
): IssueCodingTime {
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
 * コーディングタイムを計算（時間単位、小数第1位まで）
 */
export function calculateCodingTimeHours(issueCreatedAt: string, prCreatedAt: string): number {
  const issueTime = new Date(issueCreatedAt).getTime();
  const prTime = new Date(prCreatedAt).getTime();
  return Math.round(((prTime - issueTime) / MS_TO_HOURS) * 10) / 10;
}

/**
 * 複数のリンクPRから最も早く作成されたPRを選択
 */
export function findEarliestPR(
  prNumbers: number[],
  owner: string,
  repoName: string,
  token: string
): { prNumber: number; createdAt: string } | null {
  let earliestPR: { prNumber: number; createdAt: string } | null = null;

  for (const prNumber of prNumbers) {
    const prResult = getPullRequestWithBranches(owner, repoName, prNumber, token);

    if (prResult.success && prResult.data) {
      const pr = prResult.data;
      if (!earliestPR || new Date(pr.createdAt) < new Date(earliestPR.createdAt)) {
        earliestPR = { prNumber: pr.number, createdAt: pr.createdAt };
      }
    }
  }

  return earliestPR;
}

/**
 * Issue1件分のコーディングタイムデータを処理
 */
export function processIssueCodingTime(
  issue: { number: number; title: string; createdAt: string },
  linkedPRNumbers: number[],
  owner: string,
  repoName: string,
  repository: string,
  token: string,
  logger: LoggerClient
): IssueCodingTime {
  logger.log(`  📌 Processing Issue #${issue.number}: ${issue.title}`);

  if (linkedPRNumbers.length === 0) {
    logger.log(`    ⏭️ No linked PRs found`);
    return createDefaultCodingTimeData(issue, repository);
  }

  logger.log(`    🔗 Found ${linkedPRNumbers.length} linked PRs: ${linkedPRNumbers.join(', ')}`);

  const earliestPR = findEarliestPR(linkedPRNumbers, owner, repoName, token);

  if (!earliestPR) {
    logger.log(`    ⚠️ Could not fetch any linked PR details`);
    return createDefaultCodingTimeData(issue, repository);
  }

  const codingTimeHours = calculateCodingTimeHours(issue.createdAt, earliestPR.createdAt);
  logger.log(`    ✅ Coding time: ${codingTimeHours}h (Issue → PR #${earliestPR.prNumber})`);

  return {
    issueNumber: issue.number,
    issueTitle: issue.title,
    repository,
    issueCreatedAt: issue.createdAt,
    prCreatedAt: earliestPR.createdAt,
    prNumber: earliestPR.prNumber,
    codingTimeHours,
  };
}
