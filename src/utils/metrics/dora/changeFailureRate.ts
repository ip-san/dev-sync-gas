/**
 * Change Failure Rate 計算
 */

import type { GitHubDeployment, GitHubWorkflowRun } from '../../../types';
import { DECIMAL_PRECISION_MULTIPLIER } from '../../../config/apiConfig';

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
    const rate =
      total > 0
        ? Math.round((failed / total) * 100 * DECIMAL_PRECISION_MULTIPLIER) /
          DECIMAL_PRECISION_MULTIPLIER
        : 0;
    return { total, failed, rate };
  }

  // フォールバック: ワークフロー実行
  const deploymentRuns = runs.filter((run) => run.name.toLowerCase().includes('deploy'));

  const total = deploymentRuns.length;
  const failed = deploymentRuns.filter((run) => run.conclusion === 'failure').length;
  const rate =
    total > 0
      ? Math.round((failed / total) * 100 * DECIMAL_PRECISION_MULTIPLIER) /
        DECIMAL_PRECISION_MULTIPLIER
      : 0;

  return { total, failed, rate };
}
