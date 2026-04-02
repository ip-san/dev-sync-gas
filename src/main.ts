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
  checkConfig,
  // Slack設定
  configureSlackWebhook,
  // 診断ツール
  debugCycleTimeForIssue,
  debugDeploymentFrequency,
  listRepos,
  removeSlackWebhook,
  scheduleDailyMetricsSync,
  // 診断・設定
  showAuthMode,
  showSlackConfig,
  // メトリクス同期（DORA + 拡張指標）
  syncAllMetrics,
  syncAllMetricsFromScratch,
  syncAllMetricsIncremental,
  testPermissions,
} from './functions';
import {
  // Slackアラート通知
  checkAndSendAlerts,
} from './functions/slackAlerts';
import {
  // Slackインシデント日次サマリー
  sendIncidentDailySummary,
} from './functions/slackIncidents';
import {
  // Slack月次レポート
  sendMonthlyReport,
} from './functions/slackMonthly';
import {
  // Slack週次レポート
  sendWeeklyReport,
} from './functions/slackWeekly';

// init.tsをインポート（グローバル関数として自動エクスポートされる）
import './init';

// =============================================================================
// GASグローバルスコープにエクスポート
// =============================================================================

/// <reference path="./types/gas-global.d.ts" />

// =============================================================================
// データ同期（トリガーから実行される）
// =============================================================================

global.syncAllMetrics = syncAllMetrics;
global.syncAllMetricsIncremental = syncAllMetricsIncremental;
global.syncAllMetricsFromScratch = syncAllMetricsFromScratch;

// =============================================================================
// 診断・確認
// =============================================================================

global.checkConfig = checkConfig;
global.testPermissions = testPermissions;
global.showAuthMode = showAuthMode;
global.listRepos = listRepos;

// 診断ツール
global.debugCycleTimeForIssue = debugCycleTimeForIssue;
global.debugDeploymentFrequency = debugDeploymentFrequency;

// =============================================================================
// トリガー管理
// =============================================================================

global.scheduleDailyMetricsSync = scheduleDailyMetricsSync;

// =============================================================================
// Slack通知（トリガーから実行される）
// =============================================================================

global.sendWeeklyReport = sendWeeklyReport;
global.checkAndSendAlerts = checkAndSendAlerts;
global.sendMonthlyReport = sendMonthlyReport;
global.sendIncidentDailySummary = sendIncidentDailySummary;

// =============================================================================
// Slack設定
// =============================================================================

global.configureSlackWebhook = configureSlackWebhook;
global.removeSlackWebhook = removeSlackWebhook;
global.showSlackConfig = showSlackConfig;
