/**
 * Pull Request review efficiency data batch operations
 */

import type { GitHubPullRequest, PRReviewData } from '../../../../types';
import { getContainer } from '../../../../container';
import { executeGraphQLWithRetry } from '../client';
import { buildBatchPRDetailQuery } from '../queries/pullRequests.js';
import type { GraphQLPullRequestDetail } from '../types';
import { DEFAULT_BATCH_SIZE } from '../../../../config/apiConfig';
import { calculateReviewDataForPR, createDefaultReviewData } from '../reviewEfficiencyHelpers';
import { groupPRsByRepository, parseRepository } from '../batchProcessing';
import type { ProcessBatchReviewDataParams } from './types';

/**
 * 1バッチ分のPRレビュー効率データを処理
 */
function processBatchReviewData(params: ProcessBatchReviewDataParams): PRReviewData[] {
  const { batch, owner, repo, repoFullName, token, logger } = params;
  const reviewData: PRReviewData[] = [];
  const prNumbers = batch.map((pr) => pr.number);

  const query = buildBatchPRDetailQuery(prNumbers);
  const result = executeGraphQLWithRetry<{
    repository: Record<string, GraphQLPullRequestDetail | null>;
  }>(query, { owner, name: repo }, token);

  if (!result.success || !result.data?.repository) {
    logger.warn(`  ⚠️ Failed to fetch batch PR reviews: ${result.error}`);
    return [];
  }

  for (let j = 0; j < batch.length; j++) {
    const pr = batch[j];
    const prData = result.data.repository[`pr${j}`];

    if (!prData) {
      reviewData.push(createDefaultReviewData(pr));
      continue;
    }

    reviewData.push(calculateReviewDataForPR(prData, repoFullName));
  }

  return reviewData;
}

/**
 * 複数PRのレビュー効率データを一括取得（GraphQL版）
 *
 * REST APIでは PR数 × 3 リクエスト必要だったものを
 * ceil(PR数 / 10) リクエストに削減。
 */
export function getReviewEfficiencyDataForPRsGraphQL(
  pullRequests: GitHubPullRequest[],
  token: string
): PRReviewData[] {
  const { logger } = getContainer();
  const reviewData: PRReviewData[] = [];

  // リポジトリごとにグループ化
  const prsByRepo = groupPRsByRepository(pullRequests);

  for (const [repoFullName, prs] of prsByRepo) {
    const parsed = parseRepository(repoFullName);
    if (!parsed) {
      continue;
    }
    const { owner, repo } = parsed;

    // バッチ処理（設定可能なバッチサイズ）
    for (let i = 0; i < prs.length; i += DEFAULT_BATCH_SIZE) {
      const batch = prs.slice(i, i + DEFAULT_BATCH_SIZE);
      const batchResults = processBatchReviewData({
        batch,
        owner,
        repo,
        repoFullName,
        token,
        logger,
      });
      reviewData.push(...batchResults);
    }
  }

  return reviewData;
}
