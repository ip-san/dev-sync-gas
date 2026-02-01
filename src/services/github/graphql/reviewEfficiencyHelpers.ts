/**
 * レビュー効率データ計算のヘルパー関数
 *
 * getReviewEfficiencyDataForPRsGraphQL の複雑度削減のため分離
 */

import type { PRReviewData } from '../../../types/index.js';
import type { GraphQLPullRequestDetail, GraphQLReview, GraphQLTimelineEvent } from './types.js';

const MS_TO_HOURS = 1000 * 60 * 60;

/**
 * Ready for Review時刻を抽出
 */
export function extractReadyForReviewTime(
  createdAt: string,
  timeline: GraphQLTimelineEvent[]
): string {
  const readyEvent = timeline.find((e) => e.__typename === 'ReadyForReviewEvent');
  return readyEvent?.createdAt ?? createdAt;
}

/**
 * 有効なレビューをフィルタリング・ソート
 */
export function filterAndSortReviews(reviews: GraphQLReview[]): GraphQLReview[] {
  return reviews
    .filter((r) => r.state !== 'PENDING' && r.submittedAt)
    .sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime());
}

/**
 * レビュー時刻情報を抽出
 */
export interface ReviewTimes {
  firstReviewAt: string | null;
  approvedAt: string | null;
}

export function extractReviewTimes(reviews: GraphQLReview[]): ReviewTimes {
  const validReviews = filterAndSortReviews(reviews);
  const firstReviewAt = validReviews.length > 0 ? validReviews[0].submittedAt : null;
  const approvedReview = validReviews.find((r) => r.state === 'APPROVED');
  const approvedAt = approvedReview?.submittedAt ?? null;

  return { firstReviewAt, approvedAt };
}

/**
 * レビュー効率指標を計算
 */
export interface ReviewMetrics {
  timeToFirstReviewHours: number | null;
  reviewDurationHours: number | null;
  timeToMergeHours: number | null;
  totalTimeHours: number | null;
}

export function calculateReviewMetrics(
  readyForReviewAt: string,
  firstReviewAt: string | null,
  approvedAt: string | null,
  mergedAt: string | null
): ReviewMetrics {
  const readyAt = new Date(readyForReviewAt).getTime();
  let timeToFirstReviewHours: number | null = null;
  let reviewDurationHours: number | null = null;
  let timeToMergeHours: number | null = null;
  let totalTimeHours: number | null = null;

  if (firstReviewAt) {
    timeToFirstReviewHours =
      Math.round(((new Date(firstReviewAt).getTime() - readyAt) / MS_TO_HOURS) * 10) / 10;
  }

  if (firstReviewAt && approvedAt) {
    reviewDurationHours =
      Math.round(
        ((new Date(approvedAt).getTime() - new Date(firstReviewAt).getTime()) / MS_TO_HOURS) * 10
      ) / 10;
  }

  if (approvedAt && mergedAt) {
    timeToMergeHours =
      Math.round(
        ((new Date(mergedAt).getTime() - new Date(approvedAt).getTime()) / MS_TO_HOURS) * 10
      ) / 10;
  }

  if (mergedAt) {
    totalTimeHours = Math.round(((new Date(mergedAt).getTime() - readyAt) / MS_TO_HOURS) * 10) / 10;
  }

  return {
    timeToFirstReviewHours,
    reviewDurationHours,
    timeToMergeHours,
    totalTimeHours,
  };
}

/**
 * PR1件分のレビュー効率データを計算
 */
export function calculateReviewDataForPR(
  prData: GraphQLPullRequestDetail,
  repoFullName: string
): PRReviewData {
  const reviews = prData.reviews?.nodes ?? [];
  const timeline = prData.timelineItems?.nodes ?? [];

  // Ready for Review時刻を取得
  const readyForReviewAt = extractReadyForReviewTime(prData.createdAt, timeline);

  // レビュー情報を処理
  const { firstReviewAt, approvedAt } = extractReviewTimes(reviews);

  // 各時間を計算
  const metrics = calculateReviewMetrics(
    readyForReviewAt,
    firstReviewAt,
    approvedAt,
    prData.mergedAt
  );

  return {
    prNumber: prData.number,
    title: prData.title,
    repository: repoFullName,
    createdAt: prData.createdAt,
    readyForReviewAt,
    firstReviewAt,
    approvedAt,
    mergedAt: prData.mergedAt,
    ...metrics,
  };
}

/**
 * レビューデータがない場合のデフォルト値を生成
 */
export function createDefaultReviewData(pr: {
  number: number;
  title: string;
  repository: string;
  createdAt: string;
  mergedAt: string | null;
}): PRReviewData {
  return {
    prNumber: pr.number,
    title: pr.title,
    repository: pr.repository,
    createdAt: pr.createdAt,
    readyForReviewAt: pr.createdAt,
    firstReviewAt: null,
    approvedAt: null,
    mergedAt: pr.mergedAt,
    timeToFirstReviewHours: null,
    reviewDurationHours: null,
    timeToMergeHours: null,
    totalTimeHours: null,
  };
}
