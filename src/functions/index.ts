/**
 * GAS関数モジュール - エントリーポイント
 *
 * GASで実行可能な関数を提供するモジュール群の統合エクスポート。
 *
 * 構成:
 * - helpers.ts: 共通ヘルパー関数
 * - sync.ts: DORA指標同期関数
 * - extendedMetrics.ts: 拡張指標同期関数
 * - setup.ts: セットアップ・設定関数
 * - config.ts: 設定表示・変更関数
 * - migration.ts: マイグレーション関数
 */

// 共通ヘルパー
export { ensureContainerInitialized } from './helpers';

// DORA指標同期
export {
  syncDevOpsMetrics,
  syncAllProjects,
  syncProject,
  syncHistoricalMetrics,
  syncAllProjectsHistorical,
  syncLast30Days,
  syncLast90Days,
  // 日別バックフィル
  syncDailyBackfill,
  backfillAllProjectsDaily,
  backfillLast30Days,
  backfillLast90Days,
} from './sync';

// 拡張指標同期
export {
  syncCycleTime,
  syncCodingTime,
  syncReworkRate,
  syncReviewEfficiency,
  syncPRSize,
} from './extendedMetrics';

// セットアップ・設定
export {
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
} from './setup';

// 設定表示・変更
export {
  configureProductionBranch,
  showProductionBranch,
  resetProductionBranch,
  configureCycleTimeLabels,
  showCycleTimeLabels,
  resetCycleTimeLabelsConfig,
  showCycleTimeConfig,
  configureCodingTimeLabels,
  showCodingTimeLabels,
  resetCodingTimeLabelsConfig,
  showCodingTimeConfig,
  // API モード設定
  configureApiMode,
  showApiMode,
  resetApiMode,
} from './config';

// マイグレーション
export {
  previewMigration,
  migrateAllSchemas,
  migrateSheet,
  updateHeadersOnly,
  showBackupCleanupHelp,
} from './migration';

// 監査ログ
export { exportAuditLogs, showAuditLogs } from './audit';

// Secret Manager
export {
  enableSecretManager,
  disableSecretManager,
  showSecretManagerStatus,
  storeSecret,
  getSecret,
  deleteSecret,
  migratePrivateKey,
} from './secretManager';

// ログレベル設定
export { showLogLevel, configureLogLevel, resetLogLevelConfig } from './logLevel';
