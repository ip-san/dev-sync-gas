/**
 * DORA Four Key Metrics 計算モジュール
 *
 * デプロイ頻度、リードタイム、変更障害率、MTTRを計算する。
 */

import type {
  GitHubPullRequest,
  GitHubWorkflowRun,
  GitHubDeployment,
  GitHubIncident,
  DevOpsMetrics,
} from '../../types';
import { getFrequencyCategory } from '../../config/doraThresholds';

// =============================================================================
// 定数
// =============================================================================

/** ミリ秒から時間への変換定数 */
const MS_TO_HOURS = 1000 * 60 * 60;

/** Lead Time計算時のマージ→デプロイ関連付け最大時間（時間） */
const LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS = 24;

// =============================================================================
// Lead Time計算結果
// =============================================================================

export interface LeadTimeResult {
  /** 平均リードタイム（時間） */
  hours: number;
  /** マージ→デプロイで計測されたPR数 */
  mergeToDeployCount: number;
  /** PR作成→マージで計測されたPR数（フォールバック） */
  createToMergeCount: number;
}

// =============================================================================
// Lead Time for Changes
// =============================================================================

/**
 * DORA Metrics: Lead Time for Changes
 *
 * 定義: コードがコミットされてから本番環境にデプロイされるまでの時間
 *
 * 計算方法:
 * 1. マージ後24時間以内の成功デプロイメントを探す
 * 2. 見つかった場合: マージ→デプロイ時間を計算
 * 3. 見つからない場合: PR作成→マージ時間を計算（フォールバック）
 */
export function calculateLeadTime(
  prs: GitHubPullRequest[],
  deployments: GitHubDeployment[] = []
): number {
  return calculateLeadTimeDetailed(prs, deployments).hours;
}

/**
 * Lead Timeの詳細計算（測定方法の内訳を含む）
 */
export function calculateLeadTimeDetailed(
  prs: GitHubPullRequest[],
  deployments: GitHubDeployment[] = []
): LeadTimeResult {
  const mergedPRs = prs.filter((pr) => pr.mergedAt !== null);
  if (mergedPRs.length === 0) {
    return { hours: 0, mergeToDeployCount: 0, createToMergeCount: 0 };
  }

  const successfulDeployments = deployments
    .filter((d) => d.status === 'success')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const leadTimes: number[] = [];
  let mergeToDeployCount = 0;
  let createToMergeCount = 0;

  for (const pr of mergedPRs) {
    const mergedAt = new Date(pr.mergedAt!).getTime();

    // デプロイメントデータがある場合: マージ後の最初のデプロイを探す
    if (successfulDeployments.length > 0) {
      const deploymentAfterMerge = successfulDeployments.find(
        (d) => new Date(d.createdAt).getTime() >= mergedAt
      );

      if (deploymentAfterMerge) {
        const deployedAt = new Date(deploymentAfterMerge.createdAt).getTime();
        const diffHours = (deployedAt - mergedAt) / MS_TO_HOURS;
        // マージ後一定時間以内のデプロイのみを関連付ける
        if (diffHours <= LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS) {
          leadTimes.push(diffHours);
          mergeToDeployCount++;
          continue;
        }
      }
    }

    // フォールバック: PR作成からマージまでの時間
    const created = new Date(pr.createdAt).getTime();
    const diffHours = (mergedAt - created) / MS_TO_HOURS;
    leadTimes.push(diffHours);
    createToMergeCount++;
  }

  if (leadTimes.length === 0) {
    return { hours: 0, mergeToDeployCount: 0, createToMergeCount: 0 };
  }

  const totalHours = leadTimes.reduce((sum, hours) => sum + hours, 0);
  const hours = Math.round((totalHours / leadTimes.length) * 10) / 10;

  return { hours, mergeToDeployCount, createToMergeCount };
}

// =============================================================================
// Deployment Frequency
// =============================================================================

/**
 * DORA Metrics: Deployment Frequency
 *
 * 定義: 本番環境へのデプロイ頻度
 *
 * 分類基準 (DORA):
 * - Elite: 1日1回以上 (daily)
 * - High: 週1回以上 (weekly)
 * - Medium: 月1回以上 (monthly)
 * - Low: 月1回未満 (yearly)
 */
export function calculateDeploymentFrequency(
  deployments: GitHubDeployment[],
  runs: GitHubWorkflowRun[],
  periodDays: number
): { count: number; frequency: DevOpsMetrics['deploymentFrequency'] } {
  // 優先: GitHub Deployments API のデータ（成功のみ）
  const successfulDeploymentCount = deployments.filter((d) => d.status === 'success').length;

  // フォールバック: ワークフロー実行（"deploy"を含む成功したもの）
  let count: number;
  if (successfulDeploymentCount > 0) {
    count = successfulDeploymentCount;
  } else {
    count = runs.filter(
      (run) => run.conclusion === 'success' && run.name.toLowerCase().includes('deploy')
    ).length;
  }

  const avgPerDay = count / periodDays;
  const frequency = getFrequencyCategory(avgPerDay);

  return { count, frequency };
}

// =============================================================================
// Change Failure Rate
// =============================================================================

/**
 * DORA Metrics: Change Failure Rate
 *
 * 定義: 本番環境でインシデントを引き起こしたデプロイの割合
 *
 * 分類基準 (DORA 2024):
 * - Elite/High: 0-15%
 * - Medium: 16-30%
 * - Low: 30%超
 */
export function calculateChangeFailureRate(
  deployments: GitHubDeployment[],
  runs: GitHubWorkflowRun[]
): { total: number; failed: number; rate: number } {
  // ステータスが取得できているデプロイメントのみを対象とする
  const deploymentsWithStatus = deployments.filter((d) => d.status !== null);

  if (deploymentsWithStatus.length > 0) {
    const total = deploymentsWithStatus.length;
    const failed = deploymentsWithStatus.filter(
      (d) => d.status === 'failure' || d.status === 'error'
    ).length;
    const rate = total > 0 ? Math.round((failed / total) * 100 * 10) / 10 : 0;
    return { total, failed, rate };
  }

  // フォールバック: ワークフロー実行
  const deploymentRuns = runs.filter((run) => run.name.toLowerCase().includes('deploy'));

  const total = deploymentRuns.length;
  const failed = deploymentRuns.filter((run) => run.conclusion === 'failure').length;
  const rate = total > 0 ? Math.round((failed / total) * 100 * 10) / 10 : 0;

  return { total, failed, rate };
}

// =============================================================================
// Mean Time to Recovery (MTTR)
// =============================================================================

/**
 * DORA Metrics: Mean Time to Recovery
 *
 * 定義: 本番環境の障害から復旧するまでの時間
 *
 * 分類基準 (DORA):
 * - Elite: < 1時間
 * - High: 1-24時間
 * - Medium: 1-7日
 * - Low: > 7日
 */
export function calculateMTTR(
  deployments: GitHubDeployment[],
  runs: GitHubWorkflowRun[]
): number | null {
  // ステータスが取得できているデプロイメントのみを対象とする
  const deploymentsWithStatus = deployments.filter((d) => d.status !== null);

  if (deploymentsWithStatus.length > 0) {
    const sortedDeployments = [...deploymentsWithStatus].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return calculateRecoveryTime(
      sortedDeployments.map((d) => ({
        createdAt: d.createdAt,
        isFailure: d.status === 'failure' || d.status === 'error',
        isSuccess: d.status === 'success',
      }))
    );
  }

  // フォールバック: ワークフロー実行
  const deploymentRuns = runs
    .filter((run) => run.name.toLowerCase().includes('deploy'))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return calculateRecoveryTime(
    deploymentRuns.map((run) => ({
      createdAt: run.createdAt,
      isFailure: run.conclusion === 'failure',
      isSuccess: run.conclusion === 'success',
    }))
  );
}

/**
 * イベントの時系列から復旧時間を計算
 */
function calculateRecoveryTime(
  events: Array<{ createdAt: string; isFailure: boolean; isSuccess: boolean }>
): number | null {
  const recoveryTimes: number[] = [];
  let lastFailure: { createdAt: string } | null = null;

  for (const event of events) {
    if (event.isFailure) {
      lastFailure = event;
    } else if (event.isSuccess && lastFailure) {
      const failureTime = new Date(lastFailure.createdAt).getTime();
      const recoveryTime = new Date(event.createdAt).getTime();
      const diffHours = (recoveryTime - failureTime) / MS_TO_HOURS;
      recoveryTimes.push(diffHours);
      lastFailure = null;
    }
  }

  if (recoveryTimes.length === 0) {
    return null;
  }

  const avgMTTR = recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;
  return Math.round(avgMTTR * 10) / 10;
}

// =============================================================================
// Incident Metrics
// =============================================================================

export interface IncidentMetricsResult {
  incidentCount: number;
  openIncidents: number;
  mttrHours: number | null;
}

/**
 * インシデント（GitHub Issues）ベースのMTTRを計算
 *
 * 真のDORA定義に近いMTTR: Issue作成→Issue close
 */
export function calculateIncidentMetrics(incidents: GitHubIncident[]): IncidentMetricsResult {
  const closedIncidents = incidents.filter((i) => i.closedAt !== null);
  const openIncidents = incidents.filter((i) => i.state === 'open');

  if (closedIncidents.length === 0) {
    return {
      incidentCount: incidents.length,
      openIncidents: openIncidents.length,
      mttrHours: null,
    };
  }

  const recoveryTimes = closedIncidents.map((incident) => {
    const created = new Date(incident.createdAt).getTime();
    const closed = new Date(incident.closedAt!).getTime();
    return (closed - created) / MS_TO_HOURS;
  });

  const totalHours = recoveryTimes.reduce((sum, hours) => sum + hours, 0);
  const mttrHours = Math.round((totalHours / recoveryTimes.length) * 10) / 10;

  return {
    incidentCount: incidents.length,
    openIncidents: openIncidents.length,
    mttrHours,
  };
}

// =============================================================================
// リポジトリ単位のDORA Metrics計算
// =============================================================================

/**
 * リポジトリ単位でDORA metricsを計算する
 */
export function calculateMetricsForRepository(
  repository: string,
  prs: GitHubPullRequest[],
  runs: GitHubWorkflowRun[],
  deployments: GitHubDeployment[] = [],
  periodDays = 30,
  incidents: GitHubIncident[] = []
): DevOpsMetrics {
  const repoPRs = prs.filter((pr) => pr.repository === repository);
  const repoRuns = runs.filter((run) => run.repository === repository);
  const repoDeployments = deployments.filter((d) => d.repository === repository);
  const repoIncidents = incidents.filter((i) => i.repository === repository);

  const { count, frequency } = calculateDeploymentFrequency(repoDeployments, repoRuns, periodDays);
  const { total, failed, rate } = calculateChangeFailureRate(repoDeployments, repoRuns);
  const leadTimeResult = calculateLeadTimeDetailed(repoPRs, repoDeployments);

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
    meanTimeToRecoveryHours: calculateMTTR(repoDeployments, repoRuns),
  };

  // インシデントデータがある場合は真のMTTRを追加
  if (repoIncidents.length > 0) {
    const incidentMetrics = calculateIncidentMetrics(repoIncidents);
    metrics.incidentMetrics = incidentMetrics;
  }

  return metrics;
}
