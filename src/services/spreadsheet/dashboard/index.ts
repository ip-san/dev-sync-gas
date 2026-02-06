/**
 * Dashboard公開API
 *
 * Dashboardシート操作の全エクスポート
 * プロジェクト全体を俯瞰するダッシュボードシートを生成。
 * - 最新状況: 全リポジトリ × 全指標のマトリクス
 * - トレンド: 週次の推移
 */

export { determineHealthStatus } from './status';
export { extractLatestMetricsByRepository, enrichWithExtendedMetrics } from './metrics';
export { calculateWeeklyTrends } from './trends';
export { writeDashboard } from './sheet';
export { writeDashboardTrends } from './trendSheet';
