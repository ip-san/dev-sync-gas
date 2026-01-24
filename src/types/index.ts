// GitHub関連の型定義
export interface GitHubRepository {
  owner: string;
  name: string;
  fullName: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  author: string;
  repository: string;
}

export interface GitHubDeployment {
  id: number;
  sha: string;
  environment: string;
  createdAt: string;
  updatedAt: string;
  status: "success" | "failure" | "error" | "inactive" | "in_progress" | "queued" | "pending" | null;
  repository: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  repository: string;
}

/**
 * GitHub Issueベースのインシデント記録
 * MTTR（真の復旧時間）計測に使用
 */
export interface GitHubIncident {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
  /** インシデントに付与されたラベル一覧 */
  labels: string[];
  repository: string;
}

// Notion関連の型定義
export interface NotionTask {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  /** 着手日（Date Started） - サイクルタイム計算の開始点 */
  startedAt: string | null;
  /** 完了日（Date Done） - サイクルタイム計算の終了点 */
  completedAt: string | null;
  assignee: string | null;
}

/**
 * サイクルタイム指標
 * 着手（Notion）〜完了（Notion）の時間を測定
 */
export interface CycleTimeMetrics {
  /** 計測期間 */
  period: string;
  /** 完了タスク数 */
  completedTaskCount: number;
  /** 平均サイクルタイム（時間） */
  avgCycleTimeHours: number | null;
  /** 中央値サイクルタイム（時間） */
  medianCycleTimeHours: number | null;
  /** 最小サイクルタイム（時間） */
  minCycleTimeHours: number | null;
  /** 最大サイクルタイム（時間） */
  maxCycleTimeHours: number | null;
  /** 各タスクのサイクルタイム詳細 */
  taskDetails: TaskCycleTime[];
}

/**
 * 個別タスクのサイクルタイム
 */
export interface TaskCycleTime {
  taskId: string;
  title: string;
  startedAt: string;
  completedAt: string;
  cycleTimeHours: number;
}

// DevOps指標の型定義（DORA metrics）
export interface DevOpsMetrics {
  date: string;
  repository: string;
  deploymentCount: number;
  deploymentFrequency: "daily" | "weekly" | "monthly" | "yearly";
  leadTimeForChangesHours: number;
  /**
   * Lead Time測定の内訳
   * - mergeToDeployCount: マージ→デプロイで計測されたPR数
   * - createToMergeCount: PR作成→マージで計測されたPR数（フォールバック）
   */
  leadTimeMeasurement?: {
    mergeToDeployCount: number;
    createToMergeCount: number;
  };
  totalDeployments: number;
  failedDeployments: number;
  changeFailureRate: number;
  /** デプロイ失敗からの復旧時間（CI/CDベース、近似値） */
  meanTimeToRecoveryHours: number | null;
  /**
   * インシデントベースの真のMTTR（GitHub Issuesから計測）
   * - incidentCount: 期間内のインシデント数
   * - mttrHours: 平均復旧時間（時間）
   */
  incidentMetrics?: {
    incidentCount: number;
    openIncidents: number;
    mttrHours: number | null;
  };
}

export interface AggregatedMetrics {
  period: string;
  repositories: string[];
  metrics: DevOpsMetrics[];
  summary: MetricsSummary;
}

export interface MetricsSummary {
  avgDeploymentFrequency: number;
  avgLeadTimeHours: number;
  avgChangeFailureRate: number;
  avgMttrHours: number | null;
}

// 設定の型定義
export interface Config {
  github: {
    token: string;
    repositories: GitHubRepository[];
  };
  notion: {
    token: string;
    databaseId: string;
  };
  spreadsheet: {
    id: string;
    sheetName: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
