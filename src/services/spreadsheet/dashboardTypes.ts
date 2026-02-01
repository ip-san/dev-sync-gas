/**
 * Dashboard共通型定義
 *
 * dashboard.ts と charts.ts の循環依存を防ぐため、
 * 共有される型定義を独立したファイルとして切り出し
 */

/**
 * 週次トレンドデータ
 */
export interface WeeklyTrendData {
  week: string; // YYYY-Www形式
  totalDeployments: number;
  avgLeadTimeHours: number | null;
  avgChangeFailureRate: number | null;
  avgCycleTimeHours: number | null;
}

/**
 * リポジトリ別最新データ（Dashboard表示用）
 */
export interface RepositoryLatestData {
  repository: string;
  latestDate: string; // 最新データ日付
  deploymentFrequency: string;
  leadTimeHours: number | null;
  changeFailureRate: number | null;
  mttrHours: number | null;
  cycleTimeHours: number | null;
  codingTimeHours: number | null;
  timeToFirstReviewHours: number | null;
  reviewDurationHours: number | null;
  avgLinesOfCode: number | null;
  avgAdditionalCommits: number | null;
  avgForcePushCount: number | null;
}
