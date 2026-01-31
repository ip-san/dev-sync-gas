/**
 * GitHub GraphQL API レスポンス型定義
 *
 * GraphQLクエリのレスポンスをTypeScriptの型として定義。
 */

import type { PageInfo } from './client';

// =============================================================================
// 共通型
// =============================================================================

/**
 * GraphQL Node基底型
 */
export interface GraphQLNode {
  id: string;
}

/**
 * ページネーション付きコネクション
 */
export interface Connection<T> {
  pageInfo: PageInfo;
  nodes: T[];
}

/**
 * Actor（ユーザー/Bot）
 */
export interface Actor {
  login: string;
}

// =============================================================================
// Pull Request 型
// =============================================================================

/**
 * Pull Request状態
 */
export type PullRequestState = 'OPEN' | 'CLOSED' | 'MERGED';

/**
 * レビュー状態
 */
export type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';

/**
 * GraphQL Pull Requestノード
 */
export interface GraphQLPullRequest extends GraphQLNode {
  number: number;
  title: string;
  state: PullRequestState;
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  author: Actor | null;
  baseRefName: string;
  headRefName: string;
  mergeCommit: { oid: string } | null;
  additions: number;
  deletions: number;
  changedFiles: number;
}

/**
 * レビューノード
 */
export interface GraphQLReview {
  state: ReviewState;
  submittedAt: string | null;
  author: Actor | null;
}

/**
 * コミットノード
 */
export interface GraphQLCommit {
  commit: {
    oid: string;
    committedDate: string;
    authoredDate?: string;
  };
}

/**
 * タイムラインイベント
 */
export interface GraphQLTimelineEvent {
  __typename: string;
  createdAt?: string;
}

/**
 * PR詳細（レビュー、コミット、タイムライン含む）
 */
export interface GraphQLPullRequestDetail extends GraphQLPullRequest {
  reviews: Connection<GraphQLReview>;
  commits: Connection<GraphQLCommit>;
  timelineItems: Connection<GraphQLTimelineEvent>;
}

/**
 * PR一覧クエリレスポンス
 */
export interface PullRequestsQueryResponse {
  repository: {
    pullRequests: Connection<GraphQLPullRequest>;
  } | null;
}

/**
 * PR詳細クエリレスポンス
 */
export interface PullRequestDetailQueryResponse {
  repository: {
    pullRequest: GraphQLPullRequestDetail | null;
  } | null;
}

// =============================================================================
// Deployment 型
// =============================================================================

/**
 * デプロイメント状態
 */
export type DeploymentState =
  | 'ABANDONED'
  | 'ACTIVE'
  | 'DESTROYED'
  | 'ERROR'
  | 'FAILURE'
  | 'INACTIVE'
  | 'IN_PROGRESS'
  | 'PENDING'
  | 'QUEUED'
  | 'SUCCESS'
  | 'WAITING';

/**
 * デプロイメントステータス状態
 */
export type DeploymentStatusState =
  | 'ERROR'
  | 'FAILURE'
  | 'IN_PROGRESS'
  | 'INACTIVE'
  | 'PENDING'
  | 'QUEUED'
  | 'SUCCESS'
  | 'WAITING';

/**
 * GraphQL Deploymentノード
 */
export interface GraphQLDeployment extends GraphQLNode {
  environment: string;
  createdAt: string;
  updatedAt: string;
  commit: { oid: string } | null;
  state: DeploymentState;
  latestStatus: {
    state: DeploymentStatusState;
    createdAt: string;
  } | null;
}

/**
 * デプロイメント一覧クエリレスポンス
 */
export interface DeploymentsQueryResponse {
  repository: {
    deployments: Connection<GraphQLDeployment>;
  } | null;
}

// =============================================================================
// Issue 型
// =============================================================================

/**
 * Issue状態
 */
export type IssueState = 'OPEN' | 'CLOSED';

/**
 * ラベルノード
 */
export interface GraphQLLabel {
  name: string;
}

/**
 * GraphQL Issueノード
 */
export interface GraphQLIssue extends GraphQLNode {
  number: number;
  title: string;
  state: IssueState;
  createdAt: string;
  closedAt: string | null;
  labels: Connection<GraphQLLabel>;
}

/**
 * クロスリファレンスイベント（リンクPR取得用）
 */
export interface CrossReferencedEvent {
  source: {
    number?: number;
    createdAt?: string;
    mergedAt?: string | null;
    baseRefName?: string;
    headRefName?: string;
    mergeCommit?: { oid: string } | null;
    repository?: { nameWithOwner: string };
  } | null;
}

/**
 * Issue（リンクPR含む）
 */
export interface GraphQLIssueWithLinkedPRs extends GraphQLIssue {
  timelineItems: Connection<CrossReferencedEvent>;
}

/**
 * Issue一覧クエリレスポンス
 */
export interface IssuesQueryResponse {
  repository: {
    issues: Connection<GraphQLIssue>;
  } | null;
}

/**
 * Issue詳細（リンクPR含む）クエリレスポンス
 */
export interface IssueWithLinkedPRsQueryResponse {
  repository: {
    issue: GraphQLIssueWithLinkedPRs | null;
  } | null;
}

// =============================================================================
// 複合クエリ型
// =============================================================================

/**
 * リポジトリメトリクス一括取得レスポンス
 */
export interface RepositoryMetricsQueryResponse {
  repository: {
    pullRequests: Connection<GraphQLPullRequest>;
    deployments: Connection<GraphQLDeployment>;
  } | null;
  rateLimit: {
    limit: number;
    remaining: number;
    resetAt: string;
    cost: number;
  };
}

/**
 * コミット関連PR検索レスポンス
 */
export interface CommitAssociatedPRsQueryResponse {
  repository: {
    object: {
      associatedPullRequests: Connection<GraphQLPullRequest>;
    } | null;
  } | null;
}
