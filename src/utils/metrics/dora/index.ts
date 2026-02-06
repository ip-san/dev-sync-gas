/**
 * DORA Four Key Metrics 計算モジュール
 *
 * デプロイ頻度、リードタイム、変更障害率、MTTRを計算する。
 */

// 定数
export { MS_TO_HOURS } from './constants';

// Lead Time
export { calculateLeadTime, calculateLeadTimeDetailed } from './leadTime';
export type { LeadTimeResult } from './leadTime';

// Deployment Frequency
export { calculateDeploymentFrequency } from './deploymentFrequency';

// Change Failure Rate
export { calculateChangeFailureRate } from './changeFailureRate';

// MTTR
export { calculateMTTR, calculateIncidentMetrics } from './mttr';
export type { IncidentMetricsResult } from './mttr';

// Date utilities
export { generateDateRange, isOnDate } from './dateUtils';

// Aggregators
export {
  calculateDailyMetrics,
  calculateMetricsForDate,
  calculateMetricsForRepository,
} from './aggregators';
export type {
  CalculateDailyMetricsOptions,
  CalculateMetricsForDateOptions,
  CalculateMetricsForRepositoryOptions,
} from './aggregators';
