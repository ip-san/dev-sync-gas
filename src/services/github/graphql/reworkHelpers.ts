/**
 * 手戻りデータ計算のヘルパー関数
 *
 * getReworkDataForPRsGraphQL の複雑度削減のため分離
 */

import type { PRReworkData } from '../../../types/index.js';
import type { GraphQLPullRequestDetail, GraphQLCommit, GraphQLTimelineEvent } from './types.js';

/**
 * PR作成後の追加コミット数を計算
 */
export function countAdditionalCommits(commits: GraphQLCommit[], prCreatedAt: string): number {
  const createdTime = new Date(prCreatedAt);
  let count = 0;

  for (const commitNode of commits) {
    const commitDate = new Date(commitNode.commit.committedDate);
    if (commitDate > createdTime) {
      count++;
    }
  }

  return count;
}

/**
 * Force Push回数を計算
 */
export function countForcePushes(timeline: GraphQLTimelineEvent[]): number {
  return timeline.filter((event) => event.__typename === 'HeadRefForcePushedEvent').length;
}

/**
 * PR1件分の手戻りデータを計算
 */
export function calculateReworkDataForPR(
  prData: GraphQLPullRequestDetail,
  originalPR: { repository: string; createdAt: string }
): PRReworkData {
  const commits = prData.commits?.nodes ?? [];
  const timeline = prData.timelineItems?.nodes ?? [];

  const additionalCommits = countAdditionalCommits(commits, originalPR.createdAt);
  const forcePushCount = countForcePushes(timeline);

  return {
    prNumber: prData.number,
    title: prData.title,
    repository: originalPR.repository,
    createdAt: prData.createdAt,
    mergedAt: prData.mergedAt,
    additionalCommits,
    forcePushCount,
    totalCommits: commits.length,
  };
}

/**
 * 手戻りデータがない場合のデフォルト値を生成
 */
export function createDefaultReworkData(pr: {
  number: number;
  title: string;
  repository: string;
  createdAt: string;
  mergedAt: string | null;
}): PRReworkData {
  return {
    prNumber: pr.number,
    title: pr.title,
    repository: pr.repository,
    createdAt: pr.createdAt,
    mergedAt: pr.mergedAt,
    additionalCommits: 0,
    forcePushCount: 0,
    totalCommits: 0,
  };
}
