/**
 * Lead Time for Changes 計算
 */

import type { GitHubPullRequest, GitHubDeployment } from '../../../types';
import {
  LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS,
  DECIMAL_PRECISION_MULTIPLIER,
} from '../../../config/apiConfig';
import { MS_TO_HOURS } from './constants';

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
  const hours =
    Math.round((totalHours / leadTimes.length) * DECIMAL_PRECISION_MULTIPLIER) /
    DECIMAL_PRECISION_MULTIPLIER;

  return { hours, mergeToDeployCount, createToMergeCount };
}
