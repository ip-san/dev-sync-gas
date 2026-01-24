import { getConfig, setConfig, addRepository, removeRepository } from "./config/settings";
import "./init";
import { getAllRepositoriesData, DateRange, getPullRequestsForTasks, getPullRequests, getReworkDataForPRs } from "./services/github";
import { getTasksForCycleTime, getTasksForCodingTime } from "./services/notion";
import { writeMetricsToSheet, clearOldData, createSummarySheet, writeCycleTimeToSheet, writeCodingTimeToSheet, writeReworkRateToSheet } from "./services/spreadsheet";
import { calculateMetricsForRepository, calculateCycleTime, calculateCodingTime, calculateReworkRate } from "./utils/metrics";
import { initializeContainer, isContainerInitialized, getContainer } from "./container";
import { createGasAdapters } from "./adapters/gas";
import type { DevOpsMetrics, CycleTimeMetrics, GitHubPullRequest } from "./types";

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

  const { pullRequests, workflowRuns, deployments } = getAllRepositoriesData(
    config.github.repositories,
    config.github.token,
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
 * 初期セットアップ - スクリプトプロパティを設定
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

  Logger.log("✅ Configuration saved. Add repositories with addRepo()");
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
 * AIの恩恵が最も端的に表れる指標
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

  if (!config.github.token) {
    Logger.log("⚠️ GitHub token is not configured. Set githubToken in setup()");
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
  Logger.log(`📡 Fetching PR information from GitHub...`);
  const prMap = getPullRequestsForTasks(tasksResult.data, config.github.token);
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

  if (!config.github.token) {
    Logger.log("⚠️ GitHub token is not configured");
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

  const prMap = getPullRequestsForTasks(tasksResult.data, config.github.token);
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

  if (!config.github.token) {
    Logger.log("⚠️ GitHub token is not configured. Set githubToken in setup()");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured. Add repositories with addRepo()");
    return;
  }

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
    const prsResult = getPullRequests(repo, config.github.token, "all", {
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
  const reworkData = getReworkDataForPRs(allPRs, config.github.token);

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

  if (!config.github.token) {
    Logger.log("⚠️ GitHub token is not configured");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured");
    return;
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    const prsResult = getPullRequests(repo, config.github.token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
    }
  }

  const reworkData = getReworkDataForPRs(allPRs, config.github.token);
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
