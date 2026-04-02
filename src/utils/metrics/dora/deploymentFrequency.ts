/**
 * Deployment Frequency 計算
 */

import { getDeployWorkflowPatterns } from '../../../config/metrics';
import type { DevOpsMetrics, GitHubDeployment, GitHubWorkflowRun } from '../../../types';

// =============================================================================
// Deployment Frequency
// =============================================================================

/**
 * DORA Metrics: Deployment Frequency
 *
 * 定義: 本番環境へのデプロイ頻度（回/日）
 *
 * DORA分類の参考基準:
 * - Elite: 1回/日以上
 * - High: 0.14回/日以上（週1回以上）
 * - Medium: 0.03回/日以上（月1回以上）
 * - Low: 0.03回/日未満
 */
export function calculateDeploymentFrequency(
  deployments: GitHubDeployment[],
  runs: GitHubWorkflowRun[],
  periodDays: number
): { count: number; frequency: DevOpsMetrics['deploymentFrequency'] } {
  // 優先: GitHub Deployments API のデータ（成功のみ）
  const successfulDeploymentCount = deployments.filter((d) => d.status === 'success').length;

  // フォールバック: ワークフロー実行（設定されたパターンを含む成功したもの）
  let count: number;
  if (successfulDeploymentCount > 0) {
    count = successfulDeploymentCount;
  } else {
    const patterns = getDeployWorkflowPatterns();
    count = runs.filter((run) => {
      if (run.conclusion !== 'success') {
        return false;
      }
      const nameLower = run.name.toLowerCase();
      return patterns.some((pattern) => nameLower.includes(pattern.toLowerCase()));
    }).length;
  }

  // デプロイ頻度: 1日あたりのデプロイ回数
  const frequency = count / periodDays;

  return { count, frequency };
}
