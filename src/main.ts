import { getConfig, setConfig, addRepository, removeRepository, getGitHubToken, getGitHubAuthMode } from "./config/settings";
import "./init";
import { getAllRepositoriesData, DateRange, getPullRequestsForTasks, getPullRequests, getReworkDataForPRs, getReviewEfficiencyDataForPRs, getPRSizeDataForPRs } from "./services/github";
import { getTasksForCycleTime, getTasksForCodingTime, getTasksForSatisfaction } from "./services/notion";
import { writeMetricsToSheet, clearOldData, createSummarySheet, writeCycleTimeToSheet, writeCodingTimeToSheet, writeReworkRateToSheet, writeReviewEfficiencyToSheet, writePRSizeToSheet, writeDeveloperSatisfactionToSheet } from "./services/spreadsheet";
import { calculateMetricsForRepository, calculateCycleTime, calculateCodingTime, calculateReworkRate, calculateReviewEfficiency, calculatePRSize, calculateDeveloperSatisfaction } from "./utils/metrics";
import { initializeContainer, isContainerInitialized, getContainer } from "./container";
import { createGasAdapters } from "./adapters/gas";
import type { DevOpsMetrics, CycleTimeMetrics, GitHubPullRequest } from "./types";
import { ALL_SCHEMAS, findSchemaBySheetName } from "./schemas";
import { getMigrationPreview, migrateSheetSchema, updateSheetHeadersOnly, logMigrationPreview, logMigrationResult, logMigrationSummary, logBackupCleanupInstructions } from "./services/migration";

// GAS環境でコンテナを初期化
function ensureContainerInitialized(): void {
  if (!isContainerInitialized()) {
    initializeContainer(createGasAdapters());
  }
}

/**
 * メイン実行関数 - DevOps指標を収集してスプレッドシートに書き出す
 */
function syncDevOpsMetrics(dateRange?: DateRange): void {
  ensureContainerInitialized();
  const config = getConfig();

  Logger.log(`📊 Repositories: ${config.github.repositories.length}`);
  config.github.repositories.forEach((repo) => {
    Logger.log(`  - ${repo.fullName}`);
  });

  if (dateRange) {
    Logger.log(`📅 Date range: ${dateRange.since?.toISOString()} ~ ${dateRange.until?.toISOString()}`);
  }

  const token = getGitHubToken();
  const { pullRequests, workflowRuns, deployments } = getAllRepositoriesData(
    config.github.repositories,
    token,
    { dateRange }
  );

  Logger.log(`📥 Fetched ${pullRequests.length} PRs, ${workflowRuns.length} workflow runs, ${deployments.length} deployments`);

  const metrics: DevOpsMetrics[] = config.github.repositories.map((repo) =>
    calculateMetricsForRepository(repo.fullName, pullRequests, workflowRuns, deployments)
  );

  Logger.log(`📈 Calculated ${metrics.length} metrics`);

  writeMetricsToSheet(config.spreadsheet.id, config.spreadsheet.sheetName, metrics);

  Logger.log(`✅ Synced metrics for ${metrics.length} repositories`);
}

/**
 * 過去N日分のメトリクスを取得
 */
function syncHistoricalMetrics(days: number): void {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);

  Logger.log(`📅 Fetching metrics for the last ${days} days`);
  Logger.log(`   From: ${since.toISOString()}`);
  Logger.log(`   To: ${until.toISOString()}`);

  syncDevOpsMetrics({ since, until });
}

/**
 * 過去30日分を取得
 */
function syncLast30Days(): void {
  syncHistoricalMetrics(30);
}

/**
 * 過去90日分を取得
 */
function syncLast90Days(): void {
  syncHistoricalMetrics(90);
}

/**
 * 日次実行用トリガー設定
 */
function createDailyTrigger(): void {
  ensureContainerInitialized();
  const { triggerClient, logger } = getContainer();

  // 既存のトリガーを削除
  const triggers = triggerClient.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "syncDevOpsMetrics") {
      triggerClient.deleteTrigger(trigger);
    }
  }

  // 毎日午前9時に実行
  triggerClient.newTrigger("syncDevOpsMetrics")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  logger.log("✅ Daily trigger created for 9:00 AM");
}

/**
 * 初期セットアップ（PAT認証） - スクリプトプロパティを設定
 * notionToken, notionDatabaseId はオプショナル
 */
function setup(
  githubToken: string,
  spreadsheetId: string,
  notionToken?: string,
  notionDatabaseId?: string
): void {
  ensureContainerInitialized();
  setConfig({
    github: { token: githubToken, repositories: [] },
    notion: { token: notionToken || "", databaseId: notionDatabaseId || "" },
    spreadsheet: { id: spreadsheetId, sheetName: "DevOps Metrics" },
  });

  Logger.log("✅ Configuration saved (PAT auth). Add repositories with addRepo()");
}

/**
 * GitHub Apps認証用セットアップ
 *
 * @param appId - GitHub App ID
 * @param privateKey - Private Key（PEM形式、改行は\nで）
 * @param installationId - Installation ID
 * @param spreadsheetId - Google Spreadsheet ID
 * @param notionToken - Notion Token（オプション）
 * @param notionDatabaseId - Notion Database ID（オプション）
 */
function setupWithGitHubApp(
  appId: string,
  privateKey: string,
  installationId: string,
  spreadsheetId: string,
  notionToken?: string,
  notionDatabaseId?: string
): void {
  ensureContainerInitialized();
  setConfig({
    github: {
      appConfig: { appId, privateKey, installationId },
      repositories: [],
    },
    notion: { token: notionToken || "", databaseId: notionDatabaseId || "" },
    spreadsheet: { id: spreadsheetId, sheetName: "DevOps Metrics" },
  });

  Logger.log("✅ Configuration saved (GitHub App auth). Add repositories with addRepo()");
}

/**
 * 現在の認証モードを表示
 */
function showAuthMode(): void {
  ensureContainerInitialized();
  const mode = getGitHubAuthMode();

  if (mode === "app") {
    Logger.log("🔐 Current auth mode: GitHub App");
  } else if (mode === "pat") {
    Logger.log("🔐 Current auth mode: Personal Access Token (PAT)");
  } else {
    Logger.log("⚠️ GitHub authentication is not configured");
  }
}

/**
 * リポジトリ追加のラッパー
 */
function addRepo(owner: string, name: string): void {
  ensureContainerInitialized();
  addRepository(owner, name);
  Logger.log(`✅ Added repository: ${owner}/${name}`);
}

/**
 * リポジトリ削除のラッパー
 */
function removeRepo(fullName: string): void {
  ensureContainerInitialized();
  removeRepository(fullName);
  Logger.log(`✅ Removed repository: ${fullName}`);
}

/**
 * 登録済みリポジトリ一覧を表示
 */
function listRepos(): void {
  ensureContainerInitialized();
  const config = getConfig();
  Logger.log("Registered repositories:");
  config.github.repositories.forEach((repo, i) => {
    Logger.log(`  ${i + 1}. ${repo.fullName}`);
  });
}

/**
 * 古いデータのクリーンアップ
 */
function cleanup(daysToKeep = 90): void {
  ensureContainerInitialized();
  const config = getConfig();
  clearOldData(config.spreadsheet.id, config.spreadsheet.sheetName, daysToKeep);
  Logger.log(`✅ Cleaned up data older than ${daysToKeep} days`);
}

/**
 * サマリーシートを作成
 */
function generateSummary(): void {
  ensureContainerInitialized();
  const config = getConfig();
  createSummarySheet(config.spreadsheet.id, config.spreadsheet.sheetName);
  Logger.log("✅ Summary sheet created");
}

/**
 * サイクルタイムを計算してスプレッドシートに書き出す
 *
 * 定義: 着手（Notion）から完了（Notion）までの時間
 * 仕様理解から実装完了までの効率を測定する指標
 *
 * @param days - 計測期間（日数）デフォルト30日
 * @param completedDateProperty - Notionの完了日プロパティ名（デフォルト: "Date Done"）
 */
function syncCycleTime(days: number = 30, completedDateProperty: string = "Date Done"): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (!config.notion.token || !config.notion.databaseId) {
    Logger.log("⚠️ Notion integration is not configured. Set notionToken and notionDatabaseId in setup()");
    return;
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const period = `${startDateStr}〜${endDateStr}`;

  Logger.log(`⏱️ Calculating Cycle Time for ${days} days`);
  Logger.log(`   Period: ${period}`);

  const tasksResult = getTasksForCycleTime(
    config.notion.databaseId,
    config.notion.token,
    startDateStr,
    endDateStr,
    completedDateProperty
  );

  if (!tasksResult.success || !tasksResult.data) {
    Logger.log(`❌ Failed to fetch tasks: ${tasksResult.error}`);
    return;
  }

  Logger.log(`📥 Fetched ${tasksResult.data.length} tasks with cycle time data`);

  const cycleTimeMetrics = calculateCycleTime(tasksResult.data, period);

  Logger.log(`📊 Cycle Time Results:`);
  Logger.log(`   Completed tasks: ${cycleTimeMetrics.completedTaskCount}`);
  if (cycleTimeMetrics.avgCycleTimeHours !== null) {
    Logger.log(`   Average: ${cycleTimeMetrics.avgCycleTimeHours} hours (${(cycleTimeMetrics.avgCycleTimeHours / 24).toFixed(1)} days)`);
    Logger.log(`   Median: ${cycleTimeMetrics.medianCycleTimeHours} hours`);
    Logger.log(`   Min: ${cycleTimeMetrics.minCycleTimeHours} hours`);
    Logger.log(`   Max: ${cycleTimeMetrics.maxCycleTimeHours} hours`);
  }

  writeCycleTimeToSheet(config.spreadsheet.id, cycleTimeMetrics);

  Logger.log("✅ Cycle Time metrics synced");
}

/**
 * サイクルタイムのタスク詳細を表示（デバッグ用）
 */
function showCycleTimeDetails(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (!config.notion.token || !config.notion.databaseId) {
    Logger.log("⚠️ Notion integration is not configured");
    return;
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  const tasksResult = getTasksForCycleTime(
    config.notion.databaseId,
    config.notion.token,
    startDateStr,
    endDateStr
  );

  if (!tasksResult.success || !tasksResult.data) {
    Logger.log(`❌ Failed to fetch tasks: ${tasksResult.error}`);
    return;
  }

  const cycleTimeMetrics = calculateCycleTime(tasksResult.data, `${startDateStr}〜${endDateStr}`);

  Logger.log(`\n📋 Task Details (${cycleTimeMetrics.completedTaskCount} tasks):\n`);
  cycleTimeMetrics.taskDetails.forEach((task, i) => {
    const daysValue = (task.cycleTimeHours / 24).toFixed(1);
    Logger.log(`${i + 1}. ${task.title}`);
    Logger.log(`   Started: ${task.startedAt} → Completed: ${task.completedAt}`);
    Logger.log(`   Cycle Time: ${task.cycleTimeHours} hours (${daysValue} days)\n`);
  });
}

/**
 * コーディング時間を計算してスプレッドシートに書き出す
 *
 * 定義: 着手（Notion進行中）からPR作成（GitHub）までの時間
 * 純粋なコーディング作業にかかった時間を測定
 *
 * @param startedDateProperty - Notionの着手日プロパティ名（デフォルト: "Date Started"）
 */
function syncCodingTime(startedDateProperty: string = "Date Started"): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (!config.notion.token || !config.notion.databaseId) {
    Logger.log("⚠️ Notion integration is not configured. Set notionToken and notionDatabaseId in setup()");
    return;
  }

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured. Set githubToken in setup() or configure GitHub App");
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const period = `〜${today}`;

  Logger.log(`⌨️ Calculating Coding Time`);

  // Notionから着手日とPR URLがあるタスクを取得
  const tasksResult = getTasksForCodingTime(
    config.notion.databaseId,
    config.notion.token,
    startedDateProperty
  );

  if (!tasksResult.success || !tasksResult.data) {
    Logger.log(`❌ Failed to fetch tasks: ${tasksResult.error}`);
    return;
  }

  Logger.log(`📥 Fetched ${tasksResult.data.length} tasks with PR URLs`);

  if (tasksResult.data.length === 0) {
    Logger.log("⚠️ No tasks with PR URLs found");
    return;
  }

  // GitHubからPR情報を取得
  const token = getGitHubToken();
  Logger.log(`📡 Fetching PR information from GitHub...`);
  const prMap = getPullRequestsForTasks(tasksResult.data, token);
  Logger.log(`   Found ${prMap.size} PRs`);

  // コーディング時間を計算
  const codingTimeMetrics = calculateCodingTime(tasksResult.data, prMap, period);

  Logger.log(`📊 Coding Time Results:`);
  Logger.log(`   Tasks with valid coding time: ${codingTimeMetrics.taskCount}`);
  if (codingTimeMetrics.avgCodingTimeHours !== null) {
    Logger.log(`   Average: ${codingTimeMetrics.avgCodingTimeHours} hours (${(codingTimeMetrics.avgCodingTimeHours / 24).toFixed(1)} days)`);
    Logger.log(`   Median: ${codingTimeMetrics.medianCodingTimeHours} hours`);
    Logger.log(`   Min: ${codingTimeMetrics.minCodingTimeHours} hours`);
    Logger.log(`   Max: ${codingTimeMetrics.maxCodingTimeHours} hours`);
  }

  writeCodingTimeToSheet(config.spreadsheet.id, codingTimeMetrics);

  Logger.log("✅ Coding Time metrics synced");
}

/**
 * コーディング時間のタスク詳細を表示（デバッグ用）
 */
function showCodingTimeDetails(): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (!config.notion.token || !config.notion.databaseId) {
    Logger.log("⚠️ Notion integration is not configured");
    return;
  }

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured");
    return;
  }

  const tasksResult = getTasksForCodingTime(
    config.notion.databaseId,
    config.notion.token
  );

  if (!tasksResult.success || !tasksResult.data) {
    Logger.log(`❌ Failed to fetch tasks: ${tasksResult.error}`);
    return;
  }

  const token = getGitHubToken();
  const prMap = getPullRequestsForTasks(tasksResult.data, token);
  const codingTimeMetrics = calculateCodingTime(tasksResult.data, prMap, "");

  Logger.log(`\n📋 Coding Time Details (${codingTimeMetrics.taskCount} tasks):\n`);
  codingTimeMetrics.taskDetails.forEach((task, i) => {
    const daysValue = (task.codingTimeHours / 24).toFixed(1);
    Logger.log(`${i + 1}. ${task.title}`);
    Logger.log(`   Started: ${task.startedAt} → PR Created: ${task.prCreatedAt}`);
    Logger.log(`   Coding Time: ${task.codingTimeHours} hours (${daysValue} days)`);
    Logger.log(`   PR: ${task.prUrl}\n`);
  });
}

/**
 * 手戻り率を計算してスプレッドシートに書き出す
 *
 * 定義: PR作成後の追加コミット数とForce Push回数
 * コードレビューでの指摘対応やコード品質の指標
 *
 * @param days - 計測期間（日数）デフォルト30日
 */
function syncReworkRate(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured. Set githubToken in setup() or configure GitHub App");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured. Add repositories with addRepo()");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const period = `${startDateStr}〜${endDateStr}`;

  Logger.log(`🔄 Calculating Rework Rate for ${days} days`);
  Logger.log(`   Period: ${period}`);

  // 全リポジトリからPRを取得
  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    Logger.log(`📡 Fetching PRs from ${repo.fullName}...`);
    const prsResult = getPullRequests(repo, token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      // マージ済みPRのみを対象とする
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
      Logger.log(`   Found ${mergedPRs.length} merged PRs`);
    } else {
      Logger.log(`   ⚠️ Failed to fetch PRs: ${prsResult.error}`);
    }
  }

  if (allPRs.length === 0) {
    Logger.log("⚠️ No merged PRs found in the period");
    return;
  }

  Logger.log(`📊 Fetching rework data for ${allPRs.length} PRs...`);
  const reworkData = getReworkDataForPRs(allPRs, token);

  const reworkMetrics = calculateReworkRate(reworkData, period);

  Logger.log(`📊 Rework Rate Results:`);
  Logger.log(`   PRs analyzed: ${reworkMetrics.prCount}`);
  Logger.log(`   Additional Commits: total=${reworkMetrics.additionalCommits.total}, avg=${reworkMetrics.additionalCommits.avgPerPr}`);
  Logger.log(`   Force Pushes: total=${reworkMetrics.forcePushes.total}, rate=${reworkMetrics.forcePushes.forcePushRate}%`);

  writeReworkRateToSheet(config.spreadsheet.id, reworkMetrics);

  Logger.log("✅ Rework Rate metrics synced");
}

/**
 * 手戻り率のPR詳細を表示（デバッグ用）
 */
function showReworkRateDetails(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    const prsResult = getPullRequests(repo, token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
    }
  }

  const reworkData = getReworkDataForPRs(allPRs, token);
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const reworkMetrics = calculateReworkRate(reworkData, `${startDateStr}〜${endDateStr}`);

  Logger.log(`\n📋 Rework Rate Details (${reworkMetrics.prCount} PRs):\n`);
  reworkMetrics.prDetails.forEach((pr, i) => {
    Logger.log(`${i + 1}. PR #${pr.prNumber}: ${pr.title}`);
    Logger.log(`   Repository: ${pr.repository}`);
    Logger.log(`   Commits: ${pr.totalCommits} total, ${pr.additionalCommits} additional`);
    Logger.log(`   Force Pushes: ${pr.forcePushCount}\n`);
  });
}

/**
 * レビュー効率を計算してスプレッドシートに書き出す
 *
 * 定義: PRの各フェーズでの滞留時間
 * - レビュー待ち時間: Ready for Review → 最初のレビュー
 * - レビュー時間: 最初のレビュー → 承認（長い = コードが難解な可能性）
 * - マージ待ち時間: 承認 → マージ
 *
 * @param days - 計測期間（日数）デフォルト30日
 */
function syncReviewEfficiency(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured. Set githubToken in setup() or configure GitHub App");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured. Add repositories with addRepo()");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const period = `${startDateStr}〜${endDateStr}`;

  Logger.log(`⏱️ Calculating Review Efficiency for ${days} days`);
  Logger.log(`   Period: ${period}`);

  // 全リポジトリからPRを取得
  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    Logger.log(`📡 Fetching PRs from ${repo.fullName}...`);
    const prsResult = getPullRequests(repo, token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      // マージ済みPRのみを対象とする
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
      Logger.log(`   Found ${mergedPRs.length} merged PRs`);
    } else {
      Logger.log(`   ⚠️ Failed to fetch PRs: ${prsResult.error}`);
    }
  }

  if (allPRs.length === 0) {
    Logger.log("⚠️ No merged PRs found in the period");
    return;
  }

  Logger.log(`📊 Fetching review data for ${allPRs.length} PRs...`);
  const reviewData = getReviewEfficiencyDataForPRs(allPRs, token);

  const reviewMetrics = calculateReviewEfficiency(reviewData, period);

  Logger.log(`📊 Review Efficiency Results:`);
  Logger.log(`   PRs analyzed: ${reviewMetrics.prCount}`);
  Logger.log(`   Time to First Review: avg=${reviewMetrics.timeToFirstReview.avgHours}h, median=${reviewMetrics.timeToFirstReview.medianHours}h`);
  Logger.log(`   Review Duration: avg=${reviewMetrics.reviewDuration.avgHours}h, median=${reviewMetrics.reviewDuration.medianHours}h`);
  Logger.log(`   Time to Merge: avg=${reviewMetrics.timeToMerge.avgHours}h, median=${reviewMetrics.timeToMerge.medianHours}h`);
  Logger.log(`   Total Time: avg=${reviewMetrics.totalTime.avgHours}h, median=${reviewMetrics.totalTime.medianHours}h`);

  writeReviewEfficiencyToSheet(config.spreadsheet.id, reviewMetrics);

  Logger.log("✅ Review Efficiency metrics synced");
}

/**
 * レビュー効率のPR詳細を表示（デバッグ用）
 */
function showReviewEfficiencyDetails(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    const prsResult = getPullRequests(repo, token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
    }
  }

  const reviewData = getReviewEfficiencyDataForPRs(allPRs, token);
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const reviewMetrics = calculateReviewEfficiency(reviewData, `${startDateStr}〜${endDateStr}`);

  Logger.log(`\n📋 Review Efficiency Details (${reviewMetrics.prCount} PRs):\n`);
  reviewMetrics.prDetails.forEach((pr, i) => {
    Logger.log(`${i + 1}. PR #${pr.prNumber}: ${pr.title}`);
    Logger.log(`   Repository: ${pr.repository}`);
    Logger.log(`   Ready for Review: ${pr.readyForReviewAt}`);
    Logger.log(`   First Review: ${pr.firstReviewAt ?? "N/A"}`);
    Logger.log(`   Approved: ${pr.approvedAt ?? "N/A"}`);
    Logger.log(`   Merged: ${pr.mergedAt ?? "Not merged"}`);
    Logger.log(`   Time to First Review: ${pr.timeToFirstReviewHours ?? "N/A"}h`);
    Logger.log(`   Review Duration: ${pr.reviewDurationHours ?? "N/A"}h`);
    Logger.log(`   Time to Merge: ${pr.timeToMergeHours ?? "N/A"}h`);
    Logger.log(`   Total Time: ${pr.totalTimeHours ?? "N/A"}h\n`);
  });
}

/**
 * PRサイズを計算してスプレッドシートに書き出す
 *
 * 定義: PRの変更行数（additions + deletions）と変更ファイル数
 * 小さいPRほどレビューしやすく、マージが早い傾向がある
 *
 * @param days - 計測期間（日数）デフォルト30日
 */
function syncPRSize(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured. Set githubToken in setup() or configure GitHub App");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured. Add repositories with addRepo()");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const period = `${startDateStr}〜${endDateStr}`;

  Logger.log(`📏 Calculating PR Size for ${days} days`);
  Logger.log(`   Period: ${period}`);

  // 全リポジトリからPRを取得
  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    Logger.log(`📡 Fetching PRs from ${repo.fullName}...`);
    const prsResult = getPullRequests(repo, token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      // マージ済みPRのみを対象とする
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
      Logger.log(`   Found ${mergedPRs.length} merged PRs`);
    } else {
      Logger.log(`   ⚠️ Failed to fetch PRs: ${prsResult.error}`);
    }
  }

  if (allPRs.length === 0) {
    Logger.log("⚠️ No merged PRs found in the period");
    return;
  }

  Logger.log(`📊 Fetching PR size data for ${allPRs.length} PRs...`);
  const sizeData = getPRSizeDataForPRs(allPRs, token);

  const sizeMetrics = calculatePRSize(sizeData, period);

  Logger.log(`📊 PR Size Results:`);
  Logger.log(`   PRs analyzed: ${sizeMetrics.prCount}`);
  Logger.log(`   Lines of Code: total=${sizeMetrics.linesOfCode.total}, avg=${sizeMetrics.linesOfCode.avg}, median=${sizeMetrics.linesOfCode.median}, min=${sizeMetrics.linesOfCode.min}, max=${sizeMetrics.linesOfCode.max}`);
  Logger.log(`   Files Changed: total=${sizeMetrics.filesChanged.total}, avg=${sizeMetrics.filesChanged.avg}, median=${sizeMetrics.filesChanged.median}, min=${sizeMetrics.filesChanged.min}, max=${sizeMetrics.filesChanged.max}`);

  writePRSizeToSheet(config.spreadsheet.id, sizeMetrics);

  Logger.log("✅ PR Size metrics synced");
}

/**
 * PRサイズの詳細を表示（デバッグ用）
 */
function showPRSizeDetails(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    const prsResult = getPullRequests(repo, token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
    }
  }

  const sizeData = getPRSizeDataForPRs(allPRs, token);
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const sizeMetrics = calculatePRSize(sizeData, `${startDateStr}〜${endDateStr}`);

  Logger.log(`\n📋 PR Size Details (${sizeMetrics.prCount} PRs):\n`);
  sizeMetrics.prDetails.forEach((pr, i) => {
    Logger.log(`${i + 1}. PR #${pr.prNumber}: ${pr.title}`);
    Logger.log(`   Repository: ${pr.repository}`);
    Logger.log(`   Lines of Code: ${pr.linesOfCode} (+${pr.additions}/-${pr.deletions})`);
    Logger.log(`   Files Changed: ${pr.filesChanged}`);
    Logger.log(`   Merged: ${pr.mergedAt ?? "Not merged"}\n`);
  });
}

/**
 * 開発者満足度を計算してスプレッドシートに書き出す
 *
 * 定義: Notionタスク完了時に入力される満足度スコア（★1〜5）を集計
 * SPACEフレームワークの「Satisfaction」ディメンションに対応
 *
 * @param days - 計測期間（日数）デフォルト30日
 */
function syncDeveloperSatisfaction(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (!config.notion.token || !config.notion.databaseId) {
    Logger.log("⚠️ Notion integration is not configured. Set notionToken and notionDatabaseId in setup()");
    return;
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const period = `${startDateStr}〜${endDateStr}`;

  Logger.log(`😊 Calculating Developer Satisfaction for ${days} days`);
  Logger.log(`   Period: ${period}`);

  const tasksResult = getTasksForSatisfaction(
    config.notion.databaseId,
    config.notion.token,
    startDateStr,
    endDateStr
  );

  if (!tasksResult.success || !tasksResult.data) {
    Logger.log(`❌ Failed to fetch tasks: ${tasksResult.error}`);
    return;
  }

  Logger.log(`📥 Fetched ${tasksResult.data.length} tasks with satisfaction data`);

  const satisfactionMetrics = calculateDeveloperSatisfaction(tasksResult.data, period);

  Logger.log(`📊 Developer Satisfaction Results:`);
  Logger.log(`   Tasks with ratings: ${satisfactionMetrics.taskCount}`);
  if (satisfactionMetrics.satisfaction.avg !== null) {
    Logger.log(`   Satisfaction: avg=${satisfactionMetrics.satisfaction.avg}, median=${satisfactionMetrics.satisfaction.median}`);
    const dist = satisfactionMetrics.satisfaction.distribution;
    Logger.log(`   Distribution: ★1=${dist.star1}, ★2=${dist.star2}, ★3=${dist.star3}, ★4=${dist.star4}, ★5=${dist.star5}`);
  } else {
    Logger.log(`   No satisfaction data found`);
  }

  writeDeveloperSatisfactionToSheet(config.spreadsheet.id, satisfactionMetrics);

  Logger.log("✅ Developer Satisfaction metrics synced");
}

/**
 * 開発者満足度の詳細を表示（デバッグ用）
 */
function showDeveloperSatisfactionDetails(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (!config.notion.token || !config.notion.databaseId) {
    Logger.log("⚠️ Notion integration is not configured");
    return;
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  const tasksResult = getTasksForSatisfaction(
    config.notion.databaseId,
    config.notion.token,
    startDateStr,
    endDateStr
  );

  if (!tasksResult.success || !tasksResult.data) {
    Logger.log(`❌ Failed to fetch tasks: ${tasksResult.error}`);
    return;
  }

  const satisfactionMetrics = calculateDeveloperSatisfaction(
    tasksResult.data,
    `${startDateStr}〜${endDateStr}`
  );

  Logger.log(`\n📋 Developer Satisfaction Details (${satisfactionMetrics.taskCount} tasks):\n`);
  satisfactionMetrics.taskDetails.forEach((task, i) => {
    Logger.log(`${i + 1}. ${task.title}`);
    Logger.log(`   Assignee: ${task.assignee ?? "Unassigned"}`);
    Logger.log(`   Satisfaction: ${"★".repeat(task.satisfactionScore)}${"☆".repeat(5 - task.satisfactionScore)}`);
    Logger.log(`   Completed: ${task.completedAt}\n`);
  });
}

/**
 * 権限テスト用関数 - 初回実行で承認ダイアログを表示
 */
function testPermissions(): void {
  // 外部リクエスト権限のテスト
  const response = UrlFetchApp.fetch("https://api.github.com", {
    muteHttpExceptions: true,
  });
  Logger.log(`GitHub API status: ${response.getResponseCode()}`);

  // スプレッドシート権限のテスト
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheet.id);
  Logger.log(`Spreadsheet name: ${spreadsheet.getName()}`);

  Logger.log("✅ All permissions granted!");
}

// GASグローバルスコープにエクスポート
declare const global: any;
global.syncDevOpsMetrics = syncDevOpsMetrics;
global.syncHistoricalMetrics = syncHistoricalMetrics;
global.syncLast30Days = syncLast30Days;
global.syncLast90Days = syncLast90Days;
global.testPermissions = testPermissions;
global.createDailyTrigger = createDailyTrigger;
global.setup = setup;
global.setupWithGitHubApp = setupWithGitHubApp;
global.showAuthMode = showAuthMode;
global.addRepo = addRepo;
global.removeRepo = removeRepo;
global.listRepos = listRepos;
global.cleanup = cleanup;
global.generateSummary = generateSummary;
global.syncCycleTime = syncCycleTime;
global.showCycleTimeDetails = showCycleTimeDetails;
global.syncCodingTime = syncCodingTime;
global.showCodingTimeDetails = showCodingTimeDetails;
global.syncReworkRate = syncReworkRate;
global.showReworkRateDetails = showReworkRateDetails;
global.syncReviewEfficiency = syncReviewEfficiency;
global.showReviewEfficiencyDetails = showReviewEfficiencyDetails;
global.syncPRSize = syncPRSize;
global.showPRSizeDetails = showPRSizeDetails;
global.syncDeveloperSatisfaction = syncDeveloperSatisfaction;
global.showDeveloperSatisfactionDetails = showDeveloperSatisfactionDetails;

// =============================================================================
// スキーママイグレーション関数
// =============================================================================

/**
 * 全シートのマイグレーションをプレビュー（ドライラン）
 * 実際の変更は行わず、何が変更されるかをログ出力する
 */
function previewMigration(): void {
  ensureContainerInitialized();
  const config = getConfig();
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(config.spreadsheet.id);

  logger.log("=== Schema Migration Preview ===");
  logger.log("This is a dry run. No changes will be made.\n");

  for (const schema of ALL_SCHEMAS) {
    const preview = getMigrationPreview(spreadsheet, schema);
    logMigrationPreview(preview);
  }

  logger.log("\nTo apply migrations, run: migrateAllSchemas()");
}

/**
 * 全シートのスキーママイグレーションを実行
 */
function migrateAllSchemas(): void {
  ensureContainerInitialized();
  const config = getConfig();
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(config.spreadsheet.id);

  logger.log("=== Starting Schema Migration ===\n");

  const results = ALL_SCHEMAS.map((schema) => {
    logger.log(`Migrating: ${schema.sheetName}...`);
    const result = migrateSheetSchema(spreadsheet, schema);
    logMigrationResult(result);
    return result;
  });

  logMigrationSummary(results);
}

/**
 * 特定のシートのみマイグレーションを実行
 */
function migrateSheet(sheetName: string): void {
  ensureContainerInitialized();
  const config = getConfig();
  const { spreadsheetClient, logger } = getContainer();

  const schema = findSchemaBySheetName(sheetName);
  if (!schema) {
    logger.log(`❌ Error: Unknown sheet name: ${sheetName}`);
    logger.log("Available sheets:");
    ALL_SCHEMAS.forEach((s) => logger.log(`  - ${s.sheetName}`));
    return;
  }

  const spreadsheet = spreadsheetClient.openById(config.spreadsheet.id);
  const result = migrateSheetSchema(spreadsheet, schema);
  logMigrationResult(result);
}

/**
 * ヘッダー行のみを最新に更新（データの列順は変更しない）
 * より安全なオプション
 */
function updateHeadersOnly(): void {
  ensureContainerInitialized();
  const config = getConfig();
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(config.spreadsheet.id);

  logger.log("=== Updating Headers Only ===\n");

  const results = ALL_SCHEMAS.map((schema) => {
    logger.log(`Updating headers: ${schema.sheetName}...`);
    const result = updateSheetHeadersOnly(spreadsheet, schema);
    logMigrationResult(result);
    return result;
  });

  logMigrationSummary(results);
}

/**
 * バックアップシートの削除方法を表示
 */
function showBackupCleanupHelp(): void {
  ensureContainerInitialized();
  logBackupCleanupInstructions();
}

global.previewMigration = previewMigration;
global.migrateAllSchemas = migrateAllSchemas;
global.migrateSheet = migrateSheet;
global.updateHeadersOnly = updateHeadersOnly;
global.showBackupCleanupHelp = showBackupCleanupHelp;
