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
import { LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS } from '../../config/apiConfig';

// =============================================================================
// 定数
// =============================================================================

/** ミリ秒から時間への変換定数 */
const MS_TO_HOURS = 1000 * 60 * 60;

// =============================================================================
// Lead Time計算結果
// =============================================================================

export interface LeadTimeResult {
  /** 平均リードタイム（時間） */
  hours: number;
  /** PR作成→デプロイで計測されたPR数 */
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
 * （DORA公式: "committed to version control to deployed in production"）
 *
 * 計算方法:
 * 1. PR作成後の最初の成功デプロイメントを探す
 * 2. 見つかった場合: PR作成→デプロイ時間を計算
 * 3. デプロイデータがない場合: PR作成→マージ時間を計算（フォールバック）
 *
 * 参考: https://dora.dev/guides/dora-metrics/
 */
export function calculateLeadTime(
  prs: GitHubPullRequest[],
  deployments: GitHubDeployment[] = []
): number {
  return calculateLeadTimeDetailed(prs, deployments).hours;
}

/**
 * PR1件のLead Timeを計算してリストに追加
 */
interface PRLeadTimeResult {
  leadTimeHours: number | null;
  measurementType: 'merge-to-deploy' | 'create-to-merge';
}

function calculatePRLeadTime(
  pr: GitHubPullRequest,
  successfulDeployments: GitHubDeployment[]
): PRLeadTimeResult {
  const createdAt = new Date(pr.createdAt).getTime();
  const mergedAt = new Date(pr.mergedAt!).getTime();

  // デプロイメントデータがない場合は早期リターン
  if (successfulDeployments.length === 0) {
    const diffHours = (mergedAt - createdAt) / MS_TO_HOURS;
    return { leadTimeHours: diffHours, measurementType: 'create-to-merge' };
  }

  // PR作成後の最初のデプロイを探す
  const deploymentAfterCreation = successfulDeployments.find(
    (d) => new Date(d.createdAt).getTime() >= createdAt
  );

  // デプロイが見つからない場合はフォールバック
  if (!deploymentAfterCreation) {
    const diffHours = (mergedAt - createdAt) / MS_TO_HOURS;
    return { leadTimeHours: diffHours, measurementType: 'create-to-merge' };
  }

  const deployedAt = new Date(deploymentAfterCreation.createdAt).getTime();
  const mergeToDeployHours = (deployedAt - mergedAt) / MS_TO_HOURS;

  // マージからデプロイまでが閾値以内なら関連付ける
  if (mergeToDeployHours <= LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS) {
    const diffHours = (deployedAt - createdAt) / MS_TO_HOURS;
    return { leadTimeHours: diffHours, measurementType: 'merge-to-deploy' };
  }

  // 閾値を超えている場合はフォールバック
  const diffHours = (mergedAt - createdAt) / MS_TO_HOURS;
  return { leadTimeHours: diffHours, measurementType: 'create-to-merge' };
}

/**
 * Lead Timeの詳細計算（測定方法の内訳を含む）
 *
 * DORA公式定義に準拠: コミット（PR作成）→本番デプロイ
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
    const result = calculatePRLeadTime(pr, successfulDeployments);
    if (result.leadTimeHours !== null) {
      leadTimes.push(result.leadTimeHours);
      if (result.measurementType === 'merge-to-deploy') {
        mergeToDeployCount++;
      } else {
        createToMergeCount++;
      }
    }
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
// 日付ユーティリティ
// =============================================================================

/**
 * 日付範囲の配列を生成
 */
export function generateDateRange(since: Date, until: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(since);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(until);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * 日付が指定日と同じか判定（UTC基準）
 */
export function isOnDate(target: Date, date: Date): boolean {
  const targetStr = target.toISOString().split('T')[0];
  const dateStr = date.toISOString().split('T')[0];
  return targetStr === dateStr;
}

// =============================================================================
// 日別メトリクス計算
// =============================================================================

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
