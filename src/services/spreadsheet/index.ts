/**
 * スプレッドシート操作モジュール - エントリーポイント
 *
 * 各種DevOps指標をGoogleスプレッドシートに書き出す機能を提供するモジュール群の統合エクスポート。
 *
 * 構成:
 * - helpers.ts: 共通ヘルパー関数
 * - repositorySheet.ts: リポジトリ別シート書き出し
 * - dashboard.ts: Dashboardシート生成
 * - cycleTime.ts: サイクルタイム指標書き出し
 * - codingTime.ts: コーディング時間指標書き出し
 * - reworkRate.ts: 手戻り率指標書き出し
 * - reviewEfficiency.ts: レビュー効率指標書き出し
 * - prSize.ts: PRサイズ指標書き出し
 */

// リポジトリ別シート
export {
  getRepositorySheetName,
  groupMetricsByRepository,
  writeMetricsToRepositorySheet,
  writeMetricsToAllRepositorySheets,
  readMetricsFromRepositorySheet,
  readMetricsFromAllRepositorySheets,
} from './repositorySheet';

// Dashboard
export {
  determineHealthStatus,
  extractLatestMetricsByRepository,
  calculateWeeklyTrends,
  writeDashboard,
  writeDashboardTrends,
} from './dashboard';

// マイグレーション
export { migrateToRepositorySheets, previewMigration, removeLegacySheet } from './sheetMigration';
export type { SheetMigrationResult } from './sheetMigration';

// 拡張指標 - 共通ヘルパー
export {
  groupCycleTimeDetailsByRepository,
  groupCodingTimeDetailsByRepository,
  groupReworkRateDetailsByRepository,
  groupReviewEfficiencyDetailsByRepository,
  groupPRSizeDetailsByRepository,
  getExtendedMetricSheetName,
} from './extendedMetricsRepositorySheet';

// サイクルタイム指標
export {
  writeCycleTimeToSheet,
  writeCycleTimeToRepositorySheet,
  writeCycleTimeToAllRepositorySheets,
} from './cycleTime';

// コーディング時間指標
export {
  writeCodingTimeToSheet,
  writeCodingTimeToRepositorySheet,
  writeCodingTimeToAllRepositorySheets,
} from './codingTime';

// 手戻り率指標
export {
  writeReworkRateToSheet,
  writeReworkRateToRepositorySheet,
  writeReworkRateToAllRepositorySheets,
} from './reworkRate';

// レビュー効率指標
export {
  writeReviewEfficiencyToSheet,
  writeReviewEfficiencyToRepositorySheet,
  writeReviewEfficiencyToAllRepositorySheets,
} from './reviewEfficiency';

// PRサイズ指標
export {
  writePRSizeToSheet,
  writePRSizeToRepositorySheet,
  writePRSizeToAllRepositorySheets,
} from './prSize';
