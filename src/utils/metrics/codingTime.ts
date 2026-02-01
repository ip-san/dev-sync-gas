/**
 * コーディング時間計算モジュール
 *
 * Issue作成（GitHub）からPR作成（GitHub）までの時間を計算する。
 */

import type { CodingTimeMetrics, IssueCodingTime, IssueCodingTimeDetail } from '../../types';
import { calculateStats } from './statsHelpers.js';

/**
 * コーディング時間（Coding Time）を計算
 *
 * 定義: Issue作成（GitHub）からPR作成（GitHub）までの時間
 */
export function calculateCodingTime(
  codingTimeData: IssueCodingTime[],
  period: string
): CodingTimeMetrics {
  // PRがリンクされているIssueのみ対象
  const validIssues = codingTimeData.filter(
    (issue) =>
      issue.prCreatedAt !== null && issue.codingTimeHours !== null && issue.codingTimeHours >= 0
  );

  if (validIssues.length === 0) {
    return {
      period,
      issueCount: 0,
      avgCodingTimeHours: null,
      medianCodingTimeHours: null,
      minCodingTimeHours: null,
      maxCodingTimeHours: null,
      issueDetails: [],
    };
  }

  const issueDetails: IssueCodingTimeDetail[] = validIssues.map((issue) => ({
    issueNumber: issue.issueNumber,
    title: issue.issueTitle,
    repository: issue.repository,
    issueCreatedAt: issue.issueCreatedAt,
    prCreatedAt: issue.prCreatedAt!,
    prNumber: issue.prNumber!,
    codingTimeHours: issue.codingTimeHours!,
  }));

  const codingTimes = issueDetails.map((t) => t.codingTimeHours);
  const stats = calculateStats(codingTimes);

  return {
    period,
    issueCount: validIssues.length,
    avgCodingTimeHours: stats.avg,
    medianCodingTimeHours: stats.median,
    minCodingTimeHours: stats.min,
    maxCodingTimeHours: stats.max,
    issueDetails,
  };
}
