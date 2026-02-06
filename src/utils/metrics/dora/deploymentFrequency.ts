/**
 * Deployment Frequency 計算
 */

import type { GitHubDeployment, GitHubWorkflowRun, DevOpsMetrics } from '../../../types';
import { getFrequencyCategory } from '../../../config/doraThresholds';

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
