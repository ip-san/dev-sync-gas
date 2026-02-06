/**
 * Pull Request detail operations
 */

import type { GitHubPullRequest, ApiResponse } from '../../../../types';
import { executeGraphQLWithRetry } from '../client';
import { PULL_REQUEST_DETAIL_QUERY } from '../queries/pullRequests.js';
import { validateSingleResponse } from '../errorHelpers';
import type { PullRequestDetailQueryResponse, GraphQLPullRequest } from '../types';
import { parseGraphQLNodeIdOrZero } from '../../../../utils/graphqlParser';

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
 * PR詳細を取得（GraphQL版）
 */
export function getPRDetailsGraphQL(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<{
  additions: number;
  deletions: number;
  changedFiles: number;
}> {
  const result = executeGraphQLWithRetry<PullRequestDetailQueryResponse>(
    PULL_REQUEST_DETAIL_QUERY,
    {
      owner,
      name: repo,
      number: prNumber,
    },
    token
  );

  const validationError = validateSingleResponse(result, 'repository.pullRequest');
  if (validationError) {
    return validationError;
  }

  const pr = result.data!.repository!.pullRequest!;
  return {
    success: true,
    data: {
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
    },
  };
}

/**
 * PRのブランチ情報を含む詳細を取得（GraphQL版）
 */
export function getPullRequestWithBranchesGraphQL(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<GitHubPullRequest> {
  const result = executeGraphQLWithRetry<PullRequestDetailQueryResponse>(
    PULL_REQUEST_DETAIL_QUERY,
    {
      owner,
      name: repo,
      number: prNumber,
    },
    token
  );

  const validationError = validateSingleResponse(result, 'repository.pullRequest');
  if (validationError) {
    return validationError;
  }

  const pr = result.data!.repository!.pullRequest!;
  return {
    success: true,
    data: convertToPullRequest(pr, `${owner}/${repo}`),
  };
}
