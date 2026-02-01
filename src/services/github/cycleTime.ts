/**
 * Cycle Time & Coding Time 計測モジュール（REST API版）
 *
 * @deprecated このファイルの関数はREST APIを使用しており、非推奨です。
 * GraphQL版（src/services/github/graphql/issues.ts）の使用を推奨します。
 * GraphQL版はAPI呼び出し回数が大幅に少なく、レート制限対策として有効です。
 *
 * Issue作成からProductionマージまでのサイクルタイム、
 * Issue作成からPR作成までのコーディングタイムを計測。
 *
 * 削除予定: Version 1.2.0
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
import { processIssueCycleTime } from './cycleTimeHelpers.js';
import { processIssueCodingTime } from './codingTimeHelpers.js';
import { trackToProductionMerge as trackToProductionMergeShared } from './shared/prTracking.js';
import { createRESTFetcher } from './trackHelpers.js';

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
 *
 * @deprecated REST API版は非推奨です。GraphQL版の getCycleTimeDataGraphQL() 内で自動的に処理されます。
 * 削除予定: Version 1.2.0
 */
export function trackToProductionMerge(options: TrackToProductionOptions): ApiResponse<{
  productionMergedAt: string | null;
  prChain: PRChainItem[];
}> {
  const { owner, repo, initialPRNumber, token, productionPattern = 'production' } = options;
  const { logger } = getContainer();

  // 共通のPR追跡ロジックを使用（REST API版のfetcherを提供）
  const fetcher = createRESTFetcher(owner, repo, token);
  return trackToProductionMergeShared(fetcher, initialPRNumber, productionPattern, logger);
}

// =============================================================================
// サイクルタイムデータ取得
// =============================================================================

/**
 * 複数リポジトリからサイクルタイムデータを取得
 *
 * サイクルタイム = Issue作成 → Productionマージ
 *
 * @deprecated REST API版は非推奨です。GraphQL版の getCycleTimeDataGraphQL() を使用してください。
 * GraphQL版はAPI呼び出し回数が大幅に削減されています。
 * 削除予定: Version 1.2.0
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

      const cycleTimeData = processIssueCycleTime({
        issue,
        linkedPRNumbers: linkedPRs,
        owner: repo.owner,
        repoName: repo.name,
        repository: repo.fullName,
        token,
        productionPattern,
        logger,
        trackFn: trackToProductionMerge,
      });

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
 *
 * @deprecated REST API版は非推奨です。GraphQL版の getCodingTimeDataGraphQL() を使用してください。
 * GraphQL版はAPI呼び出し回数が大幅に削減されています。
 * 削除予定: Version 1.2.0
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

      const codingTimeData = processIssueCodingTime({
        issue,
        linkedPRNumbers: linkedPRs,
        owner: repo.owner,
        repoName: repo.name,
        repository: repo.fullName,
        token,
        logger,
      });

      allCodingTimeData.push(codingTimeData);
    }
  }

  logger.log(`✅ Total: ${allCodingTimeData.length} issues processed for coding time`);
  return { success: true, data: allCodingTimeData };
}
