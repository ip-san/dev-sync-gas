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
  // 拡張指標同期
  syncAllMetrics,
  // 診断・設定
  showAuthMode,
  listRepos,
  listProjects,
  checkConfig,
  testPermissions,
} from './functions';
import {
  // Slack週次レポート
  sendWeeklyReport,
} from './functions/slackWeekly';
import {
  // Slackアラート通知
  checkAndSendAlerts,
} from './functions/slackAlerts';
import {
  // Slack月次レポート
  sendMonthlyReport,
} from './functions/slackMonthly';
import {
  // Slackインシデント日次サマリー
  sendIncidentDailySummary,
} from './functions/slackIncidents';

// init.tsをインポート（グローバル関数として自動エクスポートされる）
import './init';

// =============================================================================
// GASグローバルスコープにエクスポート
// =============================================================================

/// <reference path="./types/gas-global.d.ts" />

// =============================================================================
// データ同期（トリガーから実行される）
// =============================================================================

global.syncDevOpsMetrics = syncDevOpsMetrics;
global.syncAllMetrics = syncAllMetrics;

// =============================================================================
// 診断・確認
// =============================================================================

global.checkConfig = checkConfig;
global.testPermissions = testPermissions;
global.showAuthMode = showAuthMode;
global.listRepos = listRepos;
global.listProjects = listProjects;

// =============================================================================
// Slack通知（トリガーから実行される）
// =============================================================================

global.sendWeeklyReport = sendWeeklyReport;
global.checkAndSendAlerts = checkAndSendAlerts;
global.sendMonthlyReport = sendMonthlyReport;
global.sendIncidentDailySummary = sendIncidentDailySummary;
