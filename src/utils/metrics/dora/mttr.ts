/**
 * Mean Time to Recovery (MTTR) 計算
 */

import type { GitHubDeployment, GitHubWorkflowRun, GitHubIncident } from '../../../types';
import { MS_TO_HOURS } from './constants';

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
