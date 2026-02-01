/**
 * PR追跡のヘルパー関数
 *
 * trackToProductionMerge の複雑度削減のため分離
 */

import type { PRChainItem } from '../../types/index.js';
import type { LoggerClient } from '../../interfaces/index.js';
import { getPullRequestWithBranches, findPRContainingCommit } from './pullRequests.js';

/**
 * PR追跡の1ステップ処理結果
 */
export interface TrackStepResult {
  shouldContinue: boolean;
  productionMergedAt: string | null;
  nextPRNumber: number | null;
}

/**
 * productionブランチへのマージを検出
 */
function checkProductionMerge(
  pr: { baseBranch?: string | null | undefined; mergedAt: string | null; number: number },
  productionPattern: string,
  logger: LoggerClient
): string | null {
  if (pr.baseBranch && pr.baseBranch.toLowerCase().includes(productionPattern.toLowerCase())) {
    if (pr.mergedAt) {
      logger.log(
        `    ✅ Found production merge: PR #${pr.number} → ${pr.baseBranch} at ${pr.mergedAt}`
      );
      return pr.mergedAt;
    }
  }
  return null;
}

/**
 * 次のPRを検索
 */
function findNextPR(
  owner: string,
  repo: string,
  mergeCommitSha: string,
  currentPRNumber: number,
  token: string
): number | null {
  const nextPRResult = findPRContainingCommit(owner, repo, mergeCommitSha, token);

  if (!nextPRResult.success || !nextPRResult.data) {
    return null;
  }

  // 同じPRの場合は無限ループを防止
  if (nextPRResult.data.number === currentPRNumber) {
    return null;
  }

  return nextPRResult.data.number;
}

/**
 * PR追跡の1ステップを実行
 */
export function processTrackStep(
  owner: string,
  repo: string,
  currentPRNumber: number,
  token: string,
  productionPattern: string,
  prChain: PRChainItem[],
  logger: LoggerClient
): TrackStepResult {
  const prResult = getPullRequestWithBranches(owner, repo, currentPRNumber, token);

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
  const productionMergedAt = checkProductionMerge(pr, productionPattern, logger);
  if (productionMergedAt) {
    return { shouldContinue: false, productionMergedAt, nextPRNumber: null };
  }

  // マージされていない場合は追跡終了
  if (!pr.mergedAt || !pr.mergeCommitSha) {
    return { shouldContinue: false, productionMergedAt: null, nextPRNumber: null };
  }

  // 次のPRを検索
  const nextPRNumber = findNextPR(owner, repo, pr.mergeCommitSha, currentPRNumber, token);
  if (!nextPRNumber) {
    return { shouldContinue: false, productionMergedAt: null, nextPRNumber: null };
  }

  return { shouldContinue: true, productionMergedAt: null, nextPRNumber };
}
