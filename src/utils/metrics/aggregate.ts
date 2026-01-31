/**
 * 複数リポジトリ横断集計モジュール
 *
 * 複数リポジトリのDevOps指標を集計してサマリーを生成する。
 */

import type { DevOpsMetrics } from "../../types";

// =============================================================================
// 型定義
// =============================================================================

/**
 * リポジトリごとの集計サマリー
 */
export interface RepositorySummary {
  repository: string;
  dataPointCount: number;
  avgDeploymentCount: number;
  avgLeadTimeHours: number;
  avgChangeFailureRate: number;
  avgMttrHours: number | null;
  lastUpdated: string;
}

/**
 * 全リポジトリの横断集計サマリー
 */
export interface AggregatedSummary {
  repositorySummaries: RepositorySummary[];
  overallSummary: {
    totalRepositories: number;
    avgDeploymentCount: number;
    avgLeadTimeHours: number;
    avgChangeFailureRate: number;
    avgMttrHours: number | null;
  };
}

// =============================================================================
// 集計関数
// =============================================================================

/**
 * 複数リポジトリのDevOps指標を集計
 *
 * @param metrics - 各リポジトリ・各日のDevOpsMetrics配列
 * @returns リポジトリごとのサマリーと全体サマリー
 */
export function aggregateMultiRepoMetrics(
  metrics: DevOpsMetrics[]
): AggregatedSummary {
  if (metrics.length === 0) {
    return {
      repositorySummaries: [],
      overallSummary: {
        totalRepositories: 0,
        avgDeploymentCount: 0,
        avgLeadTimeHours: 0,
        avgChangeFailureRate: 0,
        avgMttrHours: null,
      },
    };
  }

  // リポジトリごとにグループ化
  const byRepository = new Map<string, DevOpsMetrics[]>();
  for (const m of metrics) {
    const existing = byRepository.get(m.repository) || [];
    existing.push(m);
    byRepository.set(m.repository, existing);
  }

  // 各リポジトリのサマリーを計算
  const repositorySummaries: RepositorySummary[] = [];
  for (const [repository, repoMetrics] of byRepository) {
    const deploymentCounts = repoMetrics.map((m) => m.deploymentCount);
    const leadTimes = repoMetrics.map((m) => m.leadTimeForChangesHours);
    const cfrs = repoMetrics.map((m) => m.changeFailureRate);
    const mttrs = repoMetrics
      .map((m) => m.meanTimeToRecoveryHours)
      .filter((v): v is number => v !== null);

    const avgDeployment =
      deploymentCounts.reduce((a, b) => a + b, 0) / deploymentCounts.length;
    const avgLeadTime =
      leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length;
    const avgCfr = cfrs.reduce((a, b) => a + b, 0) / cfrs.length;
    const avgMttr =
      mttrs.length > 0 ? mttrs.reduce((a, b) => a + b, 0) / mttrs.length : null;

    // 最終更新日を取得（最新の日付）
    const dates = repoMetrics.map((m) => m.date).sort();
    const lastUpdated = dates[dates.length - 1];

    repositorySummaries.push({
      repository,
      dataPointCount: repoMetrics.length,
      avgDeploymentCount: Math.round(avgDeployment * 10) / 10,
      avgLeadTimeHours: Math.round(avgLeadTime * 10) / 10,
      avgChangeFailureRate: Math.round(avgCfr * 10) / 10,
      avgMttrHours: avgMttr !== null ? Math.round(avgMttr * 10) / 10 : null,
      lastUpdated,
    });
  }

  // 全リポジトリ横断の平均を計算
  const allDeployments = repositorySummaries.map((s) => s.avgDeploymentCount);
  const allLeadTimes = repositorySummaries.map((s) => s.avgLeadTimeHours);
  const allCfrs = repositorySummaries.map((s) => s.avgChangeFailureRate);
  const allMttrs = repositorySummaries
    .map((s) => s.avgMttrHours)
    .filter((v): v is number => v !== null);

  const overallAvgDeployment =
    allDeployments.reduce((a, b) => a + b, 0) / allDeployments.length;
  const overallAvgLeadTime =
    allLeadTimes.reduce((a, b) => a + b, 0) / allLeadTimes.length;
  const overallAvgCfr = allCfrs.reduce((a, b) => a + b, 0) / allCfrs.length;
  const overallAvgMttr =
    allMttrs.length > 0
      ? allMttrs.reduce((a, b) => a + b, 0) / allMttrs.length
      : null;

  return {
    repositorySummaries,
    overallSummary: {
      totalRepositories: repositorySummaries.length,
      avgDeploymentCount: Math.round(overallAvgDeployment * 10) / 10,
      avgLeadTimeHours: Math.round(overallAvgLeadTime * 10) / 10,
      avgChangeFailureRate: Math.round(overallAvgCfr * 10) / 10,
      avgMttrHours:
        overallAvgMttr !== null ? Math.round(overallAvgMttr * 10) / 10 : null,
    },
  };
}
