/**
 * Dashboardシート書き込み
 *
 * メインのDashboardシートへのデータ出力とフォーマット
 */

import type { DevOpsMetrics } from '../../../types';
import type { Sheet, Spreadsheet } from '../../../interfaces';
import type { RepositoryLatestData } from '../dashboardTypes';
import { getContainer } from '../../../container';
import {
  autoResizeColumns,
  openSpreadsheet,
  styleHeaderRow,
  applyDataBorders,
  styleSummaryRow,
} from '../helpers';
import { DASHBOARD_SCHEMA, getHeadersFromSchema } from '../../../schemas';
import { extractLatestMetricsByRepository, enrichWithExtendedMetrics } from './metrics';
import { determineHealthStatus, formatStatus } from './status';

const DASHBOARD_HEADERS = getHeadersFromSchema(DASHBOARD_SCHEMA);

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
      const charts = await import('../charts');
      charts.addAllDashboardCharts(sheet, repoDataList);
      logger.info('📊 Dashboard charts added');
    } catch (error) {
      logger.warn(`⚠️ Failed to add dashboard charts: ${String(error)}`);
    }
  }

  logger.info(`✅ Dashboard updated with ${repoDataList.length} repositories`);
}
