import { getConfig, setConfig, addRepository, removeRepository } from "./config/settings";
import "./init";
import { getAllRepositoriesData } from "./services/github";
import { queryDatabase } from "./services/notion";
import { writeMetricsToSheet, clearOldData, createSummarySheet } from "./services/spreadsheet";
import { calculateMetricsForRepository } from "./utils/metrics";
import type { DevOpsMetrics } from "./types";

/**
 * メイン実行関数 - DevOps指標を収集してスプレッドシートに書き出す
 */
function syncDevOpsMetrics(): void {
  const config = getConfig();
  const { pullRequests, workflowRuns } = getAllRepositoriesData(
    config.github.repositories,
    config.github.token
  );

  const metrics: DevOpsMetrics[] = config.github.repositories.map((repo) =>
    calculateMetricsForRepository(repo.fullName, pullRequests, workflowRuns)
  );

  writeMetricsToSheet(config.spreadsheet.id, config.spreadsheet.sheetName, metrics);

  Logger.log(`✅ Synced metrics for ${metrics.length} repositories`);
}

/**
 * 日次実行用トリガー設定
 */
function createDailyTrigger(): void {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "syncDevOpsMetrics") {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // 毎日午前9時に実行
  ScriptApp.newTrigger("syncDevOpsMetrics")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  Logger.log("✅ Daily trigger created for 9:00 AM");
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
  addRepository(owner, name);
  Logger.log(`✅ Added repository: ${owner}/${name}`);
}

/**
 * リポジトリ削除のラッパー
 */
function removeRepo(fullName: string): void {
  removeRepository(fullName);
  Logger.log(`✅ Removed repository: ${fullName}`);
}

/**
 * 登録済みリポジトリ一覧を表示
 */
function listRepos(): void {
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
  const config = getConfig();
  clearOldData(config.spreadsheet.id, config.spreadsheet.sheetName, daysToKeep);
  Logger.log(`✅ Cleaned up data older than ${daysToKeep} days`);
}

/**
 * サマリーシートを作成
 */
function generateSummary(): void {
  const config = getConfig();
  createSummarySheet(config.spreadsheet.id, config.spreadsheet.sheetName);
  Logger.log("✅ Summary sheet created");
}

// GASグローバルスコープにエクスポート
declare const global: any;
global.syncDevOpsMetrics = syncDevOpsMetrics;
global.createDailyTrigger = createDailyTrigger;
global.setup = setup;
global.addRepo = addRepo;
global.removeRepo = removeRepo;
global.listRepos = listRepos;
global.cleanup = cleanup;
global.generateSummary = generateSummary;
