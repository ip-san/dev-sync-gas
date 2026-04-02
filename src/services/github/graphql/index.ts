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
 * - pullRequests/: PR関連操作
 * - deployments.ts: デプロイメント関連操作
 * - issues.ts: Issue関連操作
 */

export type { GraphQLError, GraphQLResponse, PageInfo, RateLimitInfo } from './client';
// クライアント基盤
export {
  DEFAULT_PAGE_SIZE,
  executeGraphQL,
  executeGraphQLWithRetry,
  GITHUB_GRAPHQL_ENDPOINT,
  getRateLimitInfo,
  MAX_RETRIES,
} from './client';
export type { EnvironmentMatchMode, GetDeploymentsOptions } from './deployments';

// Deployment 操作
export { getDeploymentsGraphQL } from './deployments';
// Issue 操作
export {
  findPRContainingCommitGraphQL,
  getCodingTimeDataGraphQL,
  getCycleTimeDataGraphQL,
  getIssuesGraphQL,
  getLinkedPRsForIssueGraphQL,
  trackToProductionMergeGraphQL,
} from './issues';
// Pull Request 操作
export {
  getPRCycleTimeDataGraphQL,
  getPRDetailsGraphQL,
  getPRSizeDataForPRsGraphQL,
  getPullRequestsGraphQL,
  getPullRequestWithBranchesGraphQL,
  getReviewEfficiencyDataForPRsGraphQL,
  getReworkDataForPRsGraphQL,
} from './pullRequests/index.js';

// 型定義
export type {
  Actor,
  Connection,
  CrossReferencedEvent,
  DeploymentState,
  DeploymentStatusState,
  GraphQLCommit,
  GraphQLDeployment,
  GraphQLIssue,
  GraphQLIssueWithLinkedPRs,
  GraphQLLabel,
  GraphQLNode,
  GraphQLPullRequest,
  GraphQLPullRequestDetail,
  GraphQLReview,
  GraphQLTimelineEvent,
  IssueState,
  PullRequestState,
  ReviewState,
} from './types';

// =============================================================================
// 複合機能（REST API互換）
// =============================================================================

import { getIncidentLabels } from '../../../config/settings';
import { getContainer } from '../../../container';
import type {
  GitHubDeployment,
  GitHubIncident,
  GitHubPullRequest,
  GitHubRepository,
  GitHubWorkflowRun,
} from '../../../types';
import type { DateRange } from '../api';
import { getWorkflowRuns } from '../deployments'; // ワークフローはREST APIを継続使用
import type { EnvironmentMatchMode } from './deployments';
import { getDeploymentsGraphQL } from './deployments';
import { getIssuesGraphQL } from './issues';
import { getPullRequestsGraphQL } from './pullRequests/index.js';

/**
 * 複数リポジトリからデータを一括取得する際のオプション
 */
export interface GetAllRepositoriesDataOptions {
  dateRange?: DateRange;
  deploymentEnvironment?: string;
  deploymentEnvironmentMatchMode?: EnvironmentMatchMode;
}

/**
 * 1リポジトリのPRを取得してログ出力
 */
function fetchPullRequestsForRepo(
  repo: GitHubRepository,
  token: string,
  dateRange: DateRange | undefined,
  logger: { log: (msg: string) => void }
): GitHubPullRequest[] {
  const prsResult = getPullRequestsGraphQL({
    repo,
    token,
    state: 'all',
    dateRange,
  });

  if (prsResult.success && prsResult.data) {
    logger.log(`  PRs: ${prsResult.data.length}`);
    return prsResult.data;
  }

  logger.log(`  ⚠️ PR fetch failed: ${prsResult.error}`);
  return [];
}

/**
 * 1リポジトリのワークフロー実行を取得してログ出力
 */
function fetchWorkflowRunsForRepo(
  repo: GitHubRepository,
  token: string,
  dateRange: DateRange | undefined,
  logger: { log: (msg: string) => void }
): GitHubWorkflowRun[] {
  const runsResult = getWorkflowRuns(repo, token, dateRange);

  if (runsResult.success && runsResult.data) {
    logger.log(`  Workflow runs: ${runsResult.data.length}`);
    return runsResult.data;
  }

  logger.log(`  ⚠️ Workflow fetch failed: ${runsResult.error}`);
  return [];
}

/**
 * デプロイメント取得のパラメータ
 */
interface FetchDeploymentsParams {
  repo: GitHubRepository;
  token: string;
  environment: string;
  environmentMatchMode: EnvironmentMatchMode;
  dateRange: DateRange | undefined;
  logger: { log: (msg: string) => void };
}

/**
 * 1リポジトリのデプロイメントを取得してログ出力
 */
function fetchDeploymentsForRepo(params: FetchDeploymentsParams): GitHubDeployment[] {
  const { repo, token, environment, environmentMatchMode, dateRange, logger } = params;

  const deploymentsResult = getDeploymentsGraphQL(repo, token, {
    environment,
    environmentMatchMode,
    dateRange,
  });

  if (deploymentsResult.success && deploymentsResult.data) {
    logger.log(`  Deployments: ${deploymentsResult.data.length}`);
    return deploymentsResult.data;
  }

  logger.log(`  ⚠️ Deployments fetch failed: ${deploymentsResult.error}`);
  return [];
}

/**
 * 1リポジトリのインシデントを取得してログ出力
 */
function fetchIncidentsForRepo(
  repo: GitHubRepository,
  token: string,
  dateRange: DateRange | undefined,
  logger: { log: (msg: string) => void }
): GitHubIncident[] {
  const incidentLabels = getIncidentLabels();
  const incidentsResult = getIssuesGraphQL(repo, token, {
    labels: incidentLabels,
    dateRange: dateRange
      ? { start: dateRange.since?.toISOString(), end: dateRange.until?.toISOString() }
      : undefined,
  });

  if (incidentsResult.success && incidentsResult.data) {
    const incidents = incidentsResult.data;
    logger.log(`  Incidents: ${incidents.length}`);
    return incidents;
  }

  logger.log(`  ⚠️ Incidents fetch failed: ${incidentsResult.error}`);
  return [];
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
  incidents: GitHubIncident[];
} {
  const {
    dateRange,
    deploymentEnvironment = 'production',
    deploymentEnvironmentMatchMode = 'partial',
  } = options;
  const { logger } = getContainer();

  const allPRs: GitHubPullRequest[] = [];
  const allRuns: GitHubWorkflowRun[] = [];
  const allDeployments: GitHubDeployment[] = [];
  const allIncidents: GitHubIncident[] = [];

  for (const repo of repositories) {
    logger.log(`📡 Fetching data for ${repo.fullName} (GraphQL)...`);

    const prs = fetchPullRequestsForRepo(repo, token, dateRange, logger);
    allPRs.push(...prs);

    const runs = fetchWorkflowRunsForRepo(repo, token, dateRange, logger);
    allRuns.push(...runs);

    const deployments = fetchDeploymentsForRepo({
      repo,
      token,
      environment: deploymentEnvironment,
      environmentMatchMode: deploymentEnvironmentMatchMode,
      dateRange,
      logger,
    });
    allDeployments.push(...deployments);

    const incidents = fetchIncidentsForRepo(repo, token, dateRange, logger);
    allIncidents.push(...incidents);
  }

  return {
    pullRequests: allPRs,
    workflowRuns: allRuns,
    deployments: allDeployments,
    incidents: allIncidents,
  };
}
