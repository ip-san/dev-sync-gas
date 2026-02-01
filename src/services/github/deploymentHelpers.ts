/**
 * デプロイメント処理のヘルパー関数
 *
 * getDeployments の複雑度削減のため分離
 */

import type { DateRange } from './api.js';
import type {
  GitHubDeploymentResponse,
  GitHubDeployment,
  GitHubDeploymentStatusResponse,
} from '../../types/index.js';
import { fetchGitHub, STATUS_FETCH_WARNING_THRESHOLD } from './api.js';
import { getContainer } from '../../container.js';

/**
 * デプロイメントが期間範囲内かチェック
 */
export function isWithinDateRange(createdAt: Date, dateRange?: DateRange): boolean {
  if (dateRange?.until && createdAt > dateRange.until) {
    return false;
  }
  if (dateRange?.since && createdAt < dateRange.since) {
    return false;
  }
  return true;
}

/**
 * デプロイメントが環境フィルタに合致するかチェック
 */
export function matchesEnvironmentFilter(
  deployment: GitHubDeploymentResponse,
  environment: string | undefined,
  matchMode: 'exact' | 'partial'
): boolean {
  if (!environment) {
    return true;
  }

  if (matchMode === 'partial') {
    const envLower = deployment.environment?.toLowerCase() ?? '';
    const filterLower = environment.toLowerCase();
    return envLower.includes(filterLower);
  }

  // exact mode は API側でフィルタ済み
  return true;
}

/**
 * APIレスポンスをGitHubDeployment型に変換
 */
export function convertToGitHubDeployment(
  deployment: GitHubDeploymentResponse,
  repoFullName: string
): GitHubDeployment {
  return {
    id: deployment.id,
    sha: deployment.sha,
    environment: deployment.environment,
    createdAt: deployment.created_at,
    updatedAt: deployment.updated_at,
    status: null, // 後でステータスを取得
    repository: repoFullName,
  };
}

/**
 * デプロイメント取得用のエンドポイントURLを構築
 */
export function buildDeploymentEndpoint(
  repoFullName: string,
  page: number,
  perPage: number,
  environment: string | undefined,
  useApiFilter: boolean
): string {
  let endpoint = `/repos/${repoFullName}/deployments?per_page=${perPage}&page=${page}`;
  if (useApiFilter && environment) {
    endpoint += `&environment=${encodeURIComponent(environment)}`;
  }
  return endpoint;
}

/**
 * ページ取得結果を処理
 * @returns true: 続行, false: 終了
 */
export function processDeploymentPage(
  response: { success: boolean; data?: GitHubDeploymentResponse[]; error?: string },
  page: number,
  repoFullName: string,
  environment: string | undefined,
  environmentMatchMode: 'exact' | 'partial',
  dateRange: DateRange | undefined,
  allDeployments: GitHubDeployment[]
): { shouldContinue: boolean; error?: string } {
  // エラーまたはデータなし
  if (!response.success || !response.data) {
    if (page === 1) {
      return { shouldContinue: false, error: response.error };
    }
    return { shouldContinue: false };
  }

  // 空ページ（終了）
  if (response.data.length === 0) {
    return { shouldContinue: false };
  }

  // デプロイメントを処理
  for (const deployment of response.data) {
    processDeployment(
      deployment,
      repoFullName,
      environment,
      environmentMatchMode,
      dateRange,
      allDeployments
    );
  }

  return { shouldContinue: true };
}

/**
 * デプロイメント1件を処理してリストに追加
 */
export function processDeployment(
  deployment: GitHubDeploymentResponse,
  repoFullName: string,
  environment: string | undefined,
  environmentMatchMode: 'exact' | 'partial',
  dateRange: DateRange | undefined,
  allDeployments: GitHubDeployment[]
): void {
  // 期間フィルタリング
  const createdAt = new Date(deployment.created_at);
  if (!isWithinDateRange(createdAt, dateRange)) {
    return;
  }

  // 環境フィルタリング（部分一致モードのみ）
  if (!matchesEnvironmentFilter(deployment, environment, environmentMatchMode)) {
    return;
  }

  allDeployments.push(convertToGitHubDeployment(deployment, repoFullName));
}

/**
 * デプロイメントのステータスを一括取得
 */
export function fetchDeploymentStatuses(
  deployments: GitHubDeployment[],
  repoFullName: string,
  token: string
): void {
  if (deployments.length === 0) {
    return;
  }

  const { logger } = getContainer();
  if (deployments.length > STATUS_FETCH_WARNING_THRESHOLD) {
    logger.log(`  ⚠️ Fetching status for ${deployments.length} deployments (may be slow)`);
  }

  for (const deployment of deployments) {
    const statusResponse = fetchGitHub<GitHubDeploymentStatusResponse[]>(
      `/repos/${repoFullName}/deployments/${deployment.id}/statuses?per_page=1`,
      token
    );
    if (statusResponse.success && statusResponse.data?.[0]) {
      deployment.status = statusResponse.data[0].state as typeof deployment.status;
    }
  }
}
