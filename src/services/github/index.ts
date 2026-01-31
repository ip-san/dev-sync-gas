/**
 * GitHub API モジュール - エントリーポイント
 *
 * GitHub REST API および GraphQL API との連携機能を提供。
 *
 * 構成:
 * - api.ts: REST API基盤（fetchGitHub、定数、共通型）
 * - pullRequests.ts: PR関連（一覧取得、詳細、レビュー、サイズ）
 * - deployments.ts: デプロイメント・ワークフロー関連
 * - issues.ts: Issue・インシデント関連
 * - cycleTime.ts: サイクルタイム・コーディングタイム計測
 * - graphql/: GraphQL API版（効率的なデータ取得）
 *
 * GraphQL版のメリット:
 * - API呼び出し回数の大幅削減（N+1問題の解消）
 * - 1リクエストで必要なデータを全て取得
 * - レート制限の効率的な使用（5,000ポイント/時間）
 */

// API基盤
export { fetchGitHub, GITHUB_API_BASE, DEFAULT_MAX_PAGES, PER_PAGE } from './api';
export type { DateRange, IssueDateRange } from './api';

// Pull Request関連
export {
  getPullRequests,
  getPRDetails,
  getPullRequestWithBranches,
  getReworkDataForPRs,
  getPRSizeDataForPRs,
  getReviewEfficiencyDataForPRs,
  findPRContainingCommit,
} from './pullRequests';

// Deployment・Workflow関連
export { getWorkflowRuns, getDeployments } from './deployments';
export type { EnvironmentMatchMode } from './deployments';

// Issue・Incident関連
export { getIncidents, getIssues, getLinkedPRsForIssue } from './issues';

// Cycle Time・Coding Time関連
export { trackToProductionMerge, getCycleTimeData, getCodingTimeData } from './cycleTime';

// =============================================================================
// GraphQL API版（効率的なデータ取得）
// =============================================================================

export {
  // クライアント基盤
  executeGraphQL,
  executeGraphQLWithRetry,
  getRateLimitInfo,
  GITHUB_GRAPHQL_ENDPOINT,
  // Pull Request 操作
  getPullRequestsGraphQL,
  getPRDetailsGraphQL,
  getPullRequestWithBranchesGraphQL,
  getReworkDataForPRsGraphQL,
  getPRSizeDataForPRsGraphQL,
  getReviewEfficiencyDataForPRsGraphQL,
  // Deployment 操作
  getDeploymentsGraphQL,
  // Issue 操作
  getIssuesGraphQL,
  getLinkedPRsForIssueGraphQL,
  findPRContainingCommitGraphQL,
  trackToProductionMergeGraphQL,
  getCycleTimeDataGraphQL,
  getCodingTimeDataGraphQL,
  // 複合機能
  getAllRepositoriesDataGraphQL,
} from './graphql';

export type { GraphQLError, GraphQLResponse, PageInfo, RateLimitInfo } from './graphql';

// =============================================================================
// 複合機能（REST API版）
// =============================================================================

import type {
  GitHubPullRequest,
  GitHubWorkflowRun,
  GitHubDeployment,
  GitHubRepository,
} from '../../types';
import { getContainer } from '../../container';
import { getPullRequests } from './pullRequests';
import { getWorkflowRuns, getDeployments } from './deployments';
import type { DateRange } from './api';
import type { EnvironmentMatchMode } from './deployments';

/**
 * 複数リポジトリからデータを一括取得する際のオプション
 */
export interface GetAllRepositoriesDataOptions {
  dateRange?: DateRange;
  /** デプロイメント環境名（デフォルト: "production"） */
  deploymentEnvironment?: string;
  /** 環境名のマッチングモード（デフォルト: "exact"） */
  deploymentEnvironmentMatchMode?: EnvironmentMatchMode;
}

/**
 * 複数リポジトリのGitHubデータを一括取得
 *
 * PR、ワークフロー実行、デプロイメントを一括で取得し、
 * DORA metrics計算の入力データとして使用する。
 */
export function getAllRepositoriesData(
  repositories: GitHubRepository[],
  token: string,
  options: GetAllRepositoriesDataOptions = {}
): {
  pullRequests: GitHubPullRequest[];
  workflowRuns: GitHubWorkflowRun[];
  deployments: GitHubDeployment[];
} {
  const {
    dateRange,
    deploymentEnvironment = 'production',
    deploymentEnvironmentMatchMode = 'exact',
  } = options;
  const { logger } = getContainer();

  const allPRs: GitHubPullRequest[] = [];
  const allRuns: GitHubWorkflowRun[] = [];
  const allDeployments: GitHubDeployment[] = [];

  for (const repo of repositories) {
    logger.log(`📡 Fetching data for ${repo.fullName}...`);

    // PRを取得
    const prsResult = getPullRequests(repo, token, 'all', dateRange);
    if (prsResult.success && prsResult.data) {
      allPRs.push(...prsResult.data);
      logger.log(`  PRs: ${prsResult.data.length}`);
    } else {
      logger.log(`  ⚠️ PR fetch failed: ${prsResult.error}`);
    }

    // ワークフロー実行を取得
    const runsResult = getWorkflowRuns(repo, token, dateRange);
    if (runsResult.success && runsResult.data) {
      allRuns.push(...runsResult.data);
      logger.log(`  Workflow runs: ${runsResult.data.length}`);
    } else {
      logger.log(`  ⚠️ Workflow fetch failed: ${runsResult.error}`);
    }

    // デプロイメントを取得
    const deploymentsResult = getDeployments(repo, token, {
      environment: deploymentEnvironment,
      environmentMatchMode: deploymentEnvironmentMatchMode,
      dateRange,
    });
    if (deploymentsResult.success && deploymentsResult.data) {
      allDeployments.push(...deploymentsResult.data);
      logger.log(`  Deployments: ${deploymentsResult.data.length}`);
    } else {
      logger.log(`  ⚠️ Deployments fetch failed: ${deploymentsResult.error}`);
    }
  }

  return {
    pullRequests: allPRs,
    workflowRuns: allRuns,
    deployments: allDeployments,
  };
}
