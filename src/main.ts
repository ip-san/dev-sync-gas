/**
 * DevSyncGAS - GASエントリーポイント
 *
 * Google Apps Scriptで実行可能な関数をグローバルスコープにエクスポート。
 * 各機能は src/functions/ 以下のモジュールで実装。
 *
 * NOTE: src/init.ts は開発者のローカル設定ファイル（.gitignore対象）。
 * 初期設定が必要な場合は init.example.ts を init.ts にコピーして編集し、
 * ローカルビルド後にGASエディタで initConfig() を実行してください。
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
  modifyProject,
  checkConfig,
  testPermissions,
  // 設定表示・変更
  configureProductionBranch,
  showProductionBranch,
  configureCycleTimeLabels,
  showCycleTimeLabels,
  showCycleTimeConfig,
  configureCodingTimeLabels,
  showCodingTimeLabels,
  showCodingTimeConfig,
  configurePRSizeExcludeBranches,
  showPRSizeExcludeBranches,
  configureDeployWorkflowPatterns,
  showDeployWorkflowPatterns,
  resetDeployWorkflowPatternsConfig,
  // APIモード設定
  configureApiMode,
  showApiMode,
  // スキーママイグレーション
  previewMigration,
  migrateAllSchemas,
  migrateSheet,
  updateHeadersOnly,
  showBackupCleanupHelp,
  // ログレベル設定
  showLogLevel,
  configureLogLevel,
  // 監査ログ
  exportAuditLogs,
  showAuditLogs,
  // Secret Manager
  enableSecretManager,
  disableSecretManager,
  showSecretManagerStatus,
  storeSecret,
  getSecret,
  deleteSecret,
  migratePrivateKey,
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

// DORA指標同期
global.syncDevOpsMetrics = syncDevOpsMetrics;

// 日別バックフィル
global.syncDailyBackfill = syncDailyBackfill;
global.backfillAllProjectsDaily = backfillAllProjectsDaily;

// 拡張指標同期
global.syncAllMetrics = syncAllMetrics;
global.syncAllMetricsFromScratch = syncAllMetricsFromScratch;

// セットアップ・設定
global.showAuthMode = showAuthMode;
global.addRepo = addRepo;
global.removeRepo = removeRepo;
global.listRepos = listRepos;
global.createDailyTrigger = createDailyTrigger;
global.testPermissions = testPermissions;
global.checkConfig = checkConfig;

// プロジェクト管理
global.createProject = createProject;
global.deleteProject = deleteProject;
global.listProjects = listProjects;
global.addRepoToProject = addRepoToProject;
global.removeRepoFromProject = removeRepoFromProject;
global.modifyProject = modifyProject;

// サイクルタイム設定
global.configureProductionBranch = configureProductionBranch;
global.showProductionBranch = showProductionBranch;
global.configureCycleTimeLabels = configureCycleTimeLabels;
global.showCycleTimeLabels = showCycleTimeLabels;
global.showCycleTimeConfig = showCycleTimeConfig;

// コーディングタイム設定
global.configureCodingTimeLabels = configureCodingTimeLabels;
global.showCodingTimeLabels = showCodingTimeLabels;
global.showCodingTimeConfig = showCodingTimeConfig;

// PRサイズ除外ブランチ設定
global.configurePRSizeExcludeBranches = configurePRSizeExcludeBranches;
global.showPRSizeExcludeBranches = showPRSizeExcludeBranches;

// デプロイワークフローパターン設定
global.configureDeployWorkflowPatterns = configureDeployWorkflowPatterns;
global.showDeployWorkflowPatterns = showDeployWorkflowPatterns;
global.resetDeployWorkflowPatternsConfig = resetDeployWorkflowPatternsConfig;

// APIモード設定
global.configureApiMode = configureApiMode;
global.showApiMode = showApiMode;

// マイグレーション
global.previewMigration = previewMigration;
global.migrateAllSchemas = migrateAllSchemas;
global.migrateSheet = migrateSheet;
global.updateHeadersOnly = updateHeadersOnly;
global.showBackupCleanupHelp = showBackupCleanupHelp;

// ログレベル設定
global.showLogLevel = showLogLevel;
global.configureLogLevel = configureLogLevel;

// Slack通知設定
global.configureSlackWebhook = configureSlackWebhook;
global.removeSlackWebhook = removeSlackWebhook;
global.showSlackConfig = showSlackConfig;

// Slack週次レポート
global.sendWeeklyReport = sendWeeklyReport;
global.setupWeeklyReportTrigger = setupWeeklyReportTrigger;
global.removeWeeklyReportTrigger = removeWeeklyReportTrigger;

// Slackアラート通知
global.checkAndSendAlerts = checkAndSendAlerts;
global.setupAlertTrigger = setupAlertTrigger;
global.removeAlertTrigger = removeAlertTrigger;

// Slack月次レポート
global.sendMonthlyReport = sendMonthlyReport;
global.setupMonthlyReportTrigger = setupMonthlyReportTrigger;
global.removeMonthlyReportTrigger = removeMonthlyReportTrigger;

// Slackインシデント日次サマリー
global.sendIncidentDailySummary = sendIncidentDailySummary;
global.setupIncidentDailySummaryTrigger = setupIncidentDailySummaryTrigger;
global.removeIncidentDailySummaryTrigger = removeIncidentDailySummaryTrigger;

// 監査ログ
global.exportAuditLogs = exportAuditLogs;
global.showAuditLogs = showAuditLogs;

// Secret Manager
global.enableSecretManager = enableSecretManager;
global.disableSecretManager = disableSecretManager;
global.showSecretManagerStatus = showSecretManagerStatus;
global.storeSecret = storeSecret;
global.getSecret = getSecret;
global.deleteSecret = deleteSecret;
global.migratePrivateKey = migratePrivateKey;
