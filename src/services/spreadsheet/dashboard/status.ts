/**
 * Dashboard健全性ステータス判定
 *
 * メトリクスから健全性ステータスを判定し、表示用にフォーマット
 */

import type { HealthStatus, HealthThresholds } from '../../../types';
import { DEFAULT_HEALTH_THRESHOLDS } from '../../../types/dashboard';
import { evaluateMetric, selectWorstStatus } from '../../../utils/healthStatus';

/**
 * 健全性ステータスを判定
 */
export function determineHealthStatus(
  leadTimeHours: number | null,
  changeFailureRate: number | null,
  cycleTimeHours: number | null,
  timeToFirstReviewHours: number | null,
  thresholds: HealthThresholds = DEFAULT_HEALTH_THRESHOLDS
): HealthStatus {
  // 各指標を評価
  const statuses = [
    evaluateMetric(leadTimeHours, thresholds.leadTime),
    evaluateMetric(changeFailureRate, thresholds.changeFailureRate),
    evaluateMetric(cycleTimeHours, thresholds.cycleTime),
    evaluateMetric(timeToFirstReviewHours, thresholds.timeToFirstReview),
  ];

  // 最も悪いステータスを選択
  return selectWorstStatus(statuses);
}

/**
 * ステータスを表示用文字列に変換（絵文字付き）
 */
export function formatStatus(status: HealthStatus): string {
  switch (status) {
    case 'good':
      return '🟢 良好';
    case 'warning':
      return '🟡 要注意';
    case 'critical':
      return '🔴 要対応';
  }
}
