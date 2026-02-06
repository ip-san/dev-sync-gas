/**
 * Pull Request size data batch operations
 */

import type { GitHubPullRequest, PRSizeData } from '../../../../types';
import { getContainer } from '../../../../container';
import { executeGraphQLWithRetry } from '../client';
import { DEFAULT_BATCH_SIZE } from '../../../../config/apiConfig';
import { calculatePRSizeData } from '../prSizeHelpers';
import { groupPRsByRepository, parseRepository } from '../batchProcessing';
import type { ProcessBatchSizeDataParams } from './types';

/**
 * バッチPRサイズ取得用のGraphQLクエリを構築
 */
function buildBatchPRSizeQuery(prNumbers: number[]): string {
  return `
    query GetBatchPRSize($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        ${prNumbers
          .map(
            (num, idx) => `
          pr${idx}: pullRequest(number: ${num}) {
            number
            title
            createdAt
            mergedAt
            additions
            deletions
            changedFiles
          }
        `
          )
          .join('\n')}
      }
    }
  `;
}

/**
 * 1バッチ分のPRサイズデータを処理
 */
function processBatchSizeData(params: ProcessBatchSizeDataParams): PRSizeData[] {
  const { batch, owner, repo, repoFullName, token, logger } = params;
  const sizeData: PRSizeData[] = [];
  const prNumbers = batch.map((pr) => pr.number);

  const query = buildBatchPRSizeQuery(prNumbers);
  const result = executeGraphQLWithRetry<{
    repository: Record<
      string,
      {
        number: number;
        title: string;
        createdAt: string;
        mergedAt: string | null;
        additions: number;
        deletions: number;
        changedFiles: number;
      } | null
    >;
  }>(query, { owner, name: repo }, token);

  if (!result.success || !result.data?.repository) {
    logger.warn(`  ⚠️ Failed to fetch batch PR size: ${result.error}`);
    return [];
  }

  for (let j = 0; j < batch.length; j++) {
    const prData = result.data.repository[`pr${j}`];

    if (!prData) {
      continue;
    }

    sizeData.push(calculatePRSizeData(prData, repoFullName));
  }

  return sizeData;
}

/**
 * 複数PRのサイズデータを取得（GraphQL版）
 *
 * getPullRequestsGraphQLでサイズ情報も取得済みの場合は
 * 追加リクエスト不要。
 */
export function getPRSizeDataForPRsGraphQL(
  pullRequests: GitHubPullRequest[],
  token: string
): PRSizeData[] {
  const { logger } = getContainer();
  const sizeData: PRSizeData[] = [];

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
      const batchResults = processBatchSizeData({
        batch,
        owner,
        repo,
        repoFullName,
        token,
        logger,
      });
      sizeData.push(...batchResults);
    }
  }

  return sizeData;
}
