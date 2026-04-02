/**
 * 型定義モジュール - エントリーポイント
 *
 * プロジェクト全体で使用する型定義を提供するモジュール群の統合エクスポート。
 *
 * 構成:
 * - github.ts: GitHub APIエンティティ（Repository, PR, Deployment等）
 * - metrics.ts: DevOps指標（CycleTime, ReworkRate, DORA等）
 * - config.ts: 設定（GitHubAuthConfig, ProjectGroup, Config）
 * - api.ts: API関連（ApiResponse）
 */

// API関連の型
export type { ApiResponse } from './api';
// 設定関連の型
export type { Config, GitHubAppConfig, GitHubAuthConfig, ProjectGroup } from './config';
// ダッシュボード関連の型
export type {
  DashboardData,
  HealthStatus,
  HealthThresholds,
  ProjectLatestSummary,
  RepositoryLatestMetrics,
  TrendSummary,
  WeeklyTrend,
} from './dashboard';
export { DEFAULT_HEALTH_THRESHOLDS } from './dashboard';
// GitHub関連の型
export type {
  GitHubDeployment,
  GitHubIncident,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepository,
  GitHubWorkflowRun,
  IssueCodingTime,
  IssueCycleTime,
  PRChainItem,
  PRCycleTime,
} from './github';
// GitHub API レスポンス型
export type {
  GitHubCommitResponse,
  GitHubDeploymentResponse,
  GitHubDeploymentStatusResponse,
  GitHubEventResponse,
  GitHubIssueResponse,
  GitHubPRResponse,
  GitHubReviewResponse,
  GitHubTimelineCrossReferenceEvent,
  GitHubTimelineEventResponse,
  GitHubWorkflowRunResponse,
  GitHubWorkflowRunsResponse,
} from './github-api';
// DevOps指標の型
export type {
  AggregatedMetrics,
  CodingTimeMetrics,
  CycleTimeMetrics,
  // DORA指標
  DevOpsMetrics,
  // コーディング時間
  IssueCodingTimeDetail,
  // サイクルタイム
  IssueCycleTimeDetail,
  MetricsSummary,
  // PR Cycle Time
  PRCycleTimeDetail,
  PRCycleTimeMetrics,
  // レビュー効率
  PRReviewData,
  // 手戻り率
  PRReworkData,
  // PRサイズ
  PRSizeData,
  PRSizeMetrics,
  ReviewEfficiencyMetrics,
  ReworkRateMetrics,
} from './metrics';
