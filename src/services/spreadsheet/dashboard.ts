/**
 * Dashboardシート操作
 *
 * プロジェクト全体を俯瞰するダッシュボードシートを生成。
 * - 最新状況: 全リポジトリ × 全指標のマトリクス
 * - トレンド: 週次の推移
 */

import type { DevOpsMetrics, HealthStatus } from '../../types';
import type { Sheet, Spreadsheet } from '../../interfaces';
import { getContainer } from '../../container';
import { DEFAULT_HEALTH_THRESHOLDS } from '../../types/dashboard';
import {
  autoResizeColumns,
  openSpreadsheet,
  styleHeaderRow,
  applyDataBorders,
  styleSummaryRow,
} from './helpers';
import { DASHBOARD_SCHEMA, getHeadersFromSchema } from '../../schemas';
import { evaluateMetric, selectWorstStatus } from '../../utils/healthStatus';
import { getExtendedMetricSheetName } from './extendedMetricsRepositorySheet';
import { SpreadsheetError, ErrorCode, AppError } from '../../utils/errors';

const DASHBOARD_HEADERS = getHeadersFromSchema(DASHBOARD_SCHEMA);

/**
 * 健全性ステータスを判定
 */
export function determineHealthStatus(
  leadTimeHours: number | null,
  changeFailureRate: number | null,
  cycleTimeHours: number | null,
  timeToFirstReviewHours: number | null
): HealthStatus {
  const thresholds = DEFAULT_HEALTH_THRESHOLDS;

  // 各指標を評価
  const statuses = [
    evaluateMetric(leadTimeHours, thresholds.leadTime),
    evaluateMetric(changeFailureRate, thresholds.changeFailureRate),
    evaluateMetric(cycleTimeHours, thresholds.cycleTime),
    evaluateMetric(timeToFirstReviewHours, thresholds.timeToFirstReview),
  ];

  // 最も悪いステータスを選択
  return selectWorstStatus(statuses);
}

/**
 * ステータスを表示用文字列に変換（絵文字付き）
 */
function formatStatus(status: HealthStatus): string {
  switch (status) {
    case 'good':
      return '🟢 良好';
    case 'warning':
      return '🟡 要注意';
    case 'critical':
      return '🔴 要対応';
  }
}

/**
 * リポジトリ別の最新メトリクスを集計
 */
export interface RepositoryLatestData {
  repository: string;
  latestDate: string;
  deploymentFrequency: string;
  leadTimeHours: number | null;
  changeFailureRate: number | null;
  mttrHours: number | null;
  // 拡張指標
  cycleTimeHours: number | null;
  codingTimeHours: number | null;
  timeToFirstReviewHours: number | null;
  reviewDurationHours: number | null;
  avgLinesOfCode: number | null;
  avgAdditionalCommits: number | null;
  avgForcePushCount: number | null;
}

/**
 * メトリクスから各リポジトリの最新データを抽出
 */
export function extractLatestMetricsByRepository(
  metrics: DevOpsMetrics[]
): Map<string, RepositoryLatestData> {
  const latestByRepo = new Map<string, RepositoryLatestData>();

  for (const metric of metrics) {
    const existing = latestByRepo.get(metric.repository);

    if (!existing || metric.date > existing.latestDate) {
      latestByRepo.set(metric.repository, {
        repository: metric.repository,
        latestDate: metric.date,
        deploymentFrequency: metric.deploymentFrequency,
        leadTimeHours: metric.leadTimeForChangesHours,
        changeFailureRate: metric.changeFailureRate,
        mttrHours: metric.meanTimeToRecoveryHours,
        // 拡張指標は後で統合
        cycleTimeHours: null,
        codingTimeHours: null,
        timeToFirstReviewHours: null,
        reviewDurationHours: null,
        avgLinesOfCode: null,
        avgAdditionalCommits: null,
        avgForcePushCount: null,
      });
    }
  }

  return latestByRepo;
}

/**
 * リポジトリ別シートから数値列の平均を計算
 */
function calculateAverageFromSheet(
  spreadsheet: Spreadsheet,
  sheetName: string,
  columnIndex: number
): number | null {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    return null;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    // ヘッダーのみまたは空
    return null;
  }

  const data = sheet.getRange(2, columnIndex, lastRow - 1, 1).getValues();
  const validValues: number[] = [];

  for (const row of data) {
    const value = row[0];
    if (typeof value === 'number' && !isNaN(value) && value !== null) {
      validValues.push(value);
    }
  }

  if (validValues.length === 0) {
    return null;
  }

  return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
}

/**
 * リポジトリの拡張指標を読み取って統合
 */
export function enrichWithExtendedMetrics(
  spreadsheetId: string,
  latestByRepo: Map<string, RepositoryLatestData>
): void {
  try {
    const spreadsheet = openSpreadsheet(spreadsheetId);

    for (const [repository, data] of latestByRepo) {
      // サイクルタイム (6列目: コーディング時間 (時間))
      const cycleTimeSheetName = getExtendedMetricSheetName(repository, 'サイクルタイム');
      data.cycleTimeHours = calculateAverageFromSheet(spreadsheet, cycleTimeSheetName, 5);

      // コーディング時間 (6列目: コーディング時間 (時間))
      const codingTimeSheetName = getExtendedMetricSheetName(repository, 'コーディング時間');
      data.codingTimeHours = calculateAverageFromSheet(spreadsheet, codingTimeSheetName, 6);

      // レビュー効率 (8列目: レビュー待ち時間、9列目: レビュー時間)
      const reviewEffSheetName = getExtendedMetricSheetName(repository, 'レビュー効率');
      data.timeToFirstReviewHours = calculateAverageFromSheet(spreadsheet, reviewEffSheetName, 8);
      data.reviewDurationHours = calculateAverageFromSheet(spreadsheet, reviewEffSheetName, 9);

      // PRサイズ (7列目: 変更行数)
      const prSizeSheetName = getExtendedMetricSheetName(repository, 'PRサイズ');
      data.avgLinesOfCode = calculateAverageFromSheet(spreadsheet, prSizeSheetName, 7);

      // 手戻り率 (7列目: 追加コミット数、8列目: Force Push回数)
      const reworkRateSheetName = getExtendedMetricSheetName(repository, '手戻り率');
      data.avgAdditionalCommits = calculateAverageFromSheet(spreadsheet, reworkRateSheetName, 7);
      data.avgForcePushCount = calculateAverageFromSheet(spreadsheet, reworkRateSheetName, 8);
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new SpreadsheetError('Failed to enrich with extended metrics', {
      code: ErrorCode.SPREADSHEET_READ_FAILED,
      context: { spreadsheetId, repositoryCount: latestByRepo.size },
      cause: error as Error,
    });
  }
}

/**
 * 全体平均を計算
 */
function calculateOverallAverage(
  repoDataList: RepositoryLatestData[]
): Omit<RepositoryLatestData, 'repository' | 'latestDate'> {
  if (repoDataList.length === 0) {
    return {
      deploymentFrequency: 'N/A',
      leadTimeHours: null,
      changeFailureRate: null,
      mttrHours: null,
      cycleTimeHours: null,
      codingTimeHours: null,
      timeToFirstReviewHours: null,
      reviewDurationHours: null,
      avgLinesOfCode: null,
      avgAdditionalCommits: null,
      avgForcePushCount: null,
    };
  }

  const avgOrNull = (values: (number | null)[]): number | null => {
    const valid = values.filter((v): v is number => v !== null);
    return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
  };

  return {
    deploymentFrequency: '(平均)',
    leadTimeHours: avgOrNull(repoDataList.map((d) => d.leadTimeHours)),
    changeFailureRate: avgOrNull(repoDataList.map((d) => d.changeFailureRate)),
    mttrHours: avgOrNull(repoDataList.map((d) => d.mttrHours)),
    cycleTimeHours: avgOrNull(repoDataList.map((d) => d.cycleTimeHours)),
    codingTimeHours: avgOrNull(repoDataList.map((d) => d.codingTimeHours)),
    timeToFirstReviewHours: avgOrNull(repoDataList.map((d) => d.timeToFirstReviewHours)),
    reviewDurationHours: avgOrNull(repoDataList.map((d) => d.reviewDurationHours)),
    avgLinesOfCode: avgOrNull(repoDataList.map((d) => d.avgLinesOfCode)),
    avgAdditionalCommits: avgOrNull(repoDataList.map((d) => d.avgAdditionalCommits)),
    avgForcePushCount: avgOrNull(repoDataList.map((d) => d.avgForcePushCount)),
  };
}

/**
 * メトリクス値をフォーマット
 */
function formatMetric(value: number | null | string): number | string {
  if (typeof value === 'string') {
    return value;
  }
  return value ?? 'N/A';
}

/**
 * リポジトリデータから行データを作成
 */
function createRepositoryRow(data: RepositoryLatestData): (string | number)[] {
  const status = determineHealthStatus(
    data.leadTimeHours,
    data.changeFailureRate,
    data.cycleTimeHours,
    data.timeToFirstReviewHours
  );

  return [
    data.repository,
    data.deploymentFrequency,
    formatMetric(data.leadTimeHours),
    formatMetric(data.changeFailureRate),
    formatMetric(data.mttrHours),
    formatMetric(data.cycleTimeHours),
    formatMetric(data.codingTimeHours),
    formatMetric(data.timeToFirstReviewHours),
    formatMetric(data.reviewDurationHours),
    formatMetric(data.avgLinesOfCode),
    formatMetric(data.avgAdditionalCommits),
    formatMetric(data.avgForcePushCount),
    formatStatus(status),
  ];
}

/**
 * 全体平均行を作成
 */
function createOverallAverageRow(
  overall: Omit<RepositoryLatestData, 'repository' | 'latestDate'>
): (string | number)[] {
  const overallStatus = determineHealthStatus(
    overall.leadTimeHours,
    overall.changeFailureRate,
    overall.cycleTimeHours,
    overall.timeToFirstReviewHours
  );

  return [
    '【全体平均】',
    overall.deploymentFrequency,
    formatMetric(overall.leadTimeHours),
    formatMetric(overall.changeFailureRate),
    formatMetric(overall.mttrHours),
    formatMetric(overall.cycleTimeHours),
    formatMetric(overall.codingTimeHours),
    formatMetric(overall.timeToFirstReviewHours),
    formatMetric(overall.reviewDurationHours),
    formatMetric(overall.avgLinesOfCode),
    formatMetric(overall.avgAdditionalCommits),
    formatMetric(overall.avgForcePushCount),
    formatStatus(overallStatus),
  ];
}

/**
 * Dashboardシート用の行データを作成
 */
function prepareDashboardRows(repoDataList: RepositoryLatestData[]): (string | number)[][] {
  const rows: (string | number)[][] = [];

  // リポジトリ行を作成
  for (const data of repoDataList) {
    rows.push(createRepositoryRow(data));
  }

  // 全体平均行（複数リポジトリの場合）
  if (repoDataList.length > 1) {
    const overall = calculateOverallAverage(repoDataList);
    rows.push(createOverallAverageRow(overall));
  }

  return rows;
}

/**
 * Dashboardシートを初期化
 */
function initializeDashboardSheet(spreadsheet: Spreadsheet): Sheet {
  let sheet = spreadsheet.getSheetByName('Dashboard');
  if (sheet) {
    sheet.clear();
  } else {
    sheet = spreadsheet.insertSheet('Dashboard');
  }

  // シートを先頭に移動（ユーザーが最初に見えるように）
  spreadsheet.setActiveSheet(sheet);
  spreadsheet.moveActiveSheet(1);

  // ヘッダー設定
  sheet.getRange(1, 1, 1, DASHBOARD_HEADERS.length).setValues([DASHBOARD_HEADERS]);
  styleHeaderRow(sheet, DASHBOARD_HEADERS.length);

  return sheet;
}

/**
 * Dashboardシートを作成または更新
 *
 * @param spreadsheetId - スプレッドシートID
 * @param metrics - 全リポジトリのメトリクス
 * @param options - オプション設定
 */
export async function writeDashboard(
  spreadsheetId: string,
  metrics: DevOpsMetrics[],
  options?: { includeCharts?: boolean }
): Promise<void> {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);

  const sheet = initializeDashboardSheet(spreadsheet);

  if (metrics.length === 0) {
    logger.warn('⚠️ No metrics for dashboard');
    return;
  }

  // リポジトリ別最新データを抽出
  const latestByRepo = extractLatestMetricsByRepository(metrics);

  // 拡張指標を統合
  enrichWithExtendedMetrics(spreadsheetId, latestByRepo);

  const repoDataList = Array.from(latestByRepo.values());

  // 行データを作成
  const rows = prepareDashboardRows(repoDataList);

  // データ書き込み
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, DASHBOARD_HEADERS.length).setValues(rows);
  }

  // フォーマット
  formatDashboardSheet(sheet, rows.length, repoDataList.length > 1);

  // チャートを追加（デフォルトで有効）
  if (options?.includeCharts !== false) {
    try {
      // Dynamic import to avoid circular dependencies
      const charts = await import('./charts');
      charts.addAllDashboardCharts(sheet, repoDataList);
      logger.info('📊 Dashboard charts added');
    } catch (error) {
      logger.warn(`⚠️ Failed to add dashboard charts: ${String(error)}`);
    }
  }

  logger.info(`✅ Dashboard updated with ${repoDataList.length} repositories`);
}

/**
 * Dashboardシートのフォーマット
 */
function formatDashboardSheet(sheet: Sheet, rowCount: number, hasOverallRow: boolean): void {
  if (rowCount === 0) {
    return;
  }

  const lastCol = sheet.getLastColumn();

  // 数値列のフォーマット
  sheet.getRange(2, 3, rowCount, 1).setNumberFormat('#,##0.0'); // リードタイム
  sheet.getRange(2, 4, rowCount, 1).setNumberFormat('#,##0.0'); // 変更障害率
  sheet.getRange(2, 5, rowCount, 1).setNumberFormat('#,##0.0'); // MTTR
  sheet.getRange(2, 6, rowCount, 1).setNumberFormat('#,##0.0'); // サイクルタイム
  sheet.getRange(2, 7, rowCount, 1).setNumberFormat('#,##0.0'); // コーディング時間
  sheet.getRange(2, 8, rowCount, 1).setNumberFormat('#,##0.0'); // レビュー待ち
  sheet.getRange(2, 9, rowCount, 1).setNumberFormat('#,##0.0'); // レビュー時間
  sheet.getRange(2, 10, rowCount, 1).setNumberFormat('#,##0'); // PRサイズ
  sheet.getRange(2, 11, rowCount, 1).setNumberFormat('#,##0.0'); // 追加コミット数
  sheet.getRange(2, 12, rowCount, 1).setNumberFormat('#,##0.0'); // Force Push回数

  // データ範囲にボーダーを適用
  applyDataBorders(sheet, rowCount, lastCol);

  // 全体平均行にスタイルを適用
  if (hasOverallRow) {
    styleSummaryRow(sheet, rowCount + 1, lastCol);
  }

  autoResizeColumns(sheet, lastCol);
}

/**
 * 週次トレンドデータを計算
 */
export interface WeeklyTrendData {
  week: string;
  totalDeployments: number;
  avgLeadTimeHours: number | null;
  avgChangeFailureRate: number | null;
  avgCycleTimeHours: number | null;
}

/**
 * メトリクスから週次トレンドを計算
 */
export function calculateWeeklyTrends(
  metrics: DevOpsMetrics[],
  weekCount: number = 8
): WeeklyTrendData[] {
  // 日付→週に変換
  const weeklyData = new Map<string, DevOpsMetrics[]>();

  for (const metric of metrics) {
    const date = new Date(metric.date);
    const week = getISOWeek(date);
    const existing = weeklyData.get(week) ?? [];
    existing.push(metric);
    weeklyData.set(week, existing);
  }

  // 週でソート（新しい順）
  const sortedWeeks = Array.from(weeklyData.keys()).sort().reverse().slice(0, weekCount);

  const trends: WeeklyTrendData[] = [];

  for (const week of sortedWeeks) {
    const weekMetrics = weeklyData.get(week) ?? [];

    const totalDeployments = weekMetrics.reduce((sum, m) => sum + m.deploymentCount, 0);

    const leadTimes = weekMetrics
      .map((m) => m.leadTimeForChangesHours)
      .filter((v): v is number => v !== null && v > 0);
    const avgLeadTime =
      leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null;

    const cfrs = weekMetrics.map((m) => m.changeFailureRate).filter((v): v is number => v !== null);
    const avgCfr = cfrs.length > 0 ? cfrs.reduce((a, b) => a + b, 0) / cfrs.length : null;

    trends.push({
      week,
      totalDeployments,
      avgLeadTimeHours: avgLeadTime,
      avgChangeFailureRate: avgCfr,
      avgCycleTimeHours: null, // 拡張指標統合時に設定
    });
  }

  return trends;
}

/**
 * ISO週番号を取得（YYYY-Www形式）
 */
function getISOWeek(date: Date): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * 前週比を計算
 */
function calculateChange(current: number | null, previous: number | null): string {
  if (current === null || previous === null || previous === 0) {
    return '-';
  }

  const changePercent = ((current - previous) / previous) * 100;

  if (Math.abs(changePercent) < 1) {
    return '横ばい';
  } else if (changePercent > 0) {
    // リードタイム等は増加=悪化
    return `+${changePercent.toFixed(0)}%`;
  } else {
    return `${changePercent.toFixed(0)}%`;
  }
}

/**
 * トレンドシート用のヘッダー
 */
const TREND_HEADERS = [
  '週',
  'デプロイ回数',
  'リードタイム (時間)',
  '変更障害率 (%)',
  'サイクルタイム (時間)',
  '前週比',
];

/**
 * トレンドシートを初期化
 */
function initializeTrendSheet(spreadsheet: Spreadsheet): Sheet {
  const sheetName = 'Dashboard - Trend';
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  sheet.getRange(1, 1, 1, TREND_HEADERS.length).setValues([TREND_HEADERS]);
  styleHeaderRow(sheet, TREND_HEADERS.length);

  return sheet;
}

/**
 * トレンドシート用の行データを作成
 */
function prepareTrendRows(trends: WeeklyTrendData[]): (string | number)[][] {
  const rows: (string | number)[][] = [];

  for (let i = 0; i < trends.length; i++) {
    const current = trends[i];
    const previous = trends[i + 1] ?? null;

    const changeIndicator = previous
      ? calculateChange(current.avgLeadTimeHours, previous.avgLeadTimeHours)
      : '-';

    rows.push([
      current.week,
      current.totalDeployments,
      current.avgLeadTimeHours ?? 'N/A',
      current.avgChangeFailureRate ?? 'N/A',
      current.avgCycleTimeHours ?? 'N/A',
      changeIndicator,
    ]);
  }

  return rows;
}

/**
 * トレンドシートのフォーマット
 */
function formatTrendSheet(sheet: Sheet, rowCount: number): void {
  if (rowCount === 0) {
    return;
  }

  // フォーマット
  sheet.getRange(2, 2, rowCount, 1).setNumberFormat('#,##0');
  sheet.getRange(2, 3, rowCount, 1).setNumberFormat('#,##0.0');
  sheet.getRange(2, 4, rowCount, 1).setNumberFormat('#,##0.0');
  sheet.getRange(2, 5, rowCount, 1).setNumberFormat('#,##0.0');

  // データ範囲にボーダーを適用
  applyDataBorders(sheet, rowCount, TREND_HEADERS.length);

  autoResizeColumns(sheet, TREND_HEADERS.length);
}

/**
 * トレンドシートを作成または更新
 *
 * @param spreadsheetId - スプレッドシートID
 * @param metrics - 全リポジトリのメトリクス
 * @param options - オプション設定
 */
export async function writeDashboardTrends(
  spreadsheetId: string,
  metrics: DevOpsMetrics[],
  options?: { includeCharts?: boolean }
): Promise<void> {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);

  const sheet = initializeTrendSheet(spreadsheet);
  const trends = calculateWeeklyTrends(metrics);

  if (trends.length === 0) {
    logger.warn('⚠️ No trend data available');
    return;
  }

  const rows = prepareTrendRows(trends);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, TREND_HEADERS.length).setValues(rows);
  }

  formatTrendSheet(sheet, rows.length);

  // チャートを追加（デフォルトで有効）
  if (options?.includeCharts !== false) {
    try {
      // Dynamic import to avoid circular dependencies
      const charts = await import('./charts');
      charts.addTrendCharts(sheet, trends);
      logger.info('📊 Trend charts added');
    } catch (error) {
      logger.warn(`⚠️ Failed to add trend charts: ${String(error)}`);
    }
  }

  logger.info(`✅ Trend sheet updated with ${trends.length} weeks`);
}
