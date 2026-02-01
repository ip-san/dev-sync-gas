/**
 * GitHub Deployments & Workflows 関連モジュール
 *
 * デプロイメント一覧取得、ワークフロー実行履歴取得など
 * CI/CD関連のGitHub API操作を提供。
 */

import type {
  GitHubWorkflowRun,
  GitHubDeployment,
  GitHubRepository,
  ApiResponse,
  GitHubWorkflowRunsResponse,
  GitHubDeploymentResponse,
} from '../../types';
import { fetchGitHub, DEFAULT_MAX_PAGES, PER_PAGE, type DateRange } from './api';
import {
  fetchDeploymentStatuses,
  buildDeploymentEndpoint,
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
 * リポジトリのワークフロー実行履歴を取得
 */
export function getWorkflowRuns(
  repo: GitHubRepository,
  token: string,
  dateRange?: DateRange,
  maxPages = DEFAULT_MAX_PAGES
): ApiResponse<GitHubWorkflowRun[]> {
  const allRuns: GitHubWorkflowRun[] = [];
  let page = 1;

  while (page <= maxPages) {
    let endpoint = `/repos/${repo.fullName}/actions/runs?per_page=${PER_PAGE}&page=${page}`;

    // GitHub Actions APIは created パラメータで日付フィルタ可能
    if (dateRange?.since) {
      const sinceStr = dateRange.since.toISOString().split('T')[0];
      endpoint += `&created=${encodeURIComponent('>=' + sinceStr)}`;
    }

    const response = fetchGitHub<GitHubWorkflowRunsResponse>(endpoint, token);

    if (!response.success || !response.data) {
      if (page === 1) {
        return { success: false, error: response.error };
      }
      break;
    }

    if (!response.data.workflow_runs || response.data.workflow_runs.length === 0) {
      break;
    }

    for (const run of response.data.workflow_runs) {
      const createdAt = new Date(run.created_at);

      // 期間フィルタリング
      if (dateRange?.until && createdAt > dateRange.until) {
        continue;
      }
      if (dateRange?.since && createdAt < dateRange.since) {
        continue;
      }

      allRuns.push({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        repository: repo.fullName,
      });
    }

    page++;
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
    const endpoint = buildDeploymentEndpoint(
      repo.fullName,
      page,
      PER_PAGE,
      environment,
      useApiFilter
    );

    const response = fetchGitHub<GitHubDeploymentResponse[]>(endpoint, token);

    const result = processDeploymentPage(
      response,
      page,
      repo.fullName,
      environment,
      environmentMatchMode,
      dateRange,
      allDeployments
    );

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
