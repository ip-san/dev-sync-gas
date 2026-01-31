/**
 * Metrics計算モジュール - エントリーポイント
 *
 * DevOps指標の計算機能を提供するモジュール群の統合エクスポート。
 *
 * 構成:
 * - dora.ts: DORA Four Key Metrics
 * - extended.ts: 拡張指標（サイクルタイム、コーディング時間など）
 * - aggregate.ts: 複数リポジトリ横断集計
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
  type LeadTimeResult,
  type IncidentMetricsResult,
} from "./dora";

// 拡張指標
export {
  calculateCycleTime,
  calculateCodingTime,
  calculateReworkRate,
  calculateReviewEfficiency,
  calculatePRSize,
} from "./extended";

// 複数リポジトリ横断集計
export {
  aggregateMultiRepoMetrics,
  type RepositorySummary,
  type AggregatedSummary,
} from "./aggregate";
