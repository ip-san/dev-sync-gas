/**
 * Pull Request listing operations
 */

import type { GitHubPullRequest, GitHubRepository, ApiResponse } from '../../../../types';
import { getContainer } from '../../../../container';
import { executeGraphQLWithRetry, DEFAULT_PAGE_SIZE } from '../client';
import { PULL_REQUESTS_QUERY } from '../queries';
import { isWithinPRDateRange } from '../issueHelpers';
import { validatePaginatedResponse } from '../errorHelpers';
import type { PullRequestsQueryResponse, GraphQLPullRequest } from '../types';
import type { DateRange } from '../../api';
import { parseGraphQLNodeIdOrZero } from '../../../../utils/graphqlParser';
import { shouldExcludeByLabels } from '../../../../utils/labelFilter';
import { getExcludeMetricsLabels } from '../../../../config/settings';
import type { GetPullRequestsGraphQLParams } from './types';

/**
 * PR状態をGraphQL形式のstatesに変換
 */
function convertPRStateToGraphQLStates(state: 'open' | 'closed' | 'all'): string[] {
  if (state === 'all') {
    return ['MERGED', 'OPEN', 'CLOSED'];
  }
  if (state === 'open') {
    return ['OPEN'];
  }
  return ['MERGED', 'CLOSED'];
}

/**
 * GraphQL Pull Requests Query用の変数を構築
 */
function buildPullRequestsQueryVariables(
  repo: GitHubRepository,
  cursor: string | null,
  states: string[]
): Record<string, unknown> {
  return {
    owner: repo.owner,
    name: repo.name,
    first: DEFAULT_PAGE_SIZE,
    after: cursor,
    states,
  };
}

/**
 * 日付範囲と除外ラベルでPRをフィルタリング
 */
function filterPRsByDateRange(
  prs: GraphQLPullRequest[],
  dateRange: DateRange | undefined,
  repository: string
): GitHubPullRequest[] {
  const filtered: GitHubPullRequest[] = [];
  const excludeLabels = getExcludeMetricsLabels();
  let excludedCount = 0;

  for (const pr of prs) {
    const createdAt = new Date(pr.createdAt);

    if (!isWithinPRDateRange(createdAt, dateRange)) {
      continue;
    }

    const prLabels = pr.labels.nodes.map((l) => l.name);
    if (shouldExcludeByLabels(prLabels, excludeLabels)) {
      excludedCount++;
      continue;
    }

    filtered.push(convertToPullRequest(pr, repository));
  }

  if (excludedCount > 0) {
    const { logger } = getContainer();
    logger.debug(`  ℹ️ Excluded ${excludedCount} PRs by labels`);
  }

  return filtered;
}

/**
 * GraphQL PRノードを内部型に変換
 */
function convertToPullRequest(pr: GraphQLPullRequest, repository: string): GitHubPullRequest {
  // GraphQLのstateはOPEN/MERGED/CLOSEDだが、GitHubPullRequestの型は"open"|"closed"
  // MERGEDはclosedとして扱う（REST APIとの互換性維持）
  const state: 'open' | 'closed' = pr.state === 'OPEN' ? 'open' : 'closed';
  return {
    id: parseGraphQLNodeIdOrZero(pr.id),
    number: pr.number,
    title: pr.title,
    state,
    createdAt: pr.createdAt,
    mergedAt: pr.mergedAt,
    closedAt: pr.closedAt,
    author: pr.author?.login ?? 'unknown',
    repository,
    baseBranch: pr.baseRefName,
    headBranch: pr.headRefName,
    mergeCommitSha: pr.mergeCommit?.oid,
  };
}

/**
 * リポジトリのPR一覧を取得（GraphQL版）
 *
 * REST APIとの違い:
 * - additions, deletions, changedFilesも同時に取得可能
 * - ブランチ情報（baseRefName, headRefName）も取得
 */
export function getPullRequestsGraphQL(
  params: GetPullRequestsGraphQLParams
): ApiResponse<GitHubPullRequest[]> {
  const { repo, token, state = 'all', dateRange, maxPages = 5 } = params;
  const { logger } = getContainer();
  const allPRs: GitHubPullRequest[] = [];
  let cursor: string | null = null;
  let page = 0;

  const states = convertPRStateToGraphQLStates(state);

  while (page < maxPages) {
    const variables = buildPullRequestsQueryVariables(repo, cursor, states);
    const queryResult: ApiResponse<PullRequestsQueryResponse> =
      executeGraphQLWithRetry<PullRequestsQueryResponse>(PULL_REQUESTS_QUERY, variables, token);

    const validationError = validatePaginatedResponse(queryResult, page, 'repository.pullRequests');
    if (validationError) {
      return validationError;
    }
    if (!queryResult.success) {
      break;
    }

    const prsData = queryResult.data!.repository!.pullRequests;
    const filteredPRs = filterPRsByDateRange(prsData.nodes, dateRange, repo.fullName);
    allPRs.push(...filteredPRs);

    if (!prsData.pageInfo.hasNextPage) {
      break;
    }
    cursor = prsData.pageInfo.endCursor;
    page++;
  }

  logger.info(`  📦 Fetched ${allPRs.length} PRs via GraphQL`);
  return { success: true, data: allPRs };
}
