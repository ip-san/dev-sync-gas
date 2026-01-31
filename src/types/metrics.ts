/**
 * DevOps指標の型定義
 *
 * DORA Four Key Metricsおよび拡張指標の型定義。
 * サイクルタイム、コーディング時間、手戻り率、レビュー効率、PRサイズ等を定義。
 */

// =============================================================================
// サイクルタイム指標
// =============================================================================

/**
 * 個別Issueのサイクルタイム詳細
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

// =============================================================================
// コーディング時間指標
// =============================================================================

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
 * Issue作成〜PR作成の時間を測定
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

// =============================================================================
// 手戻り率指標
// =============================================================================

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

// =============================================================================
// レビュー効率指標
// =============================================================================

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
 * 時間統計の共通構造
 */
interface TimeStatistics {
  /** 平均時間（時間） */
  avgHours: number | null;
  /** 中央値（時間） */
  medianHours: number | null;
  /** 最小値（時間） */
  minHours: number | null;
  /** 最大値（時間） */
  maxHours: number | null;
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
  timeToFirstReview: TimeStatistics;
  /** レビュー時間（最初のレビュー → 承認） */
  reviewDuration: TimeStatistics;
  /** マージ待ち時間（承認 → マージ） */
  timeToMerge: TimeStatistics;
  /** 全体時間（Ready for Review → マージ） */
  totalTime: TimeStatistics;
  /** 各PRの詳細 */
  prDetails: PRReviewData[];
}

// =============================================================================
// PRサイズ指標
// =============================================================================

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
 * 数値統計の共通構造
 */
interface NumericStatistics {
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
  linesOfCode: NumericStatistics;
  /** 変更ファイル数の統計 */
  filesChanged: NumericStatistics;
  /** 各PRの詳細 */
  prDetails: PRSizeData[];
}

// =============================================================================
// DORA指標
// =============================================================================

/**
 * DevOps指標（DORA metrics）
 * Deployment Frequency, Lead Time, Change Failure Rate, MTTR
 */
export interface DevOpsMetrics {
  date: string;
  repository: string;
  deploymentCount: number;
  deploymentFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
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

/**
 * 集約されたメトリクス
 */
export interface AggregatedMetrics {
  period: string;
  repositories: string[];
  metrics: DevOpsMetrics[];
  summary: MetricsSummary;
}

/**
 * メトリクスのサマリー
 */
export interface MetricsSummary {
  avgDeploymentFrequency: number;
  avgLeadTimeHours: number;
  avgChangeFailureRate: number;
  avgMttrHours: number | null;
}
