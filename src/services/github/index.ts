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

export type { DateRange, IssueDateRange } from './api';
// API基盤
export { DEFAULT_MAX_PAGES, fetchGitHub, GITHUB_API_BASE, PER_PAGE } from './api';
export type { EnvironmentMatchMode } from './deployments';
// Deployment・Workflow関連（REST版は部分的に維持、GraphQL移行中）
export { getDeployments, getWorkflowRuns } from './deployments';

// =============================================================================
// GraphQL API版（効率的なデータ取得）
// =============================================================================

export type { GraphQLError, GraphQLResponse, PageInfo, RateLimitInfo } from './graphql';
export {
  // クライアント基盤
  executeGraphQL,
  executeGraphQLWithRetry,
  findPRContainingCommitGraphQL,
  GITHUB_GRAPHQL_ENDPOINT,
  // 複合機能
  getAllRepositoriesDataGraphQL,
  getCodingTimeDataGraphQL,
  getCycleTimeDataGraphQL,
  // Deployment 操作
  getDeploymentsGraphQL,
  // Issue 操作
  getIssuesGraphQL,
  getLinkedPRsForIssueGraphQL,
  getPRCycleTimeDataGraphQL,
  getPRDetailsGraphQL,
  getPRSizeDataForPRsGraphQL,
  // Pull Request 操作
  getPullRequestsGraphQL,
  getPullRequestWithBranchesGraphQL,
  getRateLimitInfo,
  getReviewEfficiencyDataForPRsGraphQL,
  getReworkDataForPRsGraphQL,
  trackToProductionMergeGraphQL,
} from './graphql';
