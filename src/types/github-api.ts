/**
 * GitHub REST API レスポンスの型定義
 *
 * GitHub APIから返されるJSONの生のレスポンス型を定義。
 * 内部で GitHubPullRequest などのアプリケーション型に変換する。
 */

/**
 * GitHub API: PRレスポンス
 */
export interface GitHubPRResponse {
  id: number;
  number: number;
  title: string;
  state: string;
  created_at: string;
  closed_at: string | null;
  merged_at: string | null;
  user: { login: string } | null;
  base?: { ref: string };
  head?: { ref: string };
  merge_commit_sha?: string | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

/**
 * GitHub API: コミットレスポンス
 */
export interface GitHubCommitResponse {
  sha: string;
  commit: {
    author?: { date: string };
    committer?: { date: string };
  };
}

/**
 * GitHub API: タイムラインイベントレスポンス
 */
export interface GitHubTimelineEventResponse {
  event: string;
  created_at?: string;
}

/**
 * GitHub API: レビューレスポンス
 */
export interface GitHubReviewResponse {
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';
  submitted_at: string;
  user: { login: string } | null;
}

/**
 * GitHub API: Issueレスポンス
 */
export interface GitHubIssueResponse {
  id: number;
  number: number;
  title: string;
  state: string;
  created_at: string;
  closed_at: string | null;
  user: { login: string } | null;
  labels: Array<{ name: string }>;
  pull_request?: object; // PRの場合に存在
}

/**
 * GitHub API: Timeline cross-reference イベント
 */
export interface GitHubTimelineCrossReferenceEvent {
  event: 'cross-referenced';
  source?: {
    issue?: {
      number: number;
      pull_request?: object;
      repository?: { full_name: string };
    };
  };
}

/**
 * GitHub API: Deploymentレスポンス
 */
export interface GitHubDeploymentResponse {
  id: number;
  sha: string;
  ref: string;
  environment: string;
  created_at: string;
  updated_at: string;
}

/**
 * GitHub API: Deployment Statusレスポンス
 */
export interface GitHubDeploymentStatusResponse {
  id: number;
  state: string;
  created_at: string;
}

/**
 * GitHub API: Workflow Runレスポンス
 */
export interface GitHubWorkflowRunResponse {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  run_started_at: string;
  html_url: string;
  head_sha: string;
  head_branch: string;
}

/**
 * GitHub API: Workflow Runs リストレスポンス
 */
export interface GitHubWorkflowRunsResponse {
  total_count: number;
  workflow_runs: GitHubWorkflowRunResponse[];
}

/**
 * GitHub API: Eventレスポンス
 */
export interface GitHubEventResponse {
  type: string;
  created_at: string;
  payload?: {
    action?: string;
    issue?: GitHubIssueResponse;
    pull_request?: GitHubPRResponse;
  };
}
