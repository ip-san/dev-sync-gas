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

// DORA Four Key Metrics
export {
  calculateLeadTime,
  calculateLeadTimeDetailed,
  calculateDeploymentFrequency,
  calculateChangeFailureRate,
  calculateMTTR,
  calculateIncidentMetrics,
  calculateMetricsForRepository,
  // 日別メトリクス計算
  calculateDailyMetrics,
  calculateMetricsForDate,
  generateDateRange,
  isOnDate,
  type LeadTimeResult,
  type IncidentMetricsResult,
} from './dora';

// 拡張指標
export { calculateCycleTime } from './cycleTime';
export { calculateCodingTime } from './codingTime';
export { calculateReworkRate } from './reworkRate';
export { calculateReviewEfficiency } from './reviewEfficiency';
export { calculatePRSize } from './prSize';

// 複数リポジトリ横断集計
export {
  aggregateMultiRepoMetrics,
  type RepositorySummary,
  type AggregatedSummary,
} from './aggregate';
