/**
 * GitHub GraphQL API - Deployment 操作
 *
 * REST APIからの移行:
 * - getDeployments: 一覧取得 + 各ステータス取得 → 1リクエストで完結
 *
 * 効率化ポイント:
 * - REST APIでは N+1 問題があった（一覧 + 各ステータス）
 * - GraphQLでは1リクエストでステータスも含めて取得
 */

import { getContainer } from '../../../container';
import type { ApiResponse, GitHubDeployment, GitHubRepository } from '../../../types';
import type { DateRange } from '../api';
import { DEFAULT_PAGE_SIZE, executeGraphQLWithRetry } from './client';
import { validatePaginatedResponse } from './errorHelpers.js';
import { DEPLOYMENTS_QUERY } from './queries/deployments.js';
import type { DeploymentsQueryResponse, GraphQLDeployment } from './types';

// =============================================================================
// 型定義
// =============================================================================

/** 環境名のマッチングモード */
export type EnvironmentMatchMode = 'exact' | 'partial';

/** デプロイメント取得オプション */
export interface GetDeploymentsOptions {
  environment?: string;
  environmentMatchMode?: EnvironmentMatchMode;
  dateRange?: DateRange;
  maxPages?: number;
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * デプロイメントが環境フィルタを通過するかチェック
 */
function passesEnvironmentFilter(
  deployment: GraphQLDeployment,
  environment: string | undefined,
  environmentMatchMode: EnvironmentMatchMode
): boolean {
  if (!environment || environmentMatchMode !== 'partial') {
    return true;
  }

  const envLower = deployment.environment?.toLowerCase() ?? '';
  const filterLower = environment.toLowerCase();
  return envLower.includes(filterLower);
}

/**
 * デプロイメントが日付範囲内かチェック
 */
function passesDateRangeFilter(createdAt: Date, dateRange?: DateRange): boolean {
  if (dateRange?.until && createdAt > dateRange.until) {
    return false;
  }
  if (dateRange?.since && createdAt < dateRange.since) {
    return false;
  }
  return true;
}

/**
 * デプロイメント1件が全てのフィルタを通過するかチェック
 */
function shouldIncludeDeployment(
  deployment: GraphQLDeployment,
  environment: string | undefined,
  environmentMatchMode: EnvironmentMatchMode,
  dateRange?: DateRange
): boolean {
  const createdAt = new Date(deployment.createdAt);

  if (!passesDateRangeFilter(createdAt, dateRange)) {
    return false;
  }

  if (!passesEnvironmentFilter(deployment, environment, environmentMatchMode)) {
    return false;
  }

  return true;
}

// =============================================================================
// デプロイメント一覧取得
// =============================================================================

/**
 * リポジトリのデプロイメント一覧を取得（GraphQL版）
 *
 * REST APIとの違い:
 * - ステータスも同時に取得（追加リクエスト不要）
 * - environments パラメータで環境フィルタ可能
 */
function fetchDeploymentsPage(
  repo: GitHubRepository,
  token: string,
  cursor: string | null,
  environments: string[] | null
): ApiResponse<DeploymentsQueryResponse> {
  return executeGraphQLWithRetry<DeploymentsQueryResponse>(
    DEPLOYMENTS_QUERY,
    {
      owner: repo.owner,
      name: repo.name,
      first: DEFAULT_PAGE_SIZE,
      after: cursor,
      environments,
    },
    token
  );
}

function collectDeployments(
  nodes: GraphQLDeployment[],
  repoFullName: string,
  environment: string | undefined,
  environmentMatchMode: EnvironmentMatchMode,
  dateRange: DateRange | undefined,
  allDeployments: GitHubDeployment[]
): void {
  for (const deployment of nodes) {
    if (shouldIncludeDeployment(deployment, environment, environmentMatchMode, dateRange)) {
      allDeployments.push(convertToDeployment(deployment, repoFullName));
    }
  }
}

type DeploymentsPageResult =
  | { type: 'error'; error: ApiResponse<GitHubDeployment[]> }
  | { type: 'done' }
  | { type: 'next'; cursor: string | null };

function processDeploymentsPage(
  queryResult: ApiResponse<DeploymentsQueryResponse>,
  page: number,
  repo: GitHubRepository,
  options: GetDeploymentsOptions,
  allDeployments: GitHubDeployment[]
): DeploymentsPageResult {
  const validationError = validatePaginatedResponse(queryResult, page, 'repository.deployments');
  if (validationError) {
    return { type: 'error', error: validationError };
  }
  if (!queryResult.success) {
    return { type: 'done' };
  }

  const deploymentsData = queryResult.data?.repository?.deployments;
  if (!deploymentsData) {
    return { type: 'done' };
  }

  collectDeployments(
    deploymentsData.nodes,
    repo.fullName,
    options.environment,
    options.environmentMatchMode ?? 'exact',
    options.dateRange,
    allDeployments
  );

  if (!deploymentsData.pageInfo.hasNextPage) {
    return { type: 'done' };
  }
  return { type: 'next', cursor: deploymentsData.pageInfo.endCursor };
}

export function getDeploymentsGraphQL(
  repo: GitHubRepository,
  token: string,
  options: GetDeploymentsOptions = {}
): ApiResponse<GitHubDeployment[]> {
  const { logger } = getContainer();
  const { environment, environmentMatchMode = 'exact', maxPages = 5 } = options;

  const allDeployments: GitHubDeployment[] = [];
  let cursor: string | null = null;
  const environments = environment && environmentMatchMode === 'exact' ? [environment] : null;

  for (let page = 0; page < maxPages; page++) {
    const queryResult = fetchDeploymentsPage(repo, token, cursor, environments);
    const pageResult = processDeploymentsPage(queryResult, page, repo, options, allDeployments);

    if (pageResult.type === 'error') {
      return pageResult.error;
    }
    if (pageResult.type === 'done') {
      break;
    }
    cursor = pageResult.cursor;
  }

  logger.log(`  📦 Fetched ${allDeployments.length} deployments via GraphQL`);
  return { success: true, data: allDeployments };
}

/**
 * GraphQL Deploymentノードを内部型に変換
 */
function convertToDeployment(deployment: GraphQLDeployment, repository: string): GitHubDeployment {
  // GraphQL state を REST API互換のステータスに変換
  const status = mapDeploymentStatus(deployment.state, deployment.latestStatus?.state);

  return {
    id: parseInt(deployment.id.replace(/\D/g, ''), 10) || 0,
    sha: deployment.commit?.oid ?? '',
    environment: deployment.environment,
    createdAt: deployment.createdAt,
    updatedAt: deployment.updatedAt,
    status,
    repository,
  };
}

/**
 * 文字列が有効なデプロイメントステータスかをチェックする型ガード
 */
function isValidDeploymentStatus(value: string): value is NonNullable<GitHubDeployment['status']> {
  const validStatuses: Array<NonNullable<GitHubDeployment['status']>> = [
    'success',
    'failure',
    'error',
    'inactive',
    'in_progress',
    'queued',
    'pending',
  ];
  return validStatuses.includes(value as NonNullable<GitHubDeployment['status']>);
}

/**
 * GraphQL DeploymentState のマッピングテーブル
 */
const DEPLOYMENT_STATE_MAP: Record<string, GitHubDeployment['status']> = {
  ACTIVE: 'success',
  ERROR: 'failure',
  FAILURE: 'failure',
  IN_PROGRESS: 'pending',
  PENDING: 'pending',
  QUEUED: 'pending',
  WAITING: 'pending',
  INACTIVE: 'inactive',
  DESTROYED: 'inactive',
  ABANDONED: 'inactive',
};

/**
 * GraphQL DeploymentState/DeploymentStatusState を REST API互換のステータスに変換
 */
function mapDeploymentStatus(
  state: string,
  statusState?: string | null
): GitHubDeployment['status'] {
  // latestStatus がある場合はそちらを優先
  if (statusState) {
    const mapped = statusState.toLowerCase();
    if (isValidDeploymentStatus(mapped)) {
      return mapped;
    }
    return null;
  }

  // state から推測
  return DEPLOYMENT_STATE_MAP[state] ?? null;
}
