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

// コーディング時間指標
export {
  writeCodingTimeToAllRepositorySheets,
  writeCodingTimeToRepositorySheet,
  writeCodingTimeToSheet,
} from './codingTime';
// サイクルタイム指標
export {
  writeCycleTimeToAllRepositorySheets,
  writeCycleTimeToRepositorySheet,
  writeCycleTimeToSheet,
} from './cycleTime';
// Dashboard
export {
  calculateWeeklyTrends,
  determineHealthStatus,
  extractLatestMetricsByRepository,
  writeDashboard,
  writeDashboardTrends,
} from './dashboard';
// 拡張指標 - 共通ヘルパー
export {
  getExtendedMetricDetailSheetName,
  getExtendedMetricSheetName,
  groupIssueDetailsByRepository,
  groupPRDetailsByRepository,
} from './extendedMetricsRepositorySheet';
// PR Cycle Time指標
export {
  writePRCycleTimeDetailsToRepositorySheet,
  writePRCycleTimeToAllRepositorySheets,
  writePRCycleTimeToSheet,
} from './prCycleTime';
// PRサイズ指標
export {
  writePRSizeToAllRepositorySheets,
  writePRSizeToRepositorySheet,
  writePRSizeToSheet,
} from './prSize';
// リポジトリ別シート
export {
  getRepositorySheetName,
  groupMetricsByRepository,
  readMetricsFromAllRepositorySheets,
  readMetricsFromRepositorySheet,
  writeMetricsToAllRepositorySheets,
  writeMetricsToRepositorySheet,
} from './repositorySheet';
// レビュー効率指標
export {
  writeReviewEfficiencyToAllRepositorySheets,
  writeReviewEfficiencyToRepositorySheet,
  writeReviewEfficiencyToSheet,
} from './reviewEfficiency';

// 手戻り率指標
export {
  writeReworkRateToAllRepositorySheets,
  writeReworkRateToRepositorySheet,
  writeReworkRateToSheet,
} from './reworkRate';
export type { SheetMigrationResult } from './sheetMigration';
// マイグレーション
export { migrateToRepositorySheets, previewMigration, removeLegacySheet } from './sheetMigration';
