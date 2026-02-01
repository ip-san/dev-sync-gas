/**
 * 手戻り率計算モジュール
 *
 * PR作成後の追加コミット数とForce Push回数を測定する。
 */

import type { ReworkRateMetrics, PRReworkData } from '../../types';
import { calculateStats } from './statsHelpers.js';

/**
 * 手戻り率（Rework Rate）を計算
 *
 * 定義: PR作成後の追加コミット数とForce Push回数を測定
 */
export function calculateReworkRate(reworkData: PRReworkData[], period: string): ReworkRateMetrics {
  if (reworkData.length === 0) {
    return {
      period,
      prCount: 0,
      additionalCommits: {
        total: 0,
        avgPerPr: null,
        median: null,
        max: null,
      },
      forcePushes: {
        total: 0,
        avgPerPr: null,
        prsWithForcePush: 0,
        forcePushRate: null,
      },
      prDetails: [],
    };
  }

  // 追加コミット統計
  const additionalCommitCounts = reworkData.map((pr) => pr.additionalCommits);
  const commitStats = calculateStats(additionalCommitCounts);
  const totalAdditionalCommits = additionalCommitCounts.reduce((sum, count) => sum + count, 0);
  const avgAdditionalCommits = totalAdditionalCommits / reworkData.length;

  // Force Push統計
  const forcePushCounts = reworkData.map((pr) => pr.forcePushCount);
  const totalForcePushes = forcePushCounts.reduce((sum, count) => sum + count, 0);
  const prsWithForcePush = reworkData.filter((pr) => pr.forcePushCount > 0).length;
  const avgForcePushes = totalForcePushes / reworkData.length;
  const forcePushRate = (prsWithForcePush / reworkData.length) * 100;

  return {
    period,
    prCount: reworkData.length,
    additionalCommits: {
      total: totalAdditionalCommits,
      avgPerPr: Math.round(avgAdditionalCommits * 10) / 10,
      median: commitStats.median,
      max: commitStats.max,
    },
    forcePushes: {
      total: totalForcePushes,
      avgPerPr: Math.round(avgForcePushes * 10) / 10,
      prsWithForcePush,
      forcePushRate: Math.round(forcePushRate * 10) / 10,
    },
    prDetails: reworkData,
  };
}
