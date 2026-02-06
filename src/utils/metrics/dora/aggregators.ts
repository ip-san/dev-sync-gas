/**
 * DORA Metrics集計関数
 *
 * 日別メトリクス計算、リポジトリ単位の集計を行う。
 */

import type {
  GitHubPullRequest,
  GitHubWorkflowRun,
  GitHubDeployment,
  GitHubIncident,
  DevOpsMetrics,
} from '../../../types';
import { calculateLeadTimeDetailed } from './leadTime';
import { calculateDeploymentFrequency } from './deploymentFrequency';
import { calculateChangeFailureRate } from './changeFailureRate';
import { calculateMTTR, calculateIncidentMetrics } from './mttr';
import { generateDateRange, isOnDate } from './dateUtils';

// =============================================================================
// 日別メトリクス計算
// =============================================================================

/**
 * calculateDailyMetrics のオプション
 */
export interface CalculateDailyMetricsOptions {
  repositories: { fullName: string }[];
  prs: GitHubPullRequest[];
  runs: GitHubWorkflowRun[];
  deployments: GitHubDeployment[];
  dateRange: { since: Date; until: Date };
}

/**
 * 日別にグループ化してメトリクスを計算
 *
 * @param repositories - 対象リポジトリ一覧
 * @param prs - 全期間のPR
 * @param runs - 全期間のワークフロー実行
 * @param deployments - 全期間のデプロイメント
 * @param dateRange - 期間
 * @returns 日別・リポジトリ別のメトリクス配列
 */
export function calculateDailyMetrics(options: CalculateDailyMetricsOptions): DevOpsMetrics[] {
  const { repositories, prs, runs, deployments, dateRange } = options;
  const metrics: DevOpsMetrics[] = [];

  // 期間内の各日付を生成
  const dates = generateDateRange(dateRange.since, dateRange.until);

  for (const date of dates) {
    const dateStr = date.toISOString().split('T')[0];

    for (const repo of repositories) {
      // その日にマージされたPRをフィルタ
      const dayPRs = prs.filter(
        (pr) =>
          pr.repository === repo.fullName &&
          pr.mergedAt !== null &&
          isOnDate(new Date(pr.mergedAt), date)
      );

      // その日のデプロイメントをフィルタ
      const dayDeployments = deployments.filter(
        (d) => d.repository === repo.fullName && isOnDate(new Date(d.createdAt), date)
      );

      // その日のワークフロー実行をフィルタ
      const dayRuns = runs.filter(
        (r) => r.repository === repo.fullName && isOnDate(new Date(r.createdAt), date)
      );

      // 日別メトリクス計算
      const dayMetrics = calculateMetricsForDate({
        repository: repo.fullName,
        dateStr,
        prs: dayPRs,
        runs: dayRuns,
        deployments: dayDeployments,
      });

      metrics.push(dayMetrics);
    }
  }

  return metrics;
}

/**
 * calculateMetricsForDate のオプション
 */
export interface CalculateMetricsForDateOptions {
  repository: string;
  dateStr: string;
  prs: GitHubPullRequest[];
  runs: GitHubWorkflowRun[];
  deployments: GitHubDeployment[];
}

/**
 * 指定日付でメトリクスを計算
 */
export function calculateMetricsForDate(options: CalculateMetricsForDateOptions): DevOpsMetrics {
  const { repository, dateStr, prs, runs, deployments } = options;
  // 1日あたりのメトリクス計算（periodDays = 1）
  const { count, frequency } = calculateDeploymentFrequency(deployments, runs, 1);
  const { total, failed, rate } = calculateChangeFailureRate(deployments, runs);
  const leadTimeResult = calculateLeadTimeDetailed(prs, deployments);

  return {
    date: dateStr,
    repository,
    deploymentCount: count,
    deploymentFrequency: frequency,
    leadTimeForChangesHours: leadTimeResult.hours,
    leadTimeMeasurement: {
      mergeToDeployCount: leadTimeResult.mergeToDeployCount,
      createToMergeCount: leadTimeResult.createToMergeCount,
    },
    totalDeployments: total,
    failedDeployments: failed,
    changeFailureRate: rate,
    meanTimeToRecoveryHours: calculateMTTR(deployments, runs),
  };
}

// =============================================================================
// リポジトリ単位のDORA Metrics計算
// =============================================================================

/**
 * calculateMetricsForRepository のオプション
 */
export interface CalculateMetricsForRepositoryOptions {
  repository: string;
  prs: GitHubPullRequest[];
  runs: GitHubWorkflowRun[];
  deployments?: GitHubDeployment[];
  periodDays?: number;
  incidents?: GitHubIncident[];
}

/**
 * リポジトリ単位でDORA metricsを計算する
 */
export function calculateMetricsForRepository(
  options: CalculateMetricsForRepositoryOptions
): DevOpsMetrics {
  const { repository, prs, runs, deployments = [], periodDays = 30, incidents = [] } = options;
  const repoPRs = prs.filter((pr) => pr.repository === repository);
  const repoRuns = runs.filter((run) => run.repository === repository);
  const repoDeployments = deployments.filter((d) => d.repository === repository);
  const repoIncidents = incidents.filter((i) => i.repository === repository);

  const { count, frequency } = calculateDeploymentFrequency(repoDeployments, repoRuns, periodDays);
  const { total, failed, rate } = calculateChangeFailureRate(repoDeployments, repoRuns);
  const leadTimeResult = calculateLeadTimeDetailed(repoPRs, repoDeployments);

  // MTTR: Incident Issueを優先、フォールバックはデプロイメント/ワークフロー
  let mttrHours: number | null = null;
  let incidentMetrics;

  if (repoIncidents.length > 0) {
    // 優先: Incident Issueベースの真のMTTR
    incidentMetrics = calculateIncidentMetrics(repoIncidents);
    mttrHours = incidentMetrics.mttrHours;
  } else {
    // フォールバック: デプロイメント/ワークフローベース
    mttrHours = calculateMTTR(repoDeployments, repoRuns);
  }

  const metrics: DevOpsMetrics = {
    date: new Date().toISOString().split('T')[0],
    repository,
    deploymentCount: count,
    deploymentFrequency: frequency,
    leadTimeForChangesHours: leadTimeResult.hours,
    leadTimeMeasurement: {
      mergeToDeployCount: leadTimeResult.mergeToDeployCount,
      createToMergeCount: leadTimeResult.createToMergeCount,
    },
    totalDeployments: total,
    failedDeployments: failed,
    changeFailureRate: rate,
    meanTimeToRecoveryHours: mttrHours,
  };

  // インシデントメトリクスがある場合は追加情報として保持
  if (incidentMetrics) {
    metrics.incidentMetrics = incidentMetrics;
  }

  return metrics;
}
