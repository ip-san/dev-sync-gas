/**
 * GraphQL バッチ処理の共通ヘルパー
 *
 * 複数のGraphQL関数で共通のパターンを抽出
 */

import type { GitHubPullRequest } from '../../../types/index.js';
import { getContainer } from '../../../container.js';
import { parseRepositorySafe } from '../../../utils/repositoryParser.js';

/**
 * PRをリポジトリごとにグループ化
 */
export function groupPRsByRepository(
  pullRequests: GitHubPullRequest[]
): Map<string, GitHubPullRequest[]> {
  const prsByRepo = new Map<string, GitHubPullRequest[]>();

  for (const pr of pullRequests) {
    const existing = prsByRepo.get(pr.repository) ?? [];
    existing.push(pr);
    prsByRepo.set(pr.repository, existing);
  }

  return prsByRepo;
}

/**
 * リポジトリ名をowner/repoに分解
 * 失敗時はnullを返す
 */
export function parseRepository(repoFullName: string): { owner: string; repo: string } | null {
  const { logger } = getContainer();
  const parseResult = parseRepositorySafe(repoFullName);

  if (!parseResult.success || !parseResult.data) {
    logger.log(`  ⚠️ ${parseResult.success ? 'No data returned' : parseResult.error}`);
    return null;
  }

  return { owner: parseResult.data.owner, repo: parseResult.data.repo };
}
