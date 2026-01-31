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

// GitHub関連の型
export type {
  GitHubRepository,
  GitHubPullRequest,
  GitHubDeployment,
  GitHubWorkflowRun,
  GitHubIncident,
  GitHubIssue,
  PRChainItem,
  IssueCycleTime,
  IssueCodingTime,
} from "./github";

// DevOps指標の型
export type {
  // サイクルタイム
  IssueCycleTimeDetail,
  CycleTimeMetrics,
  // コーディング時間
  IssueCodingTimeDetail,
  CodingTimeMetrics,
  // 手戻り率
  PRReworkData,
  ReworkRateMetrics,
  // レビュー効率
  PRReviewData,
  ReviewEfficiencyMetrics,
  // PRサイズ
  PRSizeData,
  PRSizeMetrics,
  // DORA指標
  DevOpsMetrics,
  AggregatedMetrics,
  MetricsSummary,
} from "./metrics";

// 設定関連の型
export type {
  GitHubAppConfig,
  GitHubAuthConfig,
  ProjectGroup,
  Config,
} from "./config";

// API関連の型
export type { ApiResponse } from "./api";
