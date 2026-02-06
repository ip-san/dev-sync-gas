/**
 * Pull Request rework data batch operations
 */

import type { GitHubPullRequest, PRReworkData } from '../../../../types';
import { getContainer } from '../../../../container';
import { executeGraphQLWithRetry } from '../client';
import { buildBatchPRDetailQuery } from '../queries';
import type { GraphQLPullRequestDetail } from '../types';
import { DEFAULT_BATCH_SIZE } from '../../../../config/apiConfig';
import { calculateReworkDataForPR, createDefaultReworkData } from '../reworkHelpers';
import { groupPRsByRepository, parseRepository } from '../batchProcessing';
import type { ProcessBatchReworkDataParams } from './types';

/**
 * 1バッチ分のPR手戻りデータを処理
 */
function processBatchReworkData(params: ProcessBatchReworkDataParams): PRReworkData[] {
  const { batch, owner, repo, token, logger } = params;
  const reworkData: PRReworkData[] = [];
  const prNumbers = batch.map((pr) => pr.number);

  const query = buildBatchPRDetailQuery(prNumbers);
  const result = executeGraphQLWithRetry<{
    repository: Record<string, GraphQLPullRequestDetail | null>;
  }>(query, { owner, name: repo }, token);

  if (!result.success || !result.data?.repository) {
    logger.warn(`  ⚠️ Failed to fetch batch PR details: ${result.error}`);
    // フォールバック: 空データを追加
    return batch.map((pr) => createDefaultReworkData(pr));
  }

  // 各PRのデータを処理
  for (let j = 0; j < batch.length; j++) {
    const pr = batch[j];
    const prData = result.data.repository[`pr${j}`];

    if (!prData) {
      reworkData.push(createDefaultReworkData(pr));
      continue;
    }

    reworkData.push(calculateReworkDataForPR(prData, pr));
  }

  return reworkData;
}

/**
 * 複数PRの手戻りデータを一括取得（GraphQL版）
 *
 * REST APIでは PR数 × 3 リクエスト必要だったものを
 * ceil(PR数 / 10) リクエストに削減。
 */
export function getReworkDataForPRsGraphQL(
  pullRequests: GitHubPullRequest[],
  token: string
): PRReworkData[] {
  const { logger } = getContainer();
  const reworkData: PRReworkData[] = [];

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
      const batchResults = processBatchReworkData({ batch, owner, repo, token, logger });
      reworkData.push(...batchResults);
    }
  }

  return reworkData;
}
