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
export interface IssueCycleTime {
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

/**
 * サイクルタイム指標
 * Issue作成〜productionマージの時間を測定
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
 * Issue→PR作成のコーディングタイムデータ
 * Issue作成日時からPR作成日時までの時間を計測
 */
export interface IssueCodingTime {
  issueNumber: number;
  issueTitle: string;
  repository: string;
  /** Issue作成日時（着手日） */
  issueCreatedAt: string;
  /** PR作成日時（コーディング完了日） */
  prCreatedAt: string | null;
  /** PR番号 */
  prNumber: number | null;
  /** コーディングタイム（時間）- PRがない場合はnull */
  codingTimeHours: number | null;
}

/**
 * 個別Issueのコーディングタイム詳細
 */
export interface IssueCodingTimeDetail {
  issueNumber: number;
  title: string;
  repository: string;
  /** Issue作成日時（着手日） */
  issueCreatedAt: string;
  /** PR作成日時（コーディング完了日） */
  prCreatedAt: string;
  /** PR番号 */
  prNumber: number;
  /** コーディングタイム（時間） */
  codingTimeHours: number;
}

/**
 * コーディング時間指標
 * Issue作成〜 PR作成の時間を測定
 */
export interface CodingTimeMetrics {
  /** 計測期間 */
  period: string;
  /** PR作成済みIssue数 */
  issueCount: number;
  /** 平均コーディング時間（時間） */
  avgCodingTimeHours: number | null;
  /** 中央値コーディング時間（時間） */
  medianCodingTimeHours: number | null;
  /** 最小コーディング時間（時間） */
  minCodingTimeHours: number | null;
  /** 最大コーディング時間（時間） */
  maxCodingTimeHours: number | null;
  /** 各Issueのコーディング時間詳細 */
  issueDetails: IssueCodingTimeDetail[];
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
  /** リポジトリ一覧（後方互換性のため維持、projectsが優先される） */
  repositories: GitHubRepository[];
}

/**
 * プロジェクトグループ
 * スプレッドシートとリポジトリ群をグループ化
 */
export interface ProjectGroup {
  /** グループ名（識別用） */
  name: string;
  /** 出力先スプレッドシートID */
  spreadsheetId: string;
  /** シート名（デフォルト: "DevOps Metrics"） */
  sheetName: string;
  /** このグループに属するリポジトリ一覧 */
  repositories: GitHubRepository[];
}

// 設定の型定義
export interface Config {
  github: GitHubAuthConfig;
  /** 単一スプレッドシート設定（後方互換性のため維持） */
  spreadsheet: {
    id: string;
    sheetName: string;
  };
  /** プロジェクトグループ一覧（複数スプレッドシート対応） */
  projects?: ProjectGroup[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
