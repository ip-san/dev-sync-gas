/**
 * Dashboardトレンド計算
 *
 * 週次トレンドデータの計算と前週比分析
 */

import type { DevOpsMetrics } from '../../../types';
import type { WeeklyTrendData } from '../dashboardTypes';

/**
 * メトリクスから週次トレンドを計算
 */
export function calculateWeeklyTrends(
  metrics: DevOpsMetrics[],
  weekCount: number = 8
): WeeklyTrendData[] {
  // 日付→週に変換
  const weeklyData = new Map<string, DevOpsMetrics[]>();

  for (const metric of metrics) {
    const date = new Date(metric.date);
    const week = getISOWeek(date);
    const existing = weeklyData.get(week) ?? [];
    existing.push(metric);
    weeklyData.set(week, existing);
  }

  // 週でソート（新しい順）
  const sortedWeeks = Array.from(weeklyData.keys()).sort().reverse().slice(0, weekCount);

  const trends: WeeklyTrendData[] = [];

  for (const week of sortedWeeks) {
    const weekMetrics = weeklyData.get(week) ?? [];

    const totalDeployments = weekMetrics.reduce((sum, m) => sum + m.deploymentCount, 0);

    const leadTimes = weekMetrics
      .map((m) => m.leadTimeForChangesHours)
      .filter((v): v is number => v !== null && v > 0);
    const avgLeadTime =
      leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null;

    const cfrs = weekMetrics.map((m) => m.changeFailureRate).filter((v): v is number => v !== null);
    const avgCfr = cfrs.length > 0 ? cfrs.reduce((a, b) => a + b, 0) / cfrs.length : null;

    trends.push({
      week,
      totalDeployments,
      avgLeadTimeHours: avgLeadTime,
      avgChangeFailureRate: avgCfr,
      avgCycleTimeHours: null, // 拡張指標統合時に設定
    });
  }

  return trends;
}

/**
 * ISO週番号を取得（YYYY-Www形式）
 */
function getISOWeek(date: Date): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * 前週比を計算
 */
export function calculateChange(current: number | null, previous: number | null): string {
  if (current === null || previous === null || previous === 0) {
    return '-';
  }

  const changePercent = ((current - previous) / previous) * 100;

  if (Math.abs(changePercent) < 1) {
    return '横ばい';
  } else if (changePercent > 0) {
    // リードタイム等は増加=悪化
    return `+${changePercent.toFixed(0)}%`;
  } else {
    return `${changePercent.toFixed(0)}%`;
  }
}
