/**
 * PR追跡のヘルパー関数（REST API版）
 *
 * 共通のPR追跡ロジックにREST API実装を提供するアダプター
 */

import type { ApiResponse } from '../../types/index.js';
import type { PRFetcher, MinimalPRInfo } from './shared/prTracking.js';
import { getPullRequestWithBranches, findPRContainingCommit } from './pullRequests.js';

/**
 * REST API版PRFetcherの作成
 *
 * 共通のPR追跡ロジックで使用するためのアダプター
 */
export function createRESTFetcher(owner: string, repo: string, token: string): PRFetcher {
  return {
    getPR(prNumber: number): ApiResponse<MinimalPRInfo | null> {
      const result = getPullRequestWithBranches(owner, repo, prNumber, token);

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
      const result = findPRContainingCommit(owner, repo, commitSha, token);

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

// ============================================================================
// 後方互換性のための旧関数（@deprecated）
// ============================================================================

/**
 * PR追跡の1ステップ処理結果
 *
 * @deprecated 共通のprTracking.tsに移行しました。直接使用せず、trackToProductionMergeを使用してください。
 */
export interface TrackStepResult {
  shouldContinue: boolean;
  productionMergedAt: string | null;
  nextPRNumber: number | null;
}

/**
 * processTrackStep のオプション
 *
 * @deprecated 共通のprTracking.tsに移行しました。
 */
export interface ProcessTrackStepOptions {
  owner: string;
  repo: string;
  currentPRNumber: number;
  token: string;
  productionPattern: string;
  prChain: Array<{
    prNumber: number;
    baseBranch: string;
    headBranch: string;
    mergedAt: string | null;
  }>;
  logger: {
    log(message: string): void;
  };
}

/**
 * PR追跡の1ステップを実行
 *
 * @deprecated この関数は後方互換性のために残されています。
 * 新しいコードでは shared/prTracking.ts の trackToProductionMerge を使用してください。
 */
export function processTrackStep(options: ProcessTrackStepOptions): TrackStepResult {
  // 後方互換性のため、共通ロジックを使用せず従来の実装を維持
  const { owner, repo, currentPRNumber, token, prChain, logger } = options;
  const fetcher = createRESTFetcher(owner, repo, token);

  const prResult = fetcher.getPR(currentPRNumber);
  if (!prResult.success || !prResult.data) {
    logger.log(`    ⚠️ Failed to fetch PR #${currentPRNumber}`);
    return { shouldContinue: false, productionMergedAt: null, nextPRNumber: null };
  }

  const pr = prResult.data;
  prChain.push({
    prNumber: pr.number,
    baseBranch: pr.baseBranch ?? 'unknown',
    headBranch: pr.headBranch ?? 'unknown',
    mergedAt: pr.mergedAt,
  });

  // productionブランチへのマージを検出
  if (
    pr.baseBranch &&
    pr.baseBranch.toLowerCase().includes(options.productionPattern.toLowerCase())
  ) {
    if (pr.mergedAt) {
      logger.log(
        `    ✅ Found production merge: PR #${pr.number} → ${pr.baseBranch} at ${pr.mergedAt}`
      );
      return { shouldContinue: false, productionMergedAt: pr.mergedAt, nextPRNumber: null };
    }
  }

  // マージされていない場合は追跡終了
  if (!pr.mergedAt || !pr.mergeCommitSha) {
    return { shouldContinue: false, productionMergedAt: null, nextPRNumber: null };
  }

  // 次のPRを検索
  const nextPRResult = fetcher.findPRByCommit(pr.mergeCommitSha, currentPRNumber);
  if (!nextPRResult.success || !nextPRResult.data) {
    return { shouldContinue: false, productionMergedAt: null, nextPRNumber: null };
  }

  return { shouldContinue: true, productionMergedAt: null, nextPRNumber: nextPRResult.data };
}
