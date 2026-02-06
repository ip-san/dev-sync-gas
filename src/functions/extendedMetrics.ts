/**
 * 拡張指標同期関数モジュール
 *
 * サイクルタイム、コーディング時間、手戻り率、レビュー効率、PRサイズなど
 * DORA Four Key Metrics以外の拡張指標を提供。
 *
 * GraphQL APIを使用してAPI呼び出し回数を削減。
 */

import { getConfig, getGitHubToken, getGitHubAuthMode } from '../config/settings';
import {
  getProductionBranchPattern,
  getCycleTimeIssueLabels,
  getCodingTimeIssueLabels,
  getExcludePRSizeBaseBranches,
  getExcludeReviewEfficiencyBaseBranches,
  getExcludeCycleTimeBaseBranches,
  getExcludeCodingTimeBaseBranches,
  getExcludeReworkRateBaseBranches,
} from '../config/settings';
import {
  getPullRequestsGraphQL,
  getCycleTimeDataGraphQL,
  getCodingTimeDataGraphQL,
  getReworkDataForPRsGraphQL,
  getReviewEfficiencyDataForPRsGraphQL,
  getPRSizeDataForPRsGraphQL,
} from '../services/github';
import {
  writeCycleTimeToSheet,
  writeCodingTimeToSheet,
  writeReworkRateToSheet,
  writeReviewEfficiencyToSheet,
  writePRSizeToSheet,
} from '../services/spreadsheet';
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
// サイクルタイム
// =============================================================================

/**
 * サイクルタイムを計算してスプレッドシートに書き出す
 *
 * サイクルタイム = Issue作成 → productionマージ
 */
export function syncCycleTime(days = 30): void {
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
  const excludeBaseBranches = getExcludeCycleTimeBaseBranches();

  Logger.log(`⏱️ Calculating Cycle Time for ${days} days`);
  Logger.log(`   Period: ${period}`);
  Logger.log(`   Production branch pattern: "${productionPattern}"`);
  Logger.log(
    labels.length > 0 ? `   Issue labels: ${labels.join(', ')}` : `   Issue labels: (all issues)`
  );
  if (excludeBaseBranches.length > 0) {
    Logger.log(
      `   ⚠️ Exclude base branches configured (${excludeBaseBranches.join(', ')}) but not yet implemented - requires GraphQL query modification`
    );
  }

  Logger.log(`🚀 Using GraphQL API`);

  // TODO: excludeBaseBranches filtering requires GraphQL query modification
  // to filter issues based on their linked PR's base branch
  const result = getCycleTimeDataGraphQL(config.github.repositories, token, {
    dateRange: { start: startDateStr, end: endDateStr },
    productionBranchPattern: productionPattern,
    labels: labels.length > 0 ? labels : undefined,
  });

  if (!result.success || !result.data) {
    Logger.log(`❌ Failed to fetch cycle time data: ${result.error}`);
    return;
  }

  Logger.log(`📥 Fetched ${result.data.length} issues`);

  const metrics = calculateCycleTime(result.data, period);

  Logger.log(`📊 Cycle Time Results:`);
  Logger.log(`   Issues with production merge: ${metrics.completedTaskCount}`);
  if (metrics.avgCycleTimeHours !== null) {
    const avgDays = (metrics.avgCycleTimeHours / 24).toFixed(1);
    Logger.log(`   Average: ${metrics.avgCycleTimeHours} hours (${avgDays} days)`);
    Logger.log(`   Median: ${metrics.medianCycleTimeHours} hours`);
  }

  writeCycleTimeToSheet(config.spreadsheet.id, metrics);
  Logger.log('✅ Cycle Time metrics synced');
}

// =============================================================================
// コーディング時間
// =============================================================================

/**
 * コーディング時間を計算してスプレッドシートに書き出す
 *
 * コーディング時間 = Issue作成 → PR作成
 */
export function syncCodingTime(days = 30): void {
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
  const excludeBaseBranches = getExcludeCodingTimeBaseBranches();

  Logger.log(`⌨️ Calculating Coding Time for ${days} days`);
  Logger.log(`   Period: ${period}`);
  Logger.log(
    labels.length > 0 ? `   Issue labels: ${labels.join(', ')}` : `   Issue labels: (all issues)`
  );
  if (excludeBaseBranches.length > 0) {
    Logger.log(
      `   ⚠️ Exclude base branches configured (${excludeBaseBranches.join(', ')}) but not yet implemented - requires GraphQL query modification`
    );
  }

  Logger.log(`🚀 Using GraphQL API`);

  // TODO: excludeBaseBranches filtering requires GraphQL query modification
  // to filter issues based on their linked PR's base branch
  const result = getCodingTimeDataGraphQL(config.github.repositories, token, {
    dateRange: { start: startDateStr, end: endDateStr },
    labels: labels.length > 0 ? labels : undefined,
  });

  if (!result.success || !result.data) {
    Logger.log(`❌ Failed to fetch coding time data: ${result.error}`);
    return;
  }

  Logger.log(`📥 Fetched ${result.data.length} issues`);

  const metrics = calculateCodingTime(result.data, period);

  Logger.log(`📊 Coding Time Results:`);
  Logger.log(`   Issues with linked PRs: ${metrics.issueCount}`);
  if (metrics.avgCodingTimeHours !== null) {
    const avgDays = (metrics.avgCodingTimeHours / 24).toFixed(1);
    Logger.log(`   Average: ${metrics.avgCodingTimeHours} hours (${avgDays} days)`);
    Logger.log(`   Median: ${metrics.medianCodingTimeHours} hours`);
  }

  writeCodingTimeToSheet(config.spreadsheet.id, metrics);
  Logger.log('✅ Coding Time metrics synced');
}

// =============================================================================
// PRベース指標の共通ヘルパー
// =============================================================================

/**
 * 期間内のマージ済みPRを全リポジトリから取得
 */
function fetchMergedPRs(days: number): GitHubPullRequest[] | null {
  const config = getConfig();

  if (!checkAuthConfigured(getGitHubAuthMode())) {
    return null;
  }
  if (!checkRepositoriesConfigured(config.github.repositories.length)) {
    return null;
  }

  const token = getGitHubToken();
  const { startDate, endDate } = createDateRange(days);

  Logger.log(`🚀 Using GraphQL API`);

  const allPRs: GitHubPullRequest[] = [];

  for (const repo of config.github.repositories) {
    Logger.log(`📡 Fetching PRs from ${repo.fullName}...`);
    const result = getPullRequestsGraphQL({
      repo,
      token,
      state: 'all',
      dateRange: {
        since: startDate,
        until: endDate,
      },
    });

    if (result.success && result.data) {
      const mergedPRs = result.data.filter((pr: GitHubPullRequest) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
      Logger.log(`   Found ${mergedPRs.length} merged PRs`);
    } else {
      Logger.log(`   ⚠️ Failed to fetch PRs: ${result.error}`);
    }
  }

  if (allPRs.length === 0) {
    Logger.log('⚠️ No merged PRs found in the period');
    return null;
  }

  return allPRs;
}

// =============================================================================
// 手戻り率
// =============================================================================

/**
 * 手戻り率を計算してスプレッドシートに書き出す
 *
 * 手戻り率 = PR作成後の追加コミット数 / Force Push回数
 */
export function syncReworkRate(days = 30): void {
  ensureContainerInitialized();

  const { period } = createDateRange(days);
  Logger.log(`🔄 Calculating Rework Rate for ${days} days`);
  Logger.log(`   Period: ${period}`);

  const allPRs = fetchMergedPRs(days);
  if (!allPRs) {
    return;
  }

  // 除外ブランチ設定を取得してフィルタリング（部分一致）
  const excludeBaseBranches = getExcludeReworkRateBaseBranches();
  let filteredPRs = allPRs;

  if (excludeBaseBranches.length > 0) {
    const beforeCount = allPRs.length;
    filteredPRs = allPRs.filter((pr) => {
      // baseBranchが存在しない、または除外パターンのいずれも含まない場合は含める
      if (!pr.baseBranch) {
        return true;
      }
      return !excludeBaseBranches.some((pattern) => pr.baseBranch!.includes(pattern));
    });
    const excludedCount = beforeCount - filteredPRs.length;
    Logger.log(
      `   Excluded ${excludedCount} PRs with base branches containing: ${excludeBaseBranches.join(', ')}`
    );
  }

  if (filteredPRs.length === 0) {
    Logger.log('⚠️ No PRs remaining after filtering');
    return;
  }

  Logger.log(`📊 Fetching rework data for ${filteredPRs.length} PRs...`);
  const token = getGitHubToken();
  const reworkData = getReworkDataForPRsGraphQL(filteredPRs, token);

  const metrics = calculateReworkRate(reworkData, period);

  Logger.log(`📊 Rework Rate Results:`);
  Logger.log(`   PRs analyzed: ${metrics.prCount}`);
  Logger.log(
    `   Additional Commits: total=${metrics.additionalCommits.total}, avg=${metrics.additionalCommits.avgPerPr}`
  );
  Logger.log(
    `   Force Pushes: total=${metrics.forcePushes.total}, rate=${metrics.forcePushes.forcePushRate}%`
  );

  const config = getConfig();
  writeReworkRateToSheet(config.spreadsheet.id, metrics);
  Logger.log('✅ Rework Rate metrics synced');
}

// =============================================================================
// レビュー効率
// =============================================================================

/**
 * レビュー効率を計算してスプレッドシートに書き出す
 *
 * レビュー効率 = PRの各フェーズでの滞留時間
 */
export function syncReviewEfficiency(days = 30): void {
  ensureContainerInitialized();

  const { period } = createDateRange(days);
  Logger.log(`⏱️ Calculating Review Efficiency for ${days} days`);
  Logger.log(`   Period: ${period}`);

  const allPRs = fetchMergedPRs(days);
  if (!allPRs) {
    return;
  }

  // 除外ブランチ設定を取得してフィルタリング（部分一致）
  const excludeBaseBranches = getExcludeReviewEfficiencyBaseBranches();
  let filteredPRs = allPRs;

  if (excludeBaseBranches.length > 0) {
    const beforeCount = allPRs.length;
    filteredPRs = allPRs.filter((pr) => {
      // baseBranchが存在しない、または除外パターンのいずれも含まない場合は含める
      if (!pr.baseBranch) {
        return true;
      }
      return !excludeBaseBranches.some((pattern) => pr.baseBranch!.includes(pattern));
    });
    const excludedCount = beforeCount - filteredPRs.length;
    Logger.log(
      `   Excluded ${excludedCount} PRs with base branches containing: ${excludeBaseBranches.join(', ')}`
    );
  }

  if (filteredPRs.length === 0) {
    Logger.log('⚠️ No PRs remaining after filtering');
    return;
  }

  Logger.log(`📊 Fetching review data for ${filteredPRs.length} PRs...`);
  const token = getGitHubToken();
  const reviewData = getReviewEfficiencyDataForPRsGraphQL(filteredPRs, token);

  const metrics = calculateReviewEfficiency(reviewData, period);

  Logger.log(`📊 Review Efficiency Results:`);
  Logger.log(`   PRs analyzed: ${metrics.prCount}`);
  Logger.log(`   Time to First Review: avg=${metrics.timeToFirstReview.avgHours}h`);
  Logger.log(`   Review Duration: avg=${metrics.reviewDuration.avgHours}h`);
  Logger.log(`   Total Time: avg=${metrics.totalTime.avgHours}h`);

  const config = getConfig();
  writeReviewEfficiencyToSheet(config.spreadsheet.id, metrics);
  Logger.log('✅ Review Efficiency metrics synced');
}

// =============================================================================
// PRサイズ
// =============================================================================

/**
 * PRサイズを計算してスプレッドシートに書き出す
 *
 * PRサイズ = 変更行数（additions + deletions）と変更ファイル数
 */
export function syncPRSize(days = 30): void {
  ensureContainerInitialized();

  const { period } = createDateRange(days);
  Logger.log(`📏 Calculating PR Size for ${days} days`);
  Logger.log(`   Period: ${period}`);

  const allPRs = fetchMergedPRs(days);
  if (!allPRs) {
    return;
  }

  // 除外ブランチ設定を取得してフィルタリング（部分一致）
  const excludeBaseBranches = getExcludePRSizeBaseBranches();
  let filteredPRs = allPRs;

  if (excludeBaseBranches.length > 0) {
    const beforeCount = allPRs.length;
    filteredPRs = allPRs.filter((pr) => {
      // baseBranchが存在しない、または除外パターンのいずれも含まない場合は含める
      if (!pr.baseBranch) {
        return true;
      }
      return !excludeBaseBranches.some((pattern) => pr.baseBranch!.includes(pattern));
    });
    const excludedCount = beforeCount - filteredPRs.length;
    Logger.log(
      `   Excluded ${excludedCount} PRs with base branches containing: ${excludeBaseBranches.join(', ')}`
    );
  }

  if (filteredPRs.length === 0) {
    Logger.log('⚠️ No PRs remaining after filtering');
    return;
  }

  Logger.log(`📊 Fetching PR size data for ${filteredPRs.length} PRs...`);
  const token = getGitHubToken();
  const sizeData = getPRSizeDataForPRsGraphQL(filteredPRs, token);

  const metrics = calculatePRSize(sizeData, period);

  Logger.log(`📊 PR Size Results:`);
  Logger.log(`   PRs analyzed: ${metrics.prCount}`);
  Logger.log(
    `   Lines of Code: total=${metrics.linesOfCode.total}, avg=${metrics.linesOfCode.avg}`
  );
  Logger.log(
    `   Files Changed: total=${metrics.filesChanged.total}, avg=${metrics.filesChanged.avg}`
  );

  const config = getConfig();
  writePRSizeToSheet(config.spreadsheet.id, metrics);
  Logger.log('✅ PR Size metrics synced');
}
