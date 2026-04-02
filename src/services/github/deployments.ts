/**
 * GitHub Deployments & Workflows 関連モジュール
 *
 * デプロイメント一覧取得、ワークフロー実行履歴取得など
 * CI/CD関連のGitHub API操作を提供。
 */

import type {
  ApiResponse,
  GitHubDeployment,
  GitHubDeploymentResponse,
  GitHubRepository,
  GitHubWorkflowRun,
  GitHubWorkflowRunsResponse,
} from '../../types';
import { type DateRange, DEFAULT_MAX_PAGES, fetchGitHub, PER_PAGE } from './api';
import {
  buildDeploymentEndpoint,
  fetchDeploymentStatuses,
  processDeploymentPage,
} from './deploymentHelpers.js';

// =============================================================================
// 型定義
// =============================================================================

/** 環境名のマッチングモード */
export type EnvironmentMatchMode = 'exact' | 'partial';

/** デプロイメント取得オプション */
interface GetDeploymentsOptions {
  /** デプロイメント環境名（例: "production", "staging"） */
  environment?: string;
  /**
   * 環境名のマッチングモード
   * - "exact": 完全一致（GitHub APIのフィルタを使用、高速）
   * - "partial": 部分一致（クライアント側でフィルタ）
   */
  environmentMatchMode?: EnvironmentMatchMode;
  dateRange?: DateRange;
  maxPages?: number;
  /**
   * ステータス取得をスキップしてAPI呼び出しを削減
   * true: ステータスをnullのまま返す（高速）
   * false: 各デプロイメントのステータスを個別に取得
   */
  skipStatusFetch?: boolean;
}

// =============================================================================
// ワークフロー実行取得
// =============================================================================

/**
 * ワークフロー実行が日付範囲内かチェック
 */
function passesWorkflowDateRange(createdAt: Date, dateRange?: DateRange): boolean {
  if (dateRange?.until && createdAt > dateRange.until) {
    return false;
  }
  if (dateRange?.since && createdAt < dateRange.since) {
    return false;
  }
  return true;
}

/**
 * ワークフロー実行をGitHubWorkflowRun形式に変換
 */
function convertToWorkflowRun(
  run: GitHubWorkflowRunsResponse['workflow_runs'][0],
  repoFullName: string
): GitHubWorkflowRun {
  return {
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    repository: repoFullName,
  };
}

function buildWorkflowRunsEndpoint(
  repoFullName: string,
  page: number,
  dateRange?: DateRange
): string {
  let endpoint = `/repos/${repoFullName}/actions/runs?per_page=${PER_PAGE}&page=${page}`;
  if (dateRange?.since) {
    const sinceStr = dateRange.since.toISOString().split('T')[0];
    endpoint += `&created=${encodeURIComponent(`>=${sinceStr}`)}`;
  }
  return endpoint;
}

function processWorkflowRunsPage(
  response: ApiResponse<GitHubWorkflowRunsResponse>,
  repoFullName: string,
  dateRange: DateRange | undefined,
  allRuns: GitHubWorkflowRun[]
): boolean {
  if (!response.success || !response.data) {
    return false;
  }
  if (!response.data.workflow_runs || response.data.workflow_runs.length === 0) {
    return false;
  }
  for (const run of response.data.workflow_runs) {
    if (passesWorkflowDateRange(new Date(run.created_at), dateRange)) {
      allRuns.push(convertToWorkflowRun(run, repoFullName));
    }
  }
  return true;
}

/**
 * リポジトリのワークフロー実行履歴を取得
 */
export function getWorkflowRuns(
  repo: GitHubRepository,
  token: string,
  dateRange?: DateRange,
  maxPages = DEFAULT_MAX_PAGES
): ApiResponse<GitHubWorkflowRun[]> {
  const allRuns: GitHubWorkflowRun[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const endpoint = buildWorkflowRunsEndpoint(repo.fullName, page, dateRange);
    const response = fetchGitHub<GitHubWorkflowRunsResponse>(endpoint, token);

    if (!processWorkflowRunsPage(response, repo.fullName, dateRange, allRuns)) {
      if (page === 1 && !response.success) {
        return { success: false, error: response.error };
      }
      break;
    }
  }

  return { success: true, data: allRuns };
}

// =============================================================================
// デプロイメント取得
// =============================================================================

/**
 * リポジトリのデプロイメント一覧を取得
 */
export function getDeployments(
  repo: GitHubRepository,
  token: string,
  options: GetDeploymentsOptions = {}
): ApiResponse<GitHubDeployment[]> {
  const {
    environment,
    environmentMatchMode = 'exact',
    dateRange,
    maxPages = DEFAULT_MAX_PAGES,
    skipStatusFetch = false,
  } = options;

  const allDeployments: GitHubDeployment[] = [];
  let page = 1;

  // 部分一致の場合はAPIフィルタを使用せず、クライアント側でフィルタする
  const useApiFilter = !!(environment && environmentMatchMode === 'exact');

  // Phase 1: デプロイメント一覧を取得
  while (page <= maxPages) {
    const endpoint = buildDeploymentEndpoint({
      repoFullName: repo.fullName,
      page,
      perPage: PER_PAGE,
      environment,
      useApiFilter,
    });

    const response = fetchGitHub<GitHubDeploymentResponse[]>(endpoint, token);

    const result = processDeploymentPage({
      response,
      page,
      repoFullName: repo.fullName,
      environment,
      environmentMatchMode,
      dateRange,
      allDeployments,
    });

    if (!result.shouldContinue) {
      if (result.error) {
        return { success: false, error: result.error };
      }
      break;
    }

    page++;
  }

  // Phase 2: ステータスを取得（オプション）
  if (!skipStatusFetch) {
    fetchDeploymentStatuses(allDeployments, repo.fullName, token);
  }

  return { success: true, data: allDeployments };
}
