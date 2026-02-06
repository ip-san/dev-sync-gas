/**
 * GitHub GraphQL API - PR追跡
 *
 * PRチェーンの追跡とproductionブランチマージ検出
 */

import type { ApiResponse, PRChainItem } from '../../../../types';
import { getContainer } from '../../../../container';
import { executeGraphQLWithRetry } from '../client';
import { COMMIT_ASSOCIATED_PRS_QUERY } from '../queries';
import type { CommitAssociatedPRsQueryResponse } from '../types';
import {
  trackToProductionMerge as trackToProductionMergeShared,
  type PRFetcher,
  type MinimalPRInfo,
} from '../../shared/prTracking.js';
import { getPullRequestWithBranchesGraphQL } from '../pullRequests/index';

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

      // 同じPRの場合は無限ループを防止
      if (result.data.number === currentPRNumber) {
        return { success: true, data: null };
      }

      return { success: true, data: result.data.number };
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
