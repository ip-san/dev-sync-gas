/**
 * デバッグ用詳細表示関数モジュール
 *
 * 各指標の詳細データをログ出力するデバッグ用関数を提供。
 */

import { getConfig, getGitHubToken, getGitHubAuthMode } from '../config/settings';
import {
  getProductionBranchPattern,
  getCycleTimeIssueLabels,
  getCodingTimeIssueLabels,
} from '../config/settings';
import {
  getPullRequests,
  getCycleTimeData,
  getCodingTimeData,
  getReworkDataForPRs,
  getReviewEfficiencyDataForPRs,
  getPRSizeDataForPRs,
} from '../services/github';
import {
  calculateCycleTime,
  calculateCodingTime,
  calculateReworkRate,
  calculateReviewEfficiency,
  calculatePRSize,
} from '../utils/metrics';
import {
  ensureContainerInitialized,
  createDateRange,
  checkAuthConfigured,
  checkRepositoriesConfigured,
} from './helpers';
import type { GitHubPullRequest } from '../types';

// =============================================================================
// サイクルタイム詳細
// =============================================================================

/** サイクルタイムのIssue詳細を表示 */
export function showCycleTimeDetails(days = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (!checkAuthConfigured(getGitHubAuthMode())) {
    return;
  }
  if (!checkRepositoriesConfigured(config.github.repositories.length)) {
    return;
  }

  const token = getGitHubToken();
  const { startDateStr, endDateStr, period } = createDateRange(days);
  const productionPattern = getProductionBranchPattern();
  const labels = getCycleTimeIssueLabels();

  const result = getCycleTimeData(config.github.repositories, token, {
    dateRange: { start: startDateStr, end: endDateStr },
    productionBranchPattern: productionPattern,
    labels: labels.length > 0 ? labels : undefined,
  });

  if (!result.success || !result.data) {
    Logger.log(`❌ Failed to fetch cycle time data: ${result.error}`);
    return;
  }

  const metrics = calculateCycleTime(result.data, period);

  Logger.log(`\n📋 Issue Details (${metrics.completedTaskCount} issues with production merge):\n`);

  metrics.issueDetails.forEach((issue, i) => {
    const daysValue = (issue.cycleTimeHours / 24).toFixed(1);
    Logger.log(`${i + 1}. #${issue.issueNumber}: ${issue.title}`);
    Logger.log(`   Repository: ${issue.repository}`);
    Logger.log(`   Issue Created: ${issue.issueCreatedAt}`);
    Logger.log(`   Production Merged: ${issue.productionMergedAt}`);
    Logger.log(`   Cycle Time: ${issue.cycleTimeHours} hours (${daysValue} days)`);
    Logger.log(`   PR Chain: ${issue.prChainSummary}\n`);
  });
}

// =============================================================================
// コーディング時間詳細
// =============================================================================

/** コーディング時間のIssue詳細を表示 */
export function showCodingTimeDetails(days = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (!checkAuthConfigured(getGitHubAuthMode())) {
    return;
  }
  if (!checkRepositoriesConfigured(config.github.repositories.length)) {
    return;
  }

  const token = getGitHubToken();
  const { startDateStr, endDateStr, period } = createDateRange(days);
  const labels = getCodingTimeIssueLabels();

  const result = getCodingTimeData(config.github.repositories, token, {
    dateRange: { start: startDateStr, end: endDateStr },
    labels: labels.length > 0 ? labels : undefined,
  });

  if (!result.success || !result.data) {
    Logger.log(`❌ Failed to fetch coding time data: ${result.error}`);
    return;
  }

  const metrics = calculateCodingTime(result.data, period);

  Logger.log(`\n📋 Coding Time Details (${metrics.issueCount} issues with linked PRs):\n`);

  metrics.issueDetails.forEach((issue, i) => {
    const daysValue = (issue.codingTimeHours / 24).toFixed(1);
    Logger.log(`${i + 1}. #${issue.issueNumber}: ${issue.title}`);
    Logger.log(`   Repository: ${issue.repository}`);
    Logger.log(`   Issue Created: ${issue.issueCreatedAt}`);
    Logger.log(`   PR #${issue.prNumber} Created: ${issue.prCreatedAt}`);
    Logger.log(`   Coding Time: ${issue.codingTimeHours} hours (${daysValue} days)\n`);
  });
}

// =============================================================================
// PRベース指標の共通ヘルパー
// =============================================================================

function fetchMergedPRsForDebug(days: number): GitHubPullRequest[] | null {
  const config = getConfig();

  if (!checkAuthConfigured(getGitHubAuthMode())) {
    return null;
  }
  if (!checkRepositoriesConfigured(config.github.repositories.length)) {
    return null;
  }

  const token = getGitHubToken();
  const { startDate, endDate } = createDateRange(days);

  const allPRs: GitHubPullRequest[] = [];

  for (const repo of config.github.repositories) {
    const result = getPullRequests(repo, token, 'all', {
      since: startDate,
      until: endDate,
    });

    if (result.success && result.data) {
      const mergedPRs = result.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
    }
  }

  return allPRs;
}

// =============================================================================
// 手戻り率詳細
// =============================================================================

/** 手戻り率のPR詳細を表示 */
export function showReworkRateDetails(days = 30): void {
  ensureContainerInitialized();

  const allPRs = fetchMergedPRsForDebug(days);
  if (!allPRs || allPRs.length === 0) {
    return;
  }

  const token = getGitHubToken();
  const reworkData = getReworkDataForPRs(allPRs, token);
  const { period } = createDateRange(days);
  const metrics = calculateReworkRate(reworkData, period);

  Logger.log(`\n📋 Rework Rate Details (${metrics.prCount} PRs):\n`);

  metrics.prDetails.forEach((pr, i) => {
    Logger.log(`${i + 1}. PR #${pr.prNumber}: ${pr.title}`);
    Logger.log(`   Repository: ${pr.repository}`);
    Logger.log(`   Commits: ${pr.totalCommits} total, ${pr.additionalCommits} additional`);
    Logger.log(`   Force Pushes: ${pr.forcePushCount}\n`);
  });
}

// =============================================================================
// レビュー効率詳細
// =============================================================================

/** レビュー効率のPR詳細を表示 */
export function showReviewEfficiencyDetails(days = 30): void {
  ensureContainerInitialized();

  const allPRs = fetchMergedPRsForDebug(days);
  if (!allPRs || allPRs.length === 0) {
    return;
  }

  const token = getGitHubToken();
  const reviewData = getReviewEfficiencyDataForPRs(allPRs, token);
  const { period } = createDateRange(days);
  const metrics = calculateReviewEfficiency(reviewData, period);

  Logger.log(`\n📋 Review Efficiency Details (${metrics.prCount} PRs):\n`);

  metrics.prDetails.forEach((pr, i) => {
    Logger.log(`${i + 1}. PR #${pr.prNumber}: ${pr.title}`);
    Logger.log(`   Repository: ${pr.repository}`);
    Logger.log(`   Ready for Review: ${pr.readyForReviewAt}`);
    Logger.log(`   First Review: ${pr.firstReviewAt ?? 'N/A'}`);
    Logger.log(`   Approved: ${pr.approvedAt ?? 'N/A'}`);
    Logger.log(`   Merged: ${pr.mergedAt ?? 'Not merged'}`);
    Logger.log(`   Time to First Review: ${pr.timeToFirstReviewHours ?? 'N/A'}h`);
    Logger.log(`   Review Duration: ${pr.reviewDurationHours ?? 'N/A'}h`);
    Logger.log(`   Time to Merge: ${pr.timeToMergeHours ?? 'N/A'}h`);
    Logger.log(`   Total Time: ${pr.totalTimeHours ?? 'N/A'}h\n`);
  });
}

// =============================================================================
// PRサイズ詳細
// =============================================================================

/** PRサイズの詳細を表示 */
export function showPRSizeDetails(days = 30): void {
  ensureContainerInitialized();

  const allPRs = fetchMergedPRsForDebug(days);
  if (!allPRs || allPRs.length === 0) {
    return;
  }

  const token = getGitHubToken();
  const sizeData = getPRSizeDataForPRs(allPRs, token);
  const { period } = createDateRange(days);
  const metrics = calculatePRSize(sizeData, period);

  Logger.log(`\n📋 PR Size Details (${metrics.prCount} PRs):\n`);

  metrics.prDetails.forEach((pr, i) => {
    Logger.log(`${i + 1}. PR #${pr.prNumber}: ${pr.title}`);
    Logger.log(`   Repository: ${pr.repository}`);
    Logger.log(`   Lines of Code: ${pr.linesOfCode} (+${pr.additions}/-${pr.deletions})`);
    Logger.log(`   Files Changed: ${pr.filesChanged}`);
    Logger.log(`   Merged: ${pr.mergedAt ?? 'Not merged'}\n`);
  });
}
