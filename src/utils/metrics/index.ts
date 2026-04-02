/**
 * Metrics計算モジュール - エントリーポイント
 *
 * DevOps指標の計算機能を提供するモジュール群の統合エクスポート。
 *
 * 構成:
 * - dora.ts: DORA Four Key Metrics
 * - cycleTime.ts: サイクルタイム計算
 * - codingTime.ts: コーディング時間計算
 * - reworkRate.ts: 手戻り率計算
 * - reviewEfficiency.ts: レビュー効率計算
 * - prSize.ts: PRサイズ計算
 * - aggregate.ts: 複数リポジトリ横断集計
 * - statsHelpers.ts: 統計計算ヘルパー
 */

// 複数リポジトリ横断集計
export {
  type AggregatedSummary,
  aggregateMultiRepoMetrics,
  type RepositorySummary,
} from './aggregate';
export { calculateCodingTime } from './codingTime';
// 拡張指標
export { calculateCycleTime } from './cycleTime';
// DORA Four Key Metrics
export {
  calculateChangeFailureRate,
  // 日別メトリクス計算
  calculateDailyMetrics,
  calculateDeploymentFrequency,
  calculateIncidentMetrics,
  calculateLeadTime,
  calculateLeadTimeDetailed,
  calculateMetricsForDate,
  calculateMetricsForRepository,
  calculateMTTR,
  generateDateRange,
  type IncidentMetricsResult,
  isOnDate,
  type LeadTimeResult,
} from './dora';
export { calculatePRCycleTime } from './prCycleTime';
export { calculatePRSize } from './prSize';
export { calculateReviewEfficiency } from './reviewEfficiency';
export { calculateReworkRate } from './reworkRate';
