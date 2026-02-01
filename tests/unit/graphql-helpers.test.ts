/**
 * GraphQL Helper Functions のユニットテスト
 *
 * reviewEfficiencyHelpers, reworkHelpers, prSizeHelpers の
 * ロジック検証とエッジケーステスト
 */

import { describe, it, expect } from 'bun:test';
import {
  extractReadyForReviewTime,
  filterAndSortReviews,
  extractReviewTimes,
  calculateReviewMetrics,
  calculateReviewDataForPR,
  createDefaultReviewData,
} from '../../src/services/github/graphql/reviewEfficiencyHelpers';
import {
  countAdditionalCommits,
  countForcePushes,
  calculateReworkDataForPR,
  createDefaultReworkData,
} from '../../src/services/github/graphql/reworkHelpers';
import { calculatePRSizeData } from '../../src/services/github/graphql/prSizeHelpers';
import type {
  GraphQLReview,
  GraphQLTimelineEvent,
  GraphQLPullRequestDetail,
  GraphQLCommit,
} from '../../src/services/github/graphql/types';

describe('GraphQL Helper Functions', () => {
  describe('Review Efficiency Helpers', () => {
    describe('extractReadyForReviewTime', () => {
      it('should return ReadyForReviewEvent time when available', () => {
        const createdAt = '2024-01-01T10:00:00Z';
        const timeline: GraphQLTimelineEvent[] = [
          {
            __typename: 'ReadyForReviewEvent',
            createdAt: '2024-01-01T12:00:00Z',
          },
        ];

        const result = extractReadyForReviewTime(createdAt, timeline);
        expect(result).toBe('2024-01-01T12:00:00Z');
      });

      it('should return createdAt when no ReadyForReviewEvent', () => {
        const createdAt = '2024-01-01T10:00:00Z';
        const timeline: GraphQLTimelineEvent[] = [];

        const result = extractReadyForReviewTime(createdAt, timeline);
        expect(result).toBe(createdAt);
      });

      it('should return first ReadyForReviewEvent when multiple exist', () => {
        const createdAt = '2024-01-01T10:00:00Z';
        const timeline: GraphQLTimelineEvent[] = [
          {
            __typename: 'ReadyForReviewEvent',
            createdAt: '2024-01-01T12:00:00Z',
          },
          {
            __typename: 'ReadyForReviewEvent',
            createdAt: '2024-01-01T14:00:00Z',
          },
        ];

        const result = extractReadyForReviewTime(createdAt, timeline);
        expect(result).toBe('2024-01-01T12:00:00Z');
      });
    });

    describe('filterAndSortReviews', () => {
      it('should filter out PENDING reviews', () => {
        const reviews: GraphQLReview[] = [
          {
            state: 'PENDING',
            submittedAt: '2024-01-01T10:00:00Z',
          },
          {
            state: 'APPROVED',
            submittedAt: '2024-01-01T11:00:00Z',
          },
        ];

        const result = filterAndSortReviews(reviews);
        expect(result).toHaveLength(1);
        expect(result[0].state).toBe('APPROVED');
      });

      it('should filter out reviews without submittedAt', () => {
        const reviews: GraphQLReview[] = [
          {
            state: 'APPROVED',
            submittedAt: null,
          },
          {
            state: 'APPROVED',
            submittedAt: '2024-01-01T11:00:00Z',
          },
        ];

        const result = filterAndSortReviews(reviews);
        expect(result).toHaveLength(1);
        expect(result[0].submittedAt).toBe('2024-01-01T11:00:00Z');
      });

      it('should sort reviews by submittedAt (earliest first)', () => {
        const reviews: GraphQLReview[] = [
          {
            state: 'COMMENTED',
            submittedAt: '2024-01-01T14:00:00Z',
          },
          {
            state: 'APPROVED',
            submittedAt: '2024-01-01T10:00:00Z',
          },
          {
            state: 'CHANGES_REQUESTED',
            submittedAt: '2024-01-01T12:00:00Z',
          },
        ];

        const result = filterAndSortReviews(reviews);
        expect(result).toHaveLength(3);
        expect(result[0].submittedAt).toBe('2024-01-01T10:00:00Z');
        expect(result[1].submittedAt).toBe('2024-01-01T12:00:00Z');
        expect(result[2].submittedAt).toBe('2024-01-01T14:00:00Z');
      });

      it('should return empty array when all reviews are invalid', () => {
        const reviews: GraphQLReview[] = [
          {
            state: 'PENDING',
            submittedAt: '2024-01-01T10:00:00Z',
          },
          {
            state: 'APPROVED',
            submittedAt: null,
          },
        ];

        const result = filterAndSortReviews(reviews);
        expect(result).toHaveLength(0);
      });
    });

    describe('extractReviewTimes', () => {
      it('should extract first review and approval times', () => {
        const reviews: GraphQLReview[] = [
          {
            state: 'COMMENTED',
            submittedAt: '2024-01-01T10:00:00Z',
          },
          {
            state: 'APPROVED',
            submittedAt: '2024-01-01T14:00:00Z',
          },
        ];

        const result = extractReviewTimes(reviews);
        expect(result.firstReviewAt).toBe('2024-01-01T10:00:00Z');
        expect(result.approvedAt).toBe('2024-01-01T14:00:00Z');
      });

      it('should return null when no reviews exist', () => {
        const reviews: GraphQLReview[] = [];

        const result = extractReviewTimes(reviews);
        expect(result.firstReviewAt).toBeNull();
        expect(result.approvedAt).toBeNull();
      });

      it('should return null for approvedAt when no APPROVED review', () => {
        const reviews: GraphQLReview[] = [
          {
            state: 'COMMENTED',
            submittedAt: '2024-01-01T10:00:00Z',
          },
          {
            state: 'CHANGES_REQUESTED',
            submittedAt: '2024-01-01T12:00:00Z',
          },
        ];

        const result = extractReviewTimes(reviews);
        expect(result.firstReviewAt).toBe('2024-01-01T10:00:00Z');
        expect(result.approvedAt).toBeNull();
      });

      it('should handle multiple approvals (use first)', () => {
        const reviews: GraphQLReview[] = [
          {
            state: 'APPROVED',
            submittedAt: '2024-01-01T10:00:00Z',
          },
          {
            state: 'APPROVED',
            submittedAt: '2024-01-01T14:00:00Z',
          },
        ];

        const result = extractReviewTimes(reviews);
        expect(result.firstReviewAt).toBe('2024-01-01T10:00:00Z');
        expect(result.approvedAt).toBe('2024-01-01T10:00:00Z');
      });
    });

    describe('calculateReviewMetrics', () => {
      it('should calculate time to first review (2 hours)', () => {
        const readyAt = '2024-01-01T10:00:00Z';
        const firstReviewAt = '2024-01-01T12:00:00Z';

        const result = calculateReviewMetrics(readyAt, firstReviewAt, null, null);
        expect(result.timeToFirstReviewHours).toBe(2.0);
      });

      it('should calculate review duration (4 hours)', () => {
        const readyAt = '2024-01-01T10:00:00Z';
        const firstReviewAt = '2024-01-01T10:00:00Z';
        const approvedAt = '2024-01-01T14:00:00Z';

        const result = calculateReviewMetrics(readyAt, firstReviewAt, approvedAt, null);
        expect(result.reviewDurationHours).toBe(4.0);
      });

      it('should calculate time to merge (0.5 hours)', () => {
        const readyAt = '2024-01-01T10:00:00Z';
        const approvedAt = '2024-01-01T14:00:00Z';
        const mergedAt = '2024-01-01T14:30:00Z';

        const result = calculateReviewMetrics(readyAt, null, approvedAt, mergedAt);
        expect(result.timeToMergeHours).toBe(0.5);
      });

      it('should calculate total time (6 hours)', () => {
        const readyAt = '2024-01-01T10:00:00Z';
        const mergedAt = '2024-01-01T16:00:00Z';

        const result = calculateReviewMetrics(readyAt, null, null, mergedAt);
        expect(result.totalTimeHours).toBe(6.0);
      });

      it('should round to 1 decimal place', () => {
        const readyAt = '2024-01-01T10:00:00Z';
        const firstReviewAt = '2024-01-01T10:20:00Z'; // 20分 = 0.333...時間

        const result = calculateReviewMetrics(readyAt, firstReviewAt, null, null);
        expect(result.timeToFirstReviewHours).toBe(0.3);
      });

      it('should return null for all metrics when no reviews or merge', () => {
        const readyAt = '2024-01-01T10:00:00Z';

        const result = calculateReviewMetrics(readyAt, null, null, null);
        expect(result.timeToFirstReviewHours).toBeNull();
        expect(result.reviewDurationHours).toBeNull();
        expect(result.timeToMergeHours).toBeNull();
        expect(result.totalTimeHours).toBeNull();
      });

      it('should handle same-time events (0 hours)', () => {
        const readyAt = '2024-01-01T10:00:00Z';
        const firstReviewAt = '2024-01-01T10:00:00Z';
        const approvedAt = '2024-01-01T10:00:00Z';
        const mergedAt = '2024-01-01T10:00:00Z';

        const result = calculateReviewMetrics(readyAt, firstReviewAt, approvedAt, mergedAt);
        expect(result.timeToFirstReviewHours).toBe(0.0);
        expect(result.reviewDurationHours).toBe(0.0);
        expect(result.timeToMergeHours).toBe(0.0);
        expect(result.totalTimeHours).toBe(0.0);
      });

      it('should handle timezone differences correctly', () => {
        // UTC vs JST（UTC時刻で統一されている前提）
        const readyAt = '2024-01-01T10:00:00Z'; // UTC 10:00
        const firstReviewAt = '2024-01-01T19:00:00Z'; // UTC 19:00 (JST 04:00+1)

        const result = calculateReviewMetrics(readyAt, firstReviewAt, null, null);
        expect(result.timeToFirstReviewHours).toBe(9.0);
      });

      it('should handle very long duration (24+ hours)', () => {
        const readyAt = '2024-01-01T10:00:00Z';
        const firstReviewAt = '2024-01-03T10:00:00Z'; // 2日後

        const result = calculateReviewMetrics(readyAt, firstReviewAt, null, null);
        expect(result.timeToFirstReviewHours).toBe(48.0);
      });
    });

    describe('calculateReviewDataForPR', () => {
      it('should calculate complete review data', () => {
        const prData: GraphQLPullRequestDetail = {
          number: 123,
          title: 'Test PR',
          createdAt: '2024-01-01T10:00:00Z',
          mergedAt: '2024-01-01T16:00:00Z',
          reviews: {
            nodes: [
              {
                state: 'COMMENTED',
                submittedAt: '2024-01-01T12:00:00Z',
              },
              {
                state: 'APPROVED',
                submittedAt: '2024-01-01T14:00:00Z',
              },
            ],
          },
          timelineItems: {
            nodes: [],
          },
          commits: {
            nodes: [],
          },
        };

        const result = calculateReviewDataForPR(prData, 'owner/repo');
        expect(result.prNumber).toBe(123);
        expect(result.repository).toBe('owner/repo');
        expect(result.firstReviewAt).toBe('2024-01-01T12:00:00Z');
        expect(result.approvedAt).toBe('2024-01-01T14:00:00Z');
        expect(result.timeToFirstReviewHours).toBe(2.0);
        expect(result.reviewDurationHours).toBe(2.0);
        expect(result.timeToMergeHours).toBe(2.0);
        expect(result.totalTimeHours).toBe(6.0);
      });

      it('should use ReadyForReviewEvent when available', () => {
        const prData: GraphQLPullRequestDetail = {
          number: 123,
          title: 'Test PR',
          createdAt: '2024-01-01T10:00:00Z',
          mergedAt: null,
          reviews: {
            nodes: [
              {
                state: 'APPROVED',
                submittedAt: '2024-01-01T14:00:00Z',
              },
            ],
          },
          timelineItems: {
            nodes: [
              {
                __typename: 'ReadyForReviewEvent',
                createdAt: '2024-01-01T12:00:00Z',
              },
            ],
          },
          commits: {
            nodes: [],
          },
        };

        const result = calculateReviewDataForPR(prData, 'owner/repo');
        expect(result.readyForReviewAt).toBe('2024-01-01T12:00:00Z');
        expect(result.timeToFirstReviewHours).toBe(2.0);
      });
    });

    describe('createDefaultReviewData', () => {
      it('should create default data with all null metrics', () => {
        const pr = {
          number: 123,
          title: 'Test PR',
          repository: 'owner/repo',
          createdAt: '2024-01-01T10:00:00Z',
          mergedAt: '2024-01-01T16:00:00Z',
        };

        const result = createDefaultReviewData(pr);
        expect(result.prNumber).toBe(123);
        expect(result.firstReviewAt).toBeNull();
        expect(result.approvedAt).toBeNull();
        expect(result.timeToFirstReviewHours).toBeNull();
        expect(result.reviewDurationHours).toBeNull();
        expect(result.timeToMergeHours).toBeNull();
        expect(result.totalTimeHours).toBeNull();
      });
    });
  });

  describe('Rework Helpers', () => {
    describe('countAdditionalCommits', () => {
      it('should count commits after PR creation', () => {
        const prCreatedAt = '2024-01-01T10:00:00Z';
        const commits: GraphQLCommit[] = [
          {
            commit: {
              committedDate: '2024-01-01T09:00:00Z', // Before PR
            },
          },
          {
            commit: {
              committedDate: '2024-01-01T10:30:00Z', // After PR
            },
          },
          {
            commit: {
              committedDate: '2024-01-01T11:00:00Z', // After PR
            },
          },
        ];

        const result = countAdditionalCommits(commits, prCreatedAt);
        expect(result).toBe(2);
      });

      it('should return 0 when all commits are before PR creation', () => {
        const prCreatedAt = '2024-01-01T10:00:00Z';
        const commits: GraphQLCommit[] = [
          {
            commit: {
              committedDate: '2024-01-01T08:00:00Z',
            },
          },
          {
            commit: {
              committedDate: '2024-01-01T09:00:00Z',
            },
          },
        ];

        const result = countAdditionalCommits(commits, prCreatedAt);
        expect(result).toBe(0);
      });

      it('should return 0 when commits array is empty', () => {
        const prCreatedAt = '2024-01-01T10:00:00Z';
        const commits: GraphQLCommit[] = [];

        const result = countAdditionalCommits(commits, prCreatedAt);
        expect(result).toBe(0);
      });

      it('should handle commits at exact PR creation time (not counted)', () => {
        const prCreatedAt = '2024-01-01T10:00:00Z';
        const commits: GraphQLCommit[] = [
          {
            commit: {
              committedDate: '2024-01-01T10:00:00Z', // Exact time
            },
          },
          {
            commit: {
              committedDate: '2024-01-01T10:00:01Z', // 1 second after
            },
          },
        ];

        const result = countAdditionalCommits(commits, prCreatedAt);
        expect(result).toBe(1); // Only the one after
      });
    });

    describe('countForcePushes', () => {
      it('should count HeadRefForcePushedEvent occurrences', () => {
        const timeline: GraphQLTimelineEvent[] = [
          {
            __typename: 'HeadRefForcePushedEvent',
            createdAt: '2024-01-01T10:00:00Z',
          },
          {
            __typename: 'ReadyForReviewEvent',
            createdAt: '2024-01-01T11:00:00Z',
          },
          {
            __typename: 'HeadRefForcePushedEvent',
            createdAt: '2024-01-01T12:00:00Z',
          },
        ];

        const result = countForcePushes(timeline);
        expect(result).toBe(2);
      });

      it('should return 0 when no force pushes', () => {
        const timeline: GraphQLTimelineEvent[] = [
          {
            __typename: 'ReadyForReviewEvent',
            createdAt: '2024-01-01T11:00:00Z',
          },
        ];

        const result = countForcePushes(timeline);
        expect(result).toBe(0);
      });

      it('should return 0 when timeline is empty', () => {
        const timeline: GraphQLTimelineEvent[] = [];

        const result = countForcePushes(timeline);
        expect(result).toBe(0);
      });

      it('should count multiple consecutive force pushes', () => {
        const timeline: GraphQLTimelineEvent[] = [
          {
            __typename: 'HeadRefForcePushedEvent',
            createdAt: '2024-01-01T10:00:00Z',
          },
          {
            __typename: 'HeadRefForcePushedEvent',
            createdAt: '2024-01-01T10:01:00Z',
          },
          {
            __typename: 'HeadRefForcePushedEvent',
            createdAt: '2024-01-01T10:02:00Z',
          },
        ];

        const result = countForcePushes(timeline);
        expect(result).toBe(3);
      });
    });

    describe('calculateReworkDataForPR', () => {
      it('should calculate complete rework data', () => {
        const prData: GraphQLPullRequestDetail = {
          number: 123,
          title: 'Test PR',
          createdAt: '2024-01-01T10:00:00Z',
          mergedAt: '2024-01-01T16:00:00Z',
          commits: {
            nodes: [
              {
                commit: {
                  committedDate: '2024-01-01T09:00:00Z',
                },
              },
              {
                commit: {
                  committedDate: '2024-01-01T10:30:00Z',
                },
              },
              {
                commit: {
                  committedDate: '2024-01-01T11:00:00Z',
                },
              },
            ],
          },
          timelineItems: {
            nodes: [
              {
                __typename: 'HeadRefForcePushedEvent',
                createdAt: '2024-01-01T12:00:00Z',
              },
            ],
          },
          reviews: {
            nodes: [],
          },
        };

        const result = calculateReworkDataForPR(prData, {
          repository: 'owner/repo',
          createdAt: '2024-01-01T10:00:00Z',
        });

        expect(result.prNumber).toBe(123);
        expect(result.repository).toBe('owner/repo');
        expect(result.totalCommits).toBe(3);
        expect(result.additionalCommits).toBe(2);
        expect(result.forcePushCount).toBe(1);
      });

      it('should handle PR with no commits', () => {
        const prData: GraphQLPullRequestDetail = {
          number: 123,
          title: 'Test PR',
          createdAt: '2024-01-01T10:00:00Z',
          mergedAt: null,
          commits: {
            nodes: [],
          },
          timelineItems: {
            nodes: [],
          },
          reviews: {
            nodes: [],
          },
        };

        const result = calculateReworkDataForPR(prData, {
          repository: 'owner/repo',
          createdAt: '2024-01-01T10:00:00Z',
        });

        expect(result.totalCommits).toBe(0);
        expect(result.additionalCommits).toBe(0);
        expect(result.forcePushCount).toBe(0);
      });
    });

    describe('createDefaultReworkData', () => {
      it('should create default data with zero counts', () => {
        const pr = {
          number: 123,
          title: 'Test PR',
          repository: 'owner/repo',
          createdAt: '2024-01-01T10:00:00Z',
          mergedAt: '2024-01-01T16:00:00Z',
        };

        const result = createDefaultReworkData(pr);
        expect(result.prNumber).toBe(123);
        expect(result.additionalCommits).toBe(0);
        expect(result.forcePushCount).toBe(0);
        expect(result.totalCommits).toBe(0);
      });
    });
  });

  describe('PR Size Helpers', () => {
    describe('calculatePRSizeData', () => {
      it('should calculate total lines of code', () => {
        const prData = {
          number: 123,
          title: 'Test PR',
          createdAt: '2024-01-01T10:00:00Z',
          mergedAt: '2024-01-01T16:00:00Z',
          additions: 100,
          deletions: 50,
          changedFiles: 5,
        };

        const result = calculatePRSizeData(prData, 'owner/repo');
        expect(result.linesOfCode).toBe(150);
        expect(result.additions).toBe(100);
        expect(result.deletions).toBe(50);
        expect(result.filesChanged).toBe(5);
      });

      it('should handle zero changes', () => {
        const prData = {
          number: 123,
          title: 'Test PR',
          createdAt: '2024-01-01T10:00:00Z',
          mergedAt: null,
          additions: 0,
          deletions: 0,
          changedFiles: 0,
        };

        const result = calculatePRSizeData(prData, 'owner/repo');
        expect(result.linesOfCode).toBe(0);
        expect(result.additions).toBe(0);
        expect(result.deletions).toBe(0);
        expect(result.filesChanged).toBe(0);
      });

      it('should handle very large PRs (>10000 lines)', () => {
        const prData = {
          number: 123,
          title: 'Large refactoring',
          createdAt: '2024-01-01T10:00:00Z',
          mergedAt: '2024-01-01T16:00:00Z',
          additions: 8000,
          deletions: 5000,
          changedFiles: 100,
        };

        const result = calculatePRSizeData(prData, 'owner/repo');
        expect(result.linesOfCode).toBe(13000);
        expect(result.filesChanged).toBe(100);
      });

      it('should handle deletion-only PR', () => {
        const prData = {
          number: 123,
          title: 'Remove deprecated code',
          createdAt: '2024-01-01T10:00:00Z',
          mergedAt: '2024-01-01T16:00:00Z',
          additions: 0,
          deletions: 500,
          changedFiles: 10,
        };

        const result = calculatePRSizeData(prData, 'owner/repo');
        expect(result.linesOfCode).toBe(500);
        expect(result.additions).toBe(0);
        expect(result.deletions).toBe(500);
      });
    });
  });
});
