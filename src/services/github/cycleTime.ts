/**
 * Cycle Time & Coding Time 計測モジュール
 *
 * Issue作成からProductionマージまでのサイクルタイム、
 * Issue作成からPR作成までのコーディングタイムを計測。
 */

import type {
  GitHubRepository,
  ApiResponse,
  PRChainItem,
  IssueCycleTime,
  IssueCodingTime,
} from '../../types';
import { getContainer } from '../../container';
import { type IssueDateRange } from './api';
import { getIssues, getLinkedPRsForIssue } from './issues';
import { MAX_PR_CHAIN_DEPTH } from '../../config/apiConfig';
import { processIssueCycleTime } from './cycleTimeHelpers.js';
import { processIssueCodingTime } from './codingTimeHelpers.js';
import { processTrackStep } from './trackHelpers.js';

// =============================================================================
// PRチェーン追跡
// =============================================================================

/**
 * trackToProductionMerge のオプション
 */
export interface TrackToProductionOptions {
  owner: string;
  repo: string;
  initialPRNumber: number;
  token: string;
  productionPattern?: string;
}

/**
 * PRチェーンを追跡してproductionブランチへのマージを検出
 *
 * feature → main → staging → production のようなPRの連鎖を追跡
 */
export function trackToProductionMerge(options: TrackToProductionOptions): ApiResponse<{
  productionMergedAt: string | null;
  prChain: PRChainItem[];
}> {
  const { owner, repo, initialPRNumber, token, productionPattern = 'production' } = options;
  const { logger } = getContainer();
  const prChain: PRChainItem[] = [];
  let currentPRNumber = initialPRNumber;
  let productionMergedAt: string | null = null;

  for (let depth = 0; depth < MAX_PR_CHAIN_DEPTH; depth++) {
    const result = processTrackStep(
      owner,
      repo,
      currentPRNumber,
      token,
      productionPattern,
      prChain,
      logger
    );

    if (result.productionMergedAt) {
      productionMergedAt = result.productionMergedAt;
    }

    if (!result.shouldContinue) {
      break;
    }

    currentPRNumber = result.nextPRNumber!;
  }

  return { success: true, data: { productionMergedAt, prChain } };
}

// =============================================================================
// サイクルタイムデータ取得
// =============================================================================

/**
 * 複数リポジトリからサイクルタイムデータを取得
 *
 * サイクルタイム = Issue作成 → Productionマージ
 */
export function getCycleTimeData(
  repositories: GitHubRepository[],
  token: string,
  options: {
    dateRange?: IssueDateRange;
    productionBranchPattern?: string;
    labels?: string[];
  } = {}
): ApiResponse<IssueCycleTime[]> {
  const { logger } = getContainer();
  const productionPattern = options.productionBranchPattern ?? 'production';
  const allCycleTimeData: IssueCycleTime[] = [];

  for (const repo of repositories) {
    logger.log(`🔍 Processing ${repo.fullName}...`);

    // Issueを取得
    const issuesResult = getIssues(repo, token, {
      dateRange: options.dateRange,
      labels: options.labels,
    });

    if (!issuesResult.success || !issuesResult.data) {
      logger.log(`  ⚠️ Failed to fetch issues: ${issuesResult.error}`);
      continue;
    }

    const issues = issuesResult.data;
    logger.log(`  📋 Found ${issues.length} issues to process`);

    // 各Issueを処理
    for (const issue of issues) {
      const linkedPRsResult = getLinkedPRsForIssue(repo.owner, repo.name, issue.number, token);
      const linkedPRs = linkedPRsResult.success && linkedPRsResult.data ? linkedPRsResult.data : [];

      const cycleTimeData = processIssueCycleTime(
        issue,
        linkedPRs,
        repo.owner,
        repo.name,
        repo.fullName,
        token,
        productionPattern,
        logger,
        trackToProductionMerge
      );

      allCycleTimeData.push(cycleTimeData);
    }
  }

  logger.log(`✅ Total: ${allCycleTimeData.length} issues processed`);
  return { success: true, data: allCycleTimeData };
}

// =============================================================================
// コーディングタイムデータ取得
// =============================================================================

/**
 * 複数リポジトリからコーディングタイムデータを取得
 *
 * コーディングタイム = Issue作成 → PR作成
 */
export function getCodingTimeData(
  repositories: GitHubRepository[],
  token: string,
  options: {
    dateRange?: IssueDateRange;
    labels?: string[];
  } = {}
): ApiResponse<IssueCodingTime[]> {
  const { logger } = getContainer();
  const allCodingTimeData: IssueCodingTime[] = [];

  for (const repo of repositories) {
    logger.log(`🔍 Processing ${repo.fullName} for coding time...`);

    // Issueを取得
    const issuesResult = getIssues(repo, token, {
      dateRange: options.dateRange,
      labels: options.labels,
    });

    if (!issuesResult.success || !issuesResult.data) {
      logger.log(`  ⚠️ Failed to fetch issues: ${issuesResult.error}`);
      continue;
    }

    const issues = issuesResult.data;
    logger.log(`  📋 Found ${issues.length} issues to process`);

    // 各Issueを処理
    for (const issue of issues) {
      const linkedPRsResult = getLinkedPRsForIssue(repo.owner, repo.name, issue.number, token);
      const linkedPRs = linkedPRsResult.success && linkedPRsResult.data ? linkedPRsResult.data : [];

      const codingTimeData = processIssueCodingTime(
        issue,
        linkedPRs,
        repo.owner,
        repo.name,
        repo.fullName,
        token,
        logger
      );

      allCodingTimeData.push(codingTimeData);
    }
  }

  logger.log(`✅ Total: ${allCodingTimeData.length} issues processed for coding time`);
  return { success: true, data: allCodingTimeData };
}
