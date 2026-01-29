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
  /** 追加行数 */
  additions?: number;
  /** 削除行数 */
  deletions?: number;
  /** 変更ファイル数 */
  changedFiles?: number;
  /** ベースブランチ名（マージ先） */
  baseBranch?: string;
  /** ヘッドブランチ名（マージ元） */
  headBranch?: string;
  /** マージコミットSHA */
  mergeCommitSha?: string | null;
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

/**
 * GitHub Issue（サイクルタイム計測用）
 * Issue作成日を着手日として使用
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
  /** Issueに付与されたラベル一覧 */
  labels: string[];
  repository: string;
}

/**
 * PRチェーンの各アイテム
 * feature→main→staging→production の追跡に使用
 */
export interface PRChainItem {
  prNumber: number;
  baseBranch: string;
  headBranch: string;
  mergedAt: string | null;
}

/**
 * Issue→productionマージのサイクルタイムデータ
 */
export interface GitHubIssueCycleTime {
  issueNumber: number;
  issueTitle: string;
  repository: string;
  /** Issue作成日時（着手日） */
  issueCreatedAt: string;
  /** productionブランチへのマージ日時（完了日） */
  productionMergedAt: string | null;
  /** サイクルタイム（時間）- productionマージがない場合はnull */
  cycleTimeHours: number | null;
  /** 追跡されたPRチェーン */
  prChain: PRChainItem[];
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
  /** GitHub PR URL - コーディング時間計算に使用 */
  prUrl: string | null;
  assignee: string | null;
  /** 満足度スコア（1〜5の★評価） - 開発者満足度計測に使用 */
  satisfactionScore: number | null;
}

/**
 * サイクルタイム指標
 * Issue作成（GitHub）〜productionマージ（GitHub）の時間を測定
 */
export interface CycleTimeMetrics {
  /** 計測期間 */
  period: string;
  /** 完了Issue数 */
  completedTaskCount: number;
  /** 平均サイクルタイム（時間） */
  avgCycleTimeHours: number | null;
  /** 中央値サイクルタイム（時間） */
  medianCycleTimeHours: number | null;
  /** 最小サイクルタイム（時間） */
  minCycleTimeHours: number | null;
  /** 最大サイクルタイム（時間） */
  maxCycleTimeHours: number | null;
  /** 各Issueのサイクルタイム詳細 */
  issueDetails: IssueCycleTimeDetail[];
}

/**
 * 個別Issueのサイクルタイム
 */
export interface IssueCycleTimeDetail {
  issueNumber: number;
  title: string;
  repository: string;
  /** Issue作成日時（着手日） */
  issueCreatedAt: string;
  /** productionマージ日時（完了日） */
  productionMergedAt: string;
  /** サイクルタイム（時間） */
  cycleTimeHours: number;
  /** PRチェーン（例: "#1→#2→#3"） */
  prChainSummary: string;
}

/**
 * コーディング時間指標
 * 着手（Notion進行中）〜 PR作成（GitHub）の時間を測定
 */
export interface CodingTimeMetrics {
  /** 計測期間 */
  period: string;
  /** PR作成済みタスク数 */
  taskCount: number;
  /** 平均コーディング時間（時間） */
  avgCodingTimeHours: number | null;
  /** 中央値コーディング時間（時間） */
  medianCodingTimeHours: number | null;
  /** 最小コーディング時間（時間） */
  minCodingTimeHours: number | null;
  /** 最大コーディング時間（時間） */
  maxCodingTimeHours: number | null;
  /** 各タスクのコーディング時間詳細 */
  taskDetails: TaskCodingTime[];
}

/**
 * 個別タスクのコーディング時間
 */
export interface TaskCodingTime {
  taskId: string;
  title: string;
  /** Notion進行中時刻 */
  startedAt: string;
  /** GitHub PR作成時刻 */
  prCreatedAt: string;
  /** PR URL */
  prUrl: string;
  /** コーディング時間（時間） */
  codingTimeHours: number;
}

/**
 * 手戻り率（Rework Rate）指標
 * PR作成後の追加コミット数とForce Push回数を測定
 */
export interface ReworkRateMetrics {
  /** 計測期間 */
  period: string;
  /** 計測対象PR数 */
  prCount: number;
  /** 追加コミット統計 */
  additionalCommits: {
    /** 合計追加コミット数 */
    total: number;
    /** PRあたりの平均追加コミット数 */
    avgPerPr: number | null;
    /** 中央値 */
    median: number | null;
    /** 最大値 */
    max: number | null;
  };
  /** Force Push統計 */
  forcePushes: {
    /** 合計Force Push回数 */
    total: number;
    /** PRあたりの平均Force Push回数 */
    avgPerPr: number | null;
    /** Force Pushが発生したPR数 */
    prsWithForcePush: number;
    /** Force Push発生率（%） */
    forcePushRate: number | null;
  };
  /** 各PRの詳細 */
  prDetails: PRReworkData[];
}

/**
 * 個別PRの手戻りデータ
 */
export interface PRReworkData {
  /** PR番号 */
  prNumber: number;
  /** PRタイトル */
  title: string;
  /** リポジトリ名 */
  repository: string;
  /** PR作成時刻 */
  createdAt: string;
  /** マージ時刻（未マージの場合null） */
  mergedAt: string | null;
  /** PR作成後の追加コミット数 */
  additionalCommits: number;
  /** Force Push回数 */
  forcePushCount: number;
  /** 総コミット数 */
  totalCommits: number;
}

/**
 * レビュー効率（Review Efficiency）指標
 * PRの各フェーズでの滞留時間を測定
 * 長い滞留時間 = コードが難解な可能性
 */
export interface ReviewEfficiencyMetrics {
  /** 計測期間 */
  period: string;
  /** 計測対象PR数 */
  prCount: number;
  /** レビュー待ち時間（Ready for Review → 最初のレビュー） */
  timeToFirstReview: {
    /** 平均時間（時間） */
    avgHours: number | null;
    /** 中央値（時間） */
    medianHours: number | null;
    /** 最小値（時間） */
    minHours: number | null;
    /** 最大値（時間） */
    maxHours: number | null;
  };
  /** レビュー時間（最初のレビュー → 承認） */
  reviewDuration: {
    /** 平均時間（時間） */
    avgHours: number | null;
    /** 中央値（時間） */
    medianHours: number | null;
    /** 最小値（時間） */
    minHours: number | null;
    /** 最大値（時間） */
    maxHours: number | null;
  };
  /** マージ待ち時間（承認 → マージ） */
  timeToMerge: {
    /** 平均時間（時間） */
    avgHours: number | null;
    /** 中央値（時間） */
    medianHours: number | null;
    /** 最小値（時間） */
    minHours: number | null;
    /** 最大値（時間） */
    maxHours: number | null;
  };
  /** 全体時間（Ready for Review → マージ） */
  totalTime: {
    /** 平均時間（時間） */
    avgHours: number | null;
    /** 中央値（時間） */
    medianHours: number | null;
    /** 最小値（時間） */
    minHours: number | null;
    /** 最大値（時間） */
    maxHours: number | null;
  };
  /** 各PRの詳細 */
  prDetails: PRReviewData[];
}

/**
 * 個別PRのレビューデータ
 */
export interface PRReviewData {
  /** PR番号 */
  prNumber: number;
  /** PRタイトル */
  title: string;
  /** リポジトリ名 */
  repository: string;
  /** PR作成時刻 */
  createdAt: string;
  /** Ready for Review時刻（ドラフト解除時刻、ドラフトでない場合はPR作成時刻） */
  readyForReviewAt: string;
  /** 最初のレビュー時刻 */
  firstReviewAt: string | null;
  /** 承認時刻 */
  approvedAt: string | null;
  /** マージ時刻 */
  mergedAt: string | null;
  /** レビュー待ち時間（時間） */
  timeToFirstReviewHours: number | null;
  /** レビュー時間（時間） */
  reviewDurationHours: number | null;
  /** マージ待ち時間（時間） */
  timeToMergeHours: number | null;
  /** 全体時間（時間） */
  totalTimeHours: number | null;
}

/**
 * PRサイズ（PR Size）指標
 * PRの変更行数と変更ファイル数を測定
 * 小さいPRほどレビューしやすく、マージが早い傾向がある
 */
export interface PRSizeMetrics {
  /** 計測期間 */
  period: string;
  /** 計測対象PR数 */
  prCount: number;
  /** 変更行数（additions + deletions）の統計 */
  linesOfCode: {
    /** 合計 */
    total: number;
    /** 平均 */
    avg: number | null;
    /** 中央値 */
    median: number | null;
    /** 最小値 */
    min: number | null;
    /** 最大値 */
    max: number | null;
  };
  /** 変更ファイル数の統計 */
  filesChanged: {
    /** 合計 */
    total: number;
    /** 平均 */
    avg: number | null;
    /** 中央値 */
    median: number | null;
    /** 最小値 */
    min: number | null;
    /** 最大値 */
    max: number | null;
  };
  /** 各PRの詳細 */
  prDetails: PRSizeData[];
}

/**
 * 個別PRのサイズデータ
 */
export interface PRSizeData {
  /** PR番号 */
  prNumber: number;
  /** PRタイトル */
  title: string;
  /** リポジトリ名 */
  repository: string;
  /** PR作成時刻 */
  createdAt: string;
  /** マージ時刻 */
  mergedAt: string | null;
  /** 追加行数 */
  additions: number;
  /** 削除行数 */
  deletions: number;
  /** 変更行数（additions + deletions） */
  linesOfCode: number;
  /** 変更ファイル数 */
  filesChanged: number;
}

/**
 * 開発者満足度（Developer Satisfaction）指標
 * Notionタスク完了時に入力される満足度スコア（★1〜5）を集計
 * SPACEフレームワークの「Satisfaction」ディメンションに対応
 */
export interface DeveloperSatisfactionMetrics {
  /** 計測期間 */
  period: string;
  /** 評価済みタスク数 */
  taskCount: number;
  /** 満足度スコアの統計 */
  satisfaction: {
    /** 平均値（1〜5） */
    avg: number | null;
    /** 中央値 */
    median: number | null;
    /** 最小値 */
    min: number | null;
    /** 最大値 */
    max: number | null;
    /** 各評価の分布 */
    distribution: {
      /** ★1の件数 */
      star1: number;
      /** ★2の件数 */
      star2: number;
      /** ★3の件数 */
      star3: number;
      /** ★4の件数 */
      star4: number;
      /** ★5の件数 */
      star5: number;
    };
  };
  /** 各タスクの詳細 */
  taskDetails: TaskSatisfactionData[];
}

/**
 * 個別タスクの満足度データ
 */
export interface TaskSatisfactionData {
  /** タスクID */
  taskId: string;
  /** タスクタイトル */
  title: string;
  /** 担当者 */
  assignee: string | null;
  /** 完了日 */
  completedAt: string;
  /** 満足度スコア（1〜5） */
  satisfactionScore: number;
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

// GitHub Apps認証用の型定義
export interface GitHubAppConfig {
  /** GitHub App ID */
  appId: string;
  /** GitHub App Private Key（PEM形式） */
  privateKey: string;
  /** Installation ID */
  installationId: string;
}

/**
 * GitHub認証設定
 * - PAT認証: tokenのみ設定
 * - GitHub Apps認証: appConfigを設定（tokenは自動取得される）
 */
export interface GitHubAuthConfig {
  /** Personal Access Token（PAT認証時に使用） */
  token?: string;
  /** GitHub Apps設定（Apps認証時に使用） */
  appConfig?: GitHubAppConfig;
  /** リポジトリ一覧 */
  repositories: GitHubRepository[];
}

/**
 * Notionプロパティ名のカスタム設定
 * ユーザーのNotionデータベースに合わせてプロパティ名を変更可能
 */
export interface NotionPropertyNames {
  /** 着手日プロパティ名（デフォルト: "Date Started"） */
  startedDate: string;
  /** 完了日プロパティ名（デフォルト: "Date Done"） */
  completedDate: string;
  /** 満足度スコアプロパティ名（デフォルト: "Satisfaction"） */
  satisfaction: string;
  /** PR URLプロパティ名（デフォルト: "PR URL"） */
  prUrl: string;
}

/** デフォルトのNotionプロパティ名 */
export const DEFAULT_NOTION_PROPERTY_NAMES: NotionPropertyNames = {
  startedDate: "Date Started",
  completedDate: "Date Done",
  satisfaction: "Satisfaction",
  prUrl: "PR URL",
};

// 設定の型定義
export interface Config {
  github: GitHubAuthConfig;
  notion: {
    token: string;
    databaseId: string;
    /** プロパティ名のカスタム設定（オプション） */
    propertyNames?: Partial<NotionPropertyNames>;
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
