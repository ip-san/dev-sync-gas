/**
 * GitHub GraphQL API モジュール - エントリーポイント
 *
 * REST APIからGraphQL APIへの移行を提供。
 * 同じインターフェースでREST/GraphQLを切り替え可能。
 *
 * メリット:
 * - API呼び出し回数の大幅削減（N+1問題の解消）
 * - 1リクエストで必要なデータを全て取得
 * - レート制限の効率的な使用（5,000ポイント/時間）
 *
 * 構成:
 * - client.ts: GraphQL実行基盤
 * - queries.ts: クエリ定義
 * - types.ts: 型定義
 * - pullRequests.ts: PR関連操作
 * - deployments.ts: デプロイメント関連操作
 * - issues.ts: Issue関連操作
 */

// クライアント基盤
export {
  executeGraphQL,
  executeGraphQLWithRetry,
  getRateLimitInfo,
  GITHUB_GRAPHQL_ENDPOINT,
  DEFAULT_PAGE_SIZE,
  MAX_RETRIES,
} from './client';
export type { GraphQLError, GraphQLResponse, PageInfo, RateLimitInfo } from './client';

// Pull Request 操作
export {
  getPullRequestsGraphQL,
  getPRDetailsGraphQL,
  getPullRequestWithBranchesGraphQL,
  getReworkDataForPRsGraphQL,
  getPRSizeDataForPRsGraphQL,
  getReviewEfficiencyDataForPRsGraphQL,
} from './pullRequests';

// Deployment 操作
export { getDeploymentsGraphQL } from './deployments';
export type { EnvironmentMatchMode, GetDeploymentsOptions } from './deployments';

// Issue 操作
export {
  getIssuesGraphQL,
  getLinkedPRsForIssueGraphQL,
  findPRContainingCommitGraphQL,
  trackToProductionMergeGraphQL,
  getCycleTimeDataGraphQL,
  getCodingTimeDataGraphQL,
} from './issues';

// 型定義
export type {
  GraphQLNode,
  Connection,
  Actor,
  PullRequestState,
  ReviewState,
  GraphQLPullRequest,
  GraphQLReview,
  GraphQLCommit,
  GraphQLTimelineEvent,
  GraphQLPullRequestDetail,
  DeploymentState,
  DeploymentStatusState,
  GraphQLDeployment,
  IssueState,
  GraphQLLabel,
  GraphQLIssue,
  CrossReferencedEvent,
  GraphQLIssueWithLinkedPRs,
} from './types';

// =============================================================================
// 複合機能（REST API互換）
// =============================================================================

import type {
  GitHubPullRequest,
  GitHubWorkflowRun,
  GitHubDeployment,
  GitHubRepository,
} from '../../../types';
import { getContainer } from '../../../container';
import { getPullRequestsGraphQL } from './pullRequests';
import { getDeploymentsGraphQL } from './deployments';
import { getWorkflowRuns } from '../deployments'; // ワークフローはREST APIを継続使用
import type { DateRange } from '../api';
import type { EnvironmentMatchMode } from './deployments';

/**
 * 複数リポジトリからデータを一括取得する際のオプション
 */
export interface GetAllRepositoriesDataOptions {
  dateRange?: DateRange;
  deploymentEnvironment?: string;
  deploymentEnvironmentMatchMode?: EnvironmentMatchMode;
}

/**
 * 複数リポジトリのGitHubデータを一括取得（GraphQL版）
 *
 * REST API版と同じインターフェースを提供。
 * 内部的にはGraphQL APIを使用してAPI呼び出し回数を削減。
 *
 * 注意: GitHub Actions Workflow Runsは GraphQL APIでサポートされていないため、
 * 引き続きREST APIを使用。
 */
export function getAllRepositoriesDataGraphQL(
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
    logger.log(`📡 Fetching data for ${repo.fullName} (GraphQL)...`);

    // PRを取得（GraphQL）
    const prsResult = getPullRequestsGraphQL({
      repo,
      token,
      state: 'all',
      dateRange,
    });
    if (prsResult.success && prsResult.data) {
      allPRs.push(...prsResult.data);
      logger.log(`  PRs: ${prsResult.data.length}`);
    } else {
      logger.log(`  ⚠️ PR fetch failed: ${prsResult.error}`);
    }

    // ワークフロー実行を取得（REST API - GraphQL未サポート）
    const runsResult = getWorkflowRuns(repo, token, dateRange);
    if (runsResult.success && runsResult.data) {
      allRuns.push(...runsResult.data);
      logger.log(`  Workflow runs: ${runsResult.data.length}`);
    } else {
      logger.log(`  ⚠️ Workflow fetch failed: ${runsResult.error}`);
    }

    // デプロイメントを取得（GraphQL）
    const deploymentsResult = getDeploymentsGraphQL(repo, token, {
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
