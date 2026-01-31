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
 * - debug.ts: デバッグ用詳細表示関数
 */

// 共通ヘルパー
export { ensureContainerInitialized } from "./helpers";

// DORA指標同期
export {
  syncDevOpsMetrics,
  syncAllProjects,
  syncProject,
  syncHistoricalMetrics,
  syncAllProjectsHistorical,
  syncLast30Days,
  syncLast90Days,
  cleanup,
  generateSummary,
  generateAllProjectSummaries,
} from "./sync";

// 拡張指標同期
export {
  syncCycleTime,
  syncCodingTime,
  syncReworkRate,
  syncReviewEfficiency,
  syncPRSize,
} from "./extendedMetrics";

// セットアップ・設定
export {
  setup,
  setupWithGitHubApp,
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
} from "./setup";

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
} from "./config";

// マイグレーション
export {
  previewMigration,
  migrateAllSchemas,
  migrateSheet,
  updateHeadersOnly,
  showBackupCleanupHelp,
} from "./migration";

// デバッグ用詳細表示
export {
  showCycleTimeDetails,
  showCodingTimeDetails,
  showReworkRateDetails,
  showReviewEfficiencyDetails,
  showPRSizeDetails,
} from "./debug";
