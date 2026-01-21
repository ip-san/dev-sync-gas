import { getConfig, setConfig, addRepository, removeRepository } from "./config/settings";
import "./init";
import { getAllRepositoriesData, DateRange } from "./services/github";
import { queryDatabase } from "./services/notion";
import { writeMetricsToSheet, clearOldData, createSummarySheet } from "./services/spreadsheet";
import { calculateMetricsForRepository } from "./utils/metrics";
import { initializeContainer, isContainerInitialized, getContainer } from "./container";
import { createGasAdapters } from "./adapters/gas";
import type { DevOpsMetrics } from "./types";

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

  const { pullRequests, workflowRuns } = getAllRepositoriesData(
    config.github.repositories,
    config.github.token,
    dateRange
  );

  Logger.log(`📥 Fetched ${pullRequests.length} PRs, ${workflowRuns.length} workflow runs`);

  const metrics: DevOpsMetrics[] = config.github.repositories.map((repo) =>
    calculateMetricsForRepository(repo.fullName, pullRequests, workflowRuns)
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
