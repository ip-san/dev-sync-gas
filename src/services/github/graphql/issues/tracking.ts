/**
 * GitHub GraphQL API - PR追跡
 *
 * PRチェーンの追跡とproductionブランチマージ検出
 */

import { getContainer } from '../../../../container';
import type { ApiResponse, PRChainItem } from '../../../../types';
import {
  type MinimalPRInfo,
  type PRFetcher,
  trackToProductionMerge as trackToProductionMergeShared,
} from '../../shared/prTracking.js';
import { executeGraphQLWithRetry } from '../client';
import { getPullRequestWithBranchesGraphQL } from '../pullRequests/index';
import { COMMIT_ASSOCIATED_PRS_QUERY } from '../queries/commits.js';
import { MERGED_PRS_BY_HEAD_BRANCH_QUERY } from '../queries/pullRequests.js';
import type {
  CommitAssociatedPRsQueryResponse,
  MergedPRsByHeadBranchQueryResponse,
} from '../types';

/**
 * コミットSHAからPRを検索（GraphQL版）
 */
export function findPRContainingCommitGraphQL(
  owner: string,
  repo: string,
  commitSha: string,
  token: string
): ApiResponse<{
  number: number;
  baseRefName: string;
  headRefName: string;
  mergedAt: string | null;
  mergeCommitSha: string | null;
} | null> {
  const result = executeGraphQLWithRetry<CommitAssociatedPRsQueryResponse>(
    COMMIT_ASSOCIATED_PRS_QUERY,
    {
      owner,
      name: repo,
      oid: commitSha,
    },
    token
  );

  if (!result.success) {
    if (result.error?.includes('Could not resolve')) {
      // コミットが見つからない場合
      return { success: true, data: null };
    }
    return { success: false, error: result.error };
  }

  const prs = result.data?.repository?.object?.associatedPullRequests?.nodes;
  if (!prs || prs.length === 0) {
    return { success: true, data: null };
  }

  // マージ済みのPRを優先
  const mergedPR = prs.find((pr) => pr.mergedAt !== null);
  const targetPR = mergedPR ?? prs[0];

  return {
    success: true,
    data: {
      number: targetPR.number,
      baseRefName: targetPR.baseRefName,
      headRefName: targetPR.headRefName,
      mergedAt: targetPR.mergedAt,
      mergeCommitSha: targetPR.mergeCommit?.oid ?? null,
    },
  };
}

/**
 * ブランチ名でマージ済みPRを検索（GraphQL版）
 *
 * 指定ブランチからマージされたPRのうち、指定日時以降にマージされた
 * 最も早いPRを返す。PRチェーン追跡のフォールバック用。
 */
function findMergedPRsByHeadBranchGraphQL(
  owner: string,
  repo: string,
  headBranch: string,
  token: string
): ApiResponse<MergedPRsByHeadBranchQueryResponse> {
  return executeGraphQLWithRetry<MergedPRsByHeadBranchQueryResponse>(
    MERGED_PRS_BY_HEAD_BRANCH_QUERY,
    { owner, name: repo, headRefName: headBranch },
    token
  );
}

/**
 * ブランチ名で次のPRを検索し、MinimalPRInfoとして返す
 *
 * mergedAfter 以降にマージされたPRのうち最も早いものを選択。
 */
function findNextPRByBranchAdapter(
  repoCtx: { owner: string; repo: string; token: string },
  headBranch: string,
  mergedAfter: string
): ApiResponse<MinimalPRInfo | null> {
  const result = findMergedPRsByHeadBranchGraphQL(
    repoCtx.owner,
    repoCtx.repo,
    headBranch,
    repoCtx.token
  );

  if (!result.success || !result.data?.repository) {
    return { success: true, data: null };
  }

  const prs = result.data.repository.pullRequests.nodes;
  const mergedAfterTime = new Date(mergedAfter).getTime();
  const candidates = prs
    .filter((pr) => pr.mergedAt && new Date(pr.mergedAt).getTime() >= mergedAfterTime)
    .sort((a, b) => new Date(a.mergedAt ?? 0).getTime() - new Date(b.mergedAt ?? 0).getTime());

  if (candidates.length === 0) {
    return { success: true, data: null };
  }

  const best = candidates[0];
  return {
    success: true,
    data: {
      number: best.number,
      baseBranch: best.baseRefName,
      headBranch: best.headRefName,
      mergedAt: best.mergedAt,
      mergeCommitSha: best.mergeCommit?.oid ?? null,
    },
  };
}

/**
 * GraphQL API版PRFetcherの作成
 *
 * 共通のPR追跡ロジックで使用するためのアダプター
 */
function createGraphQLFetcher(owner: string, repo: string, token: string): PRFetcher {
  return {
    getPR(prNumber: number): ApiResponse<MinimalPRInfo | null> {
      const result = getPullRequestWithBranchesGraphQL(owner, repo, prNumber, token);

      if (!result.success || !result.data) {
        return { success: false, error: result.error };
      }

      const pr = result.data;
      return {
        success: true,
        data: {
          number: pr.number,
          baseBranch: pr.baseBranch ?? null,
          headBranch: pr.headBranch ?? null,
          mergedAt: pr.mergedAt,
          mergeCommitSha: pr.mergeCommitSha ?? null,
        },
      };
    },

    findPRByCommit(commitSha: string, currentPRNumber: number): ApiResponse<number | null> {
      const result = findPRContainingCommitGraphQL(owner, repo, commitSha, token);

      if (!result.success || !result.data) {
        return { success: true, data: null };
      }

      if (result.data.number === currentPRNumber) {
        return { success: true, data: null };
      }

      return { success: true, data: result.data.number };
    },

    findNextPRByBranch(headBranch: string, mergedAfter: string): ApiResponse<MinimalPRInfo | null> {
      return findNextPRByBranchAdapter({ owner, repo, token }, headBranch, mergedAfter);
    },
  };
}

/**
 * trackToProductionMergeGraphQL のオプション
 */
export interface TrackToProductionGraphQLOptions {
  owner: string;
  repo: string;
  initialPRNumber: number;
  token: string;
  productionPattern?: string;
}

/**
 * PRチェーンを追跡してproductionブランチへのマージを検出（GraphQL版）
 */
export function trackToProductionMergeGraphQL(
  options: TrackToProductionGraphQLOptions
): ApiResponse<{
  productionMergedAt: string | null;
  prChain: PRChainItem[];
}> {
  const { owner, repo, initialPRNumber, token, productionPattern = 'production' } = options;
  const { logger } = getContainer();

  // 共通のPR追跡ロジックを使用（GraphQL API版のfetcherを提供）
  const fetcher = createGraphQLFetcher(owner, repo, token);
  return trackToProductionMergeShared(fetcher, initialPRNumber, productionPattern, logger);
}
