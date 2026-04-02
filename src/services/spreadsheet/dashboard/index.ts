/**
 * Dashboard公開API
 *
 * Dashboardシート操作の全エクスポート
 * プロジェクト全体を俯瞰するダッシュボードシートを生成。
 * - 最新状況: 全リポジトリ × 全指標のマトリクス
 * - トレンド: 週次の推移
 */

export { enrichWithExtendedMetrics, extractLatestMetricsByRepository } from './metrics';
export { writeDashboard } from './sheet';
export { determineHealthStatus } from './status';
export { writeDashboardTrends } from './trendSheet';
export { calculateWeeklyTrends } from './trends';
