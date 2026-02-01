/**
 * サイクルタイム計算モジュール
 *
 * Issue作成（着手）から productionブランチへのPRマージ（完了）までの時間を計算する。
 */

import type { CycleTimeMetrics, IssueCycleTime, IssueCycleTimeDetail } from '../../types';
import { calculateStats } from './statsHelpers.js';

/**
 * サイクルタイム（Cycle Time）を計算
 *
 * 定義: Issue作成（着手）から productionブランチへのPRマージ（完了）までの時間
 */
export function calculateCycleTime(
  cycleTimeData: IssueCycleTime[],
  period: string
): CycleTimeMetrics {
  // productionマージが完了しているIssueのみ対象
  const validIssues = cycleTimeData.filter(
    (issue) => issue.productionMergedAt !== null && issue.cycleTimeHours !== null
  );

  if (validIssues.length === 0) {
    return {
      period,
      completedTaskCount: 0,
      avgCycleTimeHours: null,
      medianCycleTimeHours: null,
      minCycleTimeHours: null,
      maxCycleTimeHours: null,
      issueDetails: [],
    };
  }

  const issueDetails: IssueCycleTimeDetail[] = validIssues.map((issue) => {
    // PRチェーンをサマリー文字列に変換（例: "#1→#2→#3"）
    const prChainSummary = issue.prChain.map((pr) => `#${pr.prNumber}`).join('→');

    return {
      issueNumber: issue.issueNumber,
      title: issue.issueTitle,
      repository: issue.repository,
      issueCreatedAt: issue.issueCreatedAt,
      productionMergedAt: issue.productionMergedAt!,
      cycleTimeHours: issue.cycleTimeHours!,
      prChainSummary,
    };
  });

  const cycleTimes = issueDetails.map((t) => t.cycleTimeHours);
  const stats = calculateStats(cycleTimes);

  return {
    period,
    completedTaskCount: validIssues.length,
    avgCycleTimeHours: stats.avg,
    medianCycleTimeHours: stats.median,
    minCycleTimeHours: stats.min,
    maxCycleTimeHours: stats.max,
    issueDetails,
  };
}
