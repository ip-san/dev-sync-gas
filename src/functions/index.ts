/**
 * GAS関数モジュール - エントリーポイント
 *
 * GASで実行可能な関数を提供するモジュール群の統合エクスポート。
 *
 * 構成:
 * - helpers.ts: 共通ヘルパー関数
 * - extendedMetrics.ts: 全指標同期関数（DORA + 拡張指標）
 * - setup.ts: セットアップ・設定関数
 * - config.ts: 設定表示・変更関数
 * - migration.ts: マイグレーション関数
 */

// 監査ログ
export { exportAuditLogs, showAuditLogs } from './audit';
// 設定表示・変更
export {
  // API モード設定
  configureApiMode,
  configureCodingTimeLabels,
  configureCycleTimeLabels,
  configureDeployWorkflowPatterns,
  configurePRCycleTimeExcludeBranches,
  configurePRSizeExcludeBranches,
  configureProductionBranch,
  resetDeployWorkflowPatternsConfig,
  showApiMode,
  showCodingTimeConfig,
  showCodingTimeLabels,
  showCycleTimeConfig,
  showCycleTimeLabels,
  showDeployWorkflowPatterns,
  showPRCycleTimeExcludeBranches,
  showPRSizeExcludeBranches,
  showProductionBranch,
} from './config';
// 診断ツール
export { debugCycleTimeForIssue, debugDeploymentFrequency } from './diagnostics';
// メトリクス同期（DORA + 拡張指標）
export {
  syncAllMetrics,
  syncAllMetricsFromScratch,
  syncAllMetricsIncremental,
} from './extendedMetrics';
// 共通ヘルパー
export { ensureContainerInitialized } from './helpers';
// ログレベル設定
export { configureLogLevel, showLogLevel } from './logLevel';
// マイグレーション
export {
  migrateAllSchemas,
  migrateSheet,
  previewMigration,
  showBackupCleanupHelp,
  updateHeadersOnly,
} from './migration';
// Secret Manager
export {
  deleteSecret,
  disableSecretManager,
  enableSecretManager,
  getSecret,
  migratePrivateKey,
  showSecretManagerStatus,
  storeSecret,
} from './secretManager';
// セットアップ・設定
export {
  checkConfig,
  listRepos,
  scheduleDailyMetricsSync,
  showAuthMode,
  testPermissions,
} from './setup';
// Slack設定
export { configureSlackWebhook, removeSlackWebhook, showSlackConfig } from './slackConfig';
