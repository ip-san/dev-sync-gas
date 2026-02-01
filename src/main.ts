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
  // 拡張指標同期
  syncCycleTime,
  syncCodingTime,
  syncReworkRate,
  syncReviewEfficiency,
  syncPRSize,
  // セットアップ・設定
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
  // 設定表示・変更
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
  // APIモード設定
  configureApiMode,
  showApiMode,
  resetApiMode,
  // スキーママイグレーション
  previewMigration,
  migrateAllSchemas,
  migrateSheet,
  updateHeadersOnly,
  showBackupCleanupHelp,
} from './functions';

// =============================================================================
// GASグローバルスコープにエクスポート
// =============================================================================

/// <reference path="./types/gas-global.d.ts" />

// DORA指標同期
global.syncDevOpsMetrics = syncDevOpsMetrics;
global.syncAllProjects = syncAllProjects;
global.syncProject = syncProject;
global.syncHistoricalMetrics = syncHistoricalMetrics;
global.syncAllProjectsHistorical = syncAllProjectsHistorical;
global.syncLast30Days = syncLast30Days;
global.syncLast90Days = syncLast90Days;

// 日別バックフィル
global.syncDailyBackfill = syncDailyBackfill;
global.backfillAllProjectsDaily = backfillAllProjectsDaily;
global.backfillLast30Days = backfillLast30Days;
global.backfillLast90Days = backfillLast90Days;

// 拡張指標同期
global.syncCycleTime = syncCycleTime;
global.syncCodingTime = syncCodingTime;
global.syncReworkRate = syncReworkRate;
global.syncReviewEfficiency = syncReviewEfficiency;
global.syncPRSize = syncPRSize;

// セットアップ・設定
global.setup = setup;
global.setupWithGitHubApp = setupWithGitHubApp;
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
global.resetProductionBranch = resetProductionBranch;
global.configureCycleTimeLabels = configureCycleTimeLabels;
global.showCycleTimeLabels = showCycleTimeLabels;
global.resetCycleTimeLabelsConfig = resetCycleTimeLabelsConfig;
global.showCycleTimeConfig = showCycleTimeConfig;

// コーディングタイム設定
global.configureCodingTimeLabels = configureCodingTimeLabels;
global.showCodingTimeLabels = showCodingTimeLabels;
global.resetCodingTimeLabelsConfig = resetCodingTimeLabelsConfig;
global.showCodingTimeConfig = showCodingTimeConfig;

// APIモード設定
global.configureApiMode = configureApiMode;
global.showApiMode = showApiMode;
global.resetApiMode = resetApiMode;

// マイグレーション
global.previewMigration = previewMigration;
global.migrateAllSchemas = migrateAllSchemas;
global.migrateSheet = migrateSheet;
global.updateHeadersOnly = updateHeadersOnly;
global.showBackupCleanupHelp = showBackupCleanupHelp;
