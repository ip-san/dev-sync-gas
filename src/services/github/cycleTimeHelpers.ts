/**
 * サイクルタイム計算のヘルパー関数
 *
 * getCycleTimeData の複雑度削減のため分離
 */

import type { IssueCycleTime, PRChainItem, ApiResponse } from '../../types/index.js';
import type { LoggerClient } from '../../interfaces/index.js';
import { MS_TO_HOURS } from '../../utils/timeConstants.js';

/**
 * PRChainがない場合のデフォルトサイクルタイムデータを生成
 */
export function createDefaultCycleTimeData(
  issue: { number: number; title: string; createdAt: string },
  repository: string
): IssueCycleTime {
  return {
    issueNumber: issue.number,
    issueTitle: issue.title,
    repository,
    issueCreatedAt: issue.createdAt,
    productionMergedAt: null,
    cycleTimeHours: null,
    prChain: [],
  };
}

/**
 * サイクルタイムを計算（時間単位、小数第1位まで）
 */
export function calculateCycleTimeHours(
  issueCreatedAt: string,
  productionMergedAt: string | null
): number | null {
  if (!productionMergedAt) {
    return null;
  }

  const startTime = new Date(issueCreatedAt).getTime();
  const endTime = new Date(productionMergedAt).getTime();
  return Math.round(((endTime - startTime) / MS_TO_HOURS) * 10) / 10;
}

/**
 * 複数のPR追跡結果から最適なものを選択
 * 最も早くproductionにマージされたものを優先
 */
export function selectBestTrackResult(
  results: Array<{
    productionMergedAt: string | null;
    prChain: PRChainItem[];
  } | null>
): { productionMergedAt: string | null; prChain: PRChainItem[] } {
  let bestResult: { productionMergedAt: string | null; prChain: PRChainItem[] } | null = null;

  for (const result of results) {
    if (!result) {
      continue;
    }

    // productionにマージされたものを優先
    if (result.productionMergedAt) {
      const shouldUpdate =
        !bestResult?.productionMergedAt ||
        new Date(result.productionMergedAt) < new Date(bestResult.productionMergedAt);

      if (shouldUpdate) {
        bestResult = result;
      }
    } else if (!bestResult) {
      // productionマージがない場合は最初の結果を使用
      bestResult = result;
    }
  }

  return bestResult ?? { productionMergedAt: null, prChain: [] };
}

/**
 * 完全なサイクルタイムデータを構築
 */
export function buildCycleTimeData(
  issue: { number: number; title: string; createdAt: string },
  repository: string,
  productionMergedAt: string | null,
  prChain: PRChainItem[]
): IssueCycleTime {
  const cycleTimeHours = calculateCycleTimeHours(issue.createdAt, productionMergedAt);

  return {
    issueNumber: issue.number,
    issueTitle: issue.title,
    repository,
    issueCreatedAt: issue.createdAt,
    productionMergedAt,
    cycleTimeHours,
    prChain,
  };
}

/**
 * processIssueCycleTime のオプション
 */
export interface ProcessIssueCycleTimeOptions {
  issue: { number: number; title: string; createdAt: string };
  linkedPRNumbers: number[];
  owner: string;
  repoName: string;
  repository: string;
  token: string;
  productionPattern: string;
  logger: LoggerClient;
  trackFn: (options: {
    owner: string;
    repo: string;
    initialPRNumber: number;
    token: string;
    productionPattern: string;
  }) => ApiResponse<{
    productionMergedAt: string | null;
    prChain: PRChainItem[];
  }>;
}

/**
 * Issue1件分のサイクルタイムデータを処理
 */
export function processIssueCycleTime(options: ProcessIssueCycleTimeOptions): IssueCycleTime {
  const {
    issue,
    linkedPRNumbers,
    owner,
    repoName,
    repository,
    token,
    productionPattern,
    logger,
    trackFn,
  } = options;
  logger.log(`  📌 Processing Issue #${issue.number}: ${issue.title}`);

  if (linkedPRNumbers.length === 0) {
    logger.log(`    ⏭️ No linked PRs found`);
    return createDefaultCycleTimeData(issue, repository);
  }

  logger.log(`    🔗 Found ${linkedPRNumbers.length} linked PRs: ${linkedPRNumbers.join(', ')}`);

  // 各リンクPRからproductionマージを追跡
  const trackResults = linkedPRNumbers.map((prNumber) => {
    const trackResult = trackFn({
      owner,
      repo: repoName,
      initialPRNumber: prNumber,
      token,
      productionPattern,
    });
    return trackResult.success && trackResult.data ? trackResult.data : null;
  });

  const { productionMergedAt, prChain } = selectBestTrackResult(trackResults);

  return buildCycleTimeData(issue, repository, productionMergedAt, prChain);
}
