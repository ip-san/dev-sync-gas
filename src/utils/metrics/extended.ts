/**
 * 拡張指標計算モジュール
 *
 * サイクルタイム、コーディング時間、手戻り率、レビュー効率、PRサイズを計算する。
 */

import type {
  CycleTimeMetrics,
  IssueCycleTimeDetail,
  IssueCycleTime,
  CodingTimeMetrics,
  IssueCodingTimeDetail,
  IssueCodingTime,
  ReworkRateMetrics,
  PRReworkData,
  ReviewEfficiencyMetrics,
  PRReviewData,
  PRSizeMetrics,
  PRSizeData,
} from '../../types';

// =============================================================================
// 統計計算ヘルパー
// =============================================================================

/**
 * 配列の統計値（平均、中央値、最小値、最大値）を計算
 */
function calculateStats(values: number[]): {
  avg: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
} {
  if (values.length === 0) {
    return { avg: null, median: null, min: null, max: null };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const avg = Math.round((sum / values.length) * 10) / 10;

  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? Math.round(sorted[mid] * 10) / 10
      : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;

  const min = Math.round(sorted[0] * 10) / 10;
  const max = Math.round(sorted[sorted.length - 1] * 10) / 10;

  return { avg, median, min, max };
}

// =============================================================================
// サイクルタイム
// =============================================================================

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

// =============================================================================
// コーディング時間
// =============================================================================

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

// =============================================================================
// 手戻り率
// =============================================================================

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

// =============================================================================
// レビュー効率
// =============================================================================

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

  // 各時間を抽出（nullを除外）
  const timeToFirstReviewValues = reviewData
    .map((pr) => pr.timeToFirstReviewHours)
    .filter((v): v is number => v !== null);

  const reviewDurationValues = reviewData
    .map((pr) => pr.reviewDurationHours)
    .filter((v): v is number => v !== null);

  const timeToMergeValues = reviewData
    .map((pr) => pr.timeToMergeHours)
    .filter((v): v is number => v !== null);

  const totalTimeValues = reviewData
    .map((pr) => pr.totalTimeHours)
    .filter((v): v is number => v !== null);

  // 統計値を計算
  const timeToFirstReviewStats = calculateStats(timeToFirstReviewValues);
  const reviewDurationStats = calculateStats(reviewDurationValues);
  const timeToMergeStats = calculateStats(timeToMergeValues);
  const totalTimeStats = calculateStats(totalTimeValues);

  return {
    period,
    prCount: reviewData.length,
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
    prDetails: reviewData,
  };
}

// =============================================================================
// PRサイズ
// =============================================================================

/**
 * PRサイズ（PR Size）を計算
 *
 * 定義: PRの変更行数と変更ファイル数を測定
 */
export function calculatePRSize(sizeData: PRSizeData[], period: string): PRSizeMetrics {
  if (sizeData.length === 0) {
    return {
      period,
      prCount: 0,
      linesOfCode: { total: 0, avg: null, median: null, min: null, max: null },
      filesChanged: { total: 0, avg: null, median: null, min: null, max: null },
      prDetails: [],
    };
  }

  // 変更行数の統計
  const locValues = sizeData.map((pr) => pr.linesOfCode);
  const locStats = calculateStats(locValues);
  const locTotal = locValues.reduce((sum, val) => sum + val, 0);

  // 変更ファイル数の統計
  const filesValues = sizeData.map((pr) => pr.filesChanged);
  const filesStats = calculateStats(filesValues);
  const filesTotal = filesValues.reduce((sum, val) => sum + val, 0);

  return {
    period,
    prCount: sizeData.length,
    linesOfCode: {
      total: locTotal,
      avg: locStats.avg,
      median: locStats.median,
      min: locStats.min,
      max: locStats.max,
    },
    filesChanged: {
      total: filesTotal,
      avg: filesStats.avg,
      median: filesStats.median,
      min: filesStats.min,
      max: filesStats.max,
    },
    prDetails: sizeData,
  };
}
