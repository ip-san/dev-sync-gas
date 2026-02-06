/**
 * Dashboardトレンドシート書き込み
 *
 * トレンドシートへのデータ出力とフォーマット
 */

import type { DevOpsMetrics } from '../../../types';
import type { Sheet, Spreadsheet } from '../../../interfaces';
import type { WeeklyTrendData } from '../dashboardTypes';
import { getContainer } from '../../../container';
import { autoResizeColumns, openSpreadsheet, styleHeaderRow, applyDataBorders } from '../helpers';
import { calculateWeeklyTrends, calculateChange } from './trends';

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
      const charts = await import('../charts');
      charts.addTrendCharts(sheet, trends);
      logger.info('📊 Trend charts added');
    } catch (error) {
      logger.warn(`⚠️ Failed to add trend charts: ${String(error)}`);
    }
  }

  logger.info(`✅ Trend sheet updated with ${trends.length} weeks`);
}
