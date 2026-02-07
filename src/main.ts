/**
 * DevSyncGAS - GASエントリーポイント
 *
 * Google Apps Scriptで実行可能な関数をグローバルスコープにエクスポート。
 * 各機能は src/functions/ 以下のモジュールで実装。
 *
 * NOTE: src/init.ts は開発者のローカル設定ファイル（.gitignore対象）。
 * 初期設定が必要な場合は init.example.ts を init.ts にコピーして編集し、
 * ローカルビルド後にGASエディタで initConfig() を実行してください。
 *
 * グローバル公開方針:
 * - よく使う関数（同期、診断、リポジトリ管理等）のみグローバル公開
 * - 細かい設定変更系は init.ts で設定することを推奨（非公開）
 * - トリガーから呼ばれる関数は公開が必須
 */
import {
  // DORA指標同期
  syncDevOpsMetrics,
  // 日別バックフィル
  syncDailyBackfill,
  backfillAllProjectsDaily,
  // 拡張指標同期
  syncAllMetrics,
  syncAllMetricsFromScratch,
  // セットアップ・設定
  showAuthMode,
  addRepo,
  removeRepo,
  listRepos,
  createDailyTrigger,
  createProject,
  deleteProject,
  listProjects,
  addRepoToProject,
  removeRepoFromProject,
  checkConfig,
  testPermissions,
  // 主要な設定表示
  showCycleTimeConfig,
  showCodingTimeConfig,
  showLogLevel,
} from './functions';
import {
  // Slack通知設定
  configureSlackWebhook,
  removeSlackWebhook,
  showSlackConfig,
} from './functions/slackConfig';
import {
  // Slack週次レポート
  sendWeeklyReport,
  setupWeeklyReportTrigger,
  removeWeeklyReportTrigger,
} from './functions/slackWeekly';
import {
  // Slackアラート通知
  checkAndSendAlerts,
  setupAlertTrigger,
  removeAlertTrigger,
} from './functions/slackAlerts';
import {
  // Slack月次レポート
  sendMonthlyReport,
  setupMonthlyReportTrigger,
  removeMonthlyReportTrigger,
} from './functions/slackMonthly';
import {
  // Slackインシデント日次サマリー
  sendIncidentDailySummary,
  setupIncidentDailySummaryTrigger,
  removeIncidentDailySummaryTrigger,
} from './functions/slackIncidents';

// init.tsをインポート（グローバル関数として自動エクスポートされる）
import './init';

// =============================================================================
// GASグローバルスコープにエクスポート
// =============================================================================

/// <reference path="./types/gas-global.d.ts" />

// DORA指標同期（トリガーから実行される）
global.syncDevOpsMetrics = syncDevOpsMetrics;

// 日別バックフィル
global.syncDailyBackfill = syncDailyBackfill;
global.backfillAllProjectsDaily = backfillAllProjectsDaily;

// 拡張指標同期
global.syncAllMetrics = syncAllMetrics;
global.syncAllMetricsFromScratch = syncAllMetricsFromScratch;

// 初期設定・診断（頻繁に使用）
global.checkConfig = checkConfig;
global.testPermissions = testPermissions;
global.showAuthMode = showAuthMode;

// リポジトリ管理
global.addRepo = addRepo;
global.removeRepo = removeRepo;
global.listRepos = listRepos;

// プロジェクト管理
global.createProject = createProject;
global.deleteProject = deleteProject;
global.listProjects = listProjects;
global.addRepoToProject = addRepoToProject;
global.removeRepoFromProject = removeRepoFromProject;

// トリガー設定
global.createDailyTrigger = createDailyTrigger;

// 主要な設定表示（詳細な設定変更は init.ts で実施）
global.showCycleTimeConfig = showCycleTimeConfig;
global.showCodingTimeConfig = showCodingTimeConfig;
global.showLogLevel = showLogLevel;

// Slack通知設定
global.configureSlackWebhook = configureSlackWebhook;
global.removeSlackWebhook = removeSlackWebhook;
global.showSlackConfig = showSlackConfig;

// Slack週次レポート（トリガーから実行される）
global.sendWeeklyReport = sendWeeklyReport;
global.setupWeeklyReportTrigger = setupWeeklyReportTrigger;
global.removeWeeklyReportTrigger = removeWeeklyReportTrigger;

// Slackアラート通知（トリガーから実行される）
global.checkAndSendAlerts = checkAndSendAlerts;
global.setupAlertTrigger = setupAlertTrigger;
global.removeAlertTrigger = removeAlertTrigger;

// Slack月次レポート（トリガーから実行される）
global.sendMonthlyReport = sendMonthlyReport;
global.setupMonthlyReportTrigger = setupMonthlyReportTrigger;
global.removeMonthlyReportTrigger = removeMonthlyReportTrigger;

// Slackインシデント日次サマリー（トリガーから実行される）
global.sendIncidentDailySummary = sendIncidentDailySummary;
global.setupIncidentDailySummaryTrigger = setupIncidentDailySummaryTrigger;
global.removeIncidentDailySummaryTrigger = removeIncidentDailySummaryTrigger;
