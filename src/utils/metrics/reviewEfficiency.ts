/**
 * レビュー効率計算モジュール
 *
 * PRの各フェーズでの滞留時間を測定する。
 */

import type { ReviewEfficiencyMetrics, PRReviewData } from '../../types';
import { calculateStats } from './statsHelpers.js';

/**
 * 空のレビュー効率メトリクスを作成
 */
function createEmptyReviewEfficiencyMetrics(period: string): ReviewEfficiencyMetrics {
  return {
    period,
    prCount: 0,
    timeToFirstReview: {
      avgHours: null,
      medianHours: null,
      minHours: null,
      maxHours: null,
    },
    reviewDuration: {
      avgHours: null,
      medianHours: null,
      minHours: null,
      maxHours: null,
    },
    timeToMerge: {
      avgHours: null,
      medianHours: null,
      minHours: null,
      maxHours: null,
    },
    totalTime: {
      avgHours: null,
      medianHours: null,
      minHours: null,
      maxHours: null,
    },
    prDetails: [],
  };
}

/**
 * レビューデータから時間値を抽出
 */
function extractReviewTimeValues(reviewData: PRReviewData[]): {
  timeToFirstReview: number[];
  reviewDuration: number[];
  timeToMerge: number[];
  totalTime: number[];
} {
  return {
    timeToFirstReview: reviewData
      .map((pr) => pr.timeToFirstReviewHours)
      .filter((v): v is number => v !== null),
    reviewDuration: reviewData
      .map((pr) => pr.reviewDurationHours)
      .filter((v): v is number => v !== null),
    timeToMerge: reviewData.map((pr) => pr.timeToMergeHours).filter((v): v is number => v !== null),
    totalTime: reviewData.map((pr) => pr.totalTimeHours).filter((v): v is number => v !== null),
  };
}

/**
 * 統計値からレビュー効率メトリクスを構築
 */
function buildReviewEfficiencyMetrics(
  period: string,
  prCount: number,
  timeValues: ReturnType<typeof extractReviewTimeValues>,
  prDetails: PRReviewData[]
): ReviewEfficiencyMetrics {
  const timeToFirstReviewStats = calculateStats(timeValues.timeToFirstReview);
  const reviewDurationStats = calculateStats(timeValues.reviewDuration);
  const timeToMergeStats = calculateStats(timeValues.timeToMerge);
  const totalTimeStats = calculateStats(timeValues.totalTime);

  return {
    period,
    prCount,
    timeToFirstReview: {
      avgHours: timeToFirstReviewStats.avg,
      medianHours: timeToFirstReviewStats.median,
      minHours: timeToFirstReviewStats.min,
      maxHours: timeToFirstReviewStats.max,
    },
    reviewDuration: {
      avgHours: reviewDurationStats.avg,
      medianHours: reviewDurationStats.median,
      minHours: reviewDurationStats.min,
      maxHours: reviewDurationStats.max,
    },
    timeToMerge: {
      avgHours: timeToMergeStats.avg,
      medianHours: timeToMergeStats.median,
      minHours: timeToMergeStats.min,
      maxHours: timeToMergeStats.max,
    },
    totalTime: {
      avgHours: totalTimeStats.avg,
      medianHours: totalTimeStats.median,
      minHours: totalTimeStats.min,
      maxHours: totalTimeStats.max,
    },
    prDetails,
  };
}

/**
 * レビュー効率（Review Efficiency）を計算
 *
 * 定義: PRの各フェーズでの滞留時間を測定
 */
export function calculateReviewEfficiency(
  reviewData: PRReviewData[],
  period: string
): ReviewEfficiencyMetrics {
  if (reviewData.length === 0) {
    return createEmptyReviewEfficiencyMetrics(period);
  }

  const timeValues = extractReviewTimeValues(reviewData);
  return buildReviewEfficiencyMetrics(period, reviewData.length, timeValues, reviewData);
}
