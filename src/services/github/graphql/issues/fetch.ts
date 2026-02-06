/**
 * GitHub GraphQL API - Issue取得
 *
 * Issue一覧の取得とフィルタリング処理
 */

import type { GitHubIssue, GitHubRepository, ApiResponse } from '../../../../types';
import { getContainer } from '../../../../container';
import { executeGraphQLWithRetry, DEFAULT_PAGE_SIZE } from '../client';
import { ISSUES_QUERY } from '../queries/issues.js';
import type { IssuesQueryResponse, GraphQLIssue } from '../types';
import type { IssueDateRange } from '../../api';
import { isWithinDateRange } from '../issueHelpers';
import { validatePaginatedResponse } from '../errorHelpers';
import { shouldExcludeByLabels } from '../../../../utils/labelFilter';
import { getExcludeMetricsLabels } from '../../../../config/settings';

/**
 * GraphQL Issues Query用の変数を構築
 */
function buildIssuesQueryVariables(
  repo: GitHubRepository,
  cursor: string | null,
  labels?: string[]
): Record<string, unknown> {
  return {
    owner: repo.owner,
    name: repo.name,
    first: DEFAULT_PAGE_SIZE,
    after: cursor,
    labels: labels?.length ? labels : null,
    states: ['OPEN', 'CLOSED'],
  };
}

/**
 * 日付範囲と除外ラベルでIssueをフィルタリング
 */
function filterIssuesByDateRange(
  issues: GraphQLIssue[],
  dateRange: IssueDateRange | undefined,
  repository: string
): GitHubIssue[] {
  const filtered: GitHubIssue[] = [];
  const excludeLabels = getExcludeMetricsLabels();
  let excludedCount = 0;

  for (const issue of issues) {
    const createdAt = new Date(issue.createdAt);

    if (!isWithinDateRange(createdAt, dateRange)) {
      continue;
    }

    const issueLabels = issue.labels.nodes.map((l) => l.name);
    if (shouldExcludeByLabels(issueLabels, excludeLabels)) {
      excludedCount++;
      continue;
    }

    filtered.push(convertToIssue(issue, repository));
  }

  if (excludedCount > 0) {
    const { logger } = getContainer();
    logger.log(`  ℹ️ Excluded ${excludedCount} issues by labels`);
  }

  return filtered;
}

/**
 * GraphQL Issueノードを内部型に変換
 */
function convertToIssue(issue: GraphQLIssue, repository: string): GitHubIssue {
  return {
    id: parseInt(issue.id.replace(/\D/g, ''), 10) || 0,
    number: issue.number,
    title: issue.title,
    state: issue.state.toLowerCase() as 'open' | 'closed',
    createdAt: issue.createdAt,
    closedAt: issue.closedAt,
    labels: issue.labels.nodes.map((l) => l.name),
    repository,
  };
}

/**
 * リポジトリのIssue一覧を取得（GraphQL版）
 *
 * REST APIとの違い:
 * - PRは含まれない（Issues APIではPRも返される）
 * - ラベルフィルタをAPI側で処理
 */
export function getIssuesGraphQL(
  repo: GitHubRepository,
  token: string,
  options?: {
    dateRange?: IssueDateRange;
    labels?: string[];
  }
): ApiResponse<GitHubIssue[]> {
  const { logger } = getContainer();
  const allIssues: GitHubIssue[] = [];
  let cursor: string | null = null;
  let page = 0;
  const maxPages = 10;

  logger.log(`  📋 Fetching issues from ${repo.fullName}...`);

  while (page < maxPages) {
    const variables = buildIssuesQueryVariables(repo, cursor, options?.labels);
    const queryResult: ApiResponse<IssuesQueryResponse> =
      executeGraphQLWithRetry<IssuesQueryResponse>(ISSUES_QUERY, variables, token);

    const validationError = validatePaginatedResponse(queryResult, page, 'repository.issues');
    if (validationError) {
      return validationError;
    }
    if (!queryResult.success) {
      break;
    }

    const issuesData = queryResult.data!.repository!.issues;
    const filteredIssues = filterIssuesByDateRange(
      issuesData.nodes,
      options?.dateRange,
      repo.fullName
    );
    allIssues.push(...filteredIssues);

    if (!issuesData.pageInfo.hasNextPage) {
      break;
    }
    cursor = issuesData.pageInfo.endCursor;
    page++;
  }

  logger.log(`  ✅ Found ${allIssues.length} issues`);
  return { success: true, data: allIssues };
}
