/**
 * 指標別Summaryシート操作
 *
 * 各指標カテゴリ（DevOps Metrics, サイクルタイム等）のサマリーシートを生成。
 * リポジトリ別シートからデータを集計し、リポジトリ間の比較を可能にする。
 */

import type { DevOpsMetrics } from '../../types';
import type { Sheet } from '../../interfaces';
import { getContainer } from '../../container';
import { aggregateMultiRepoMetrics } from '../../utils/metrics';
import {
  autoResizeColumns,
  openSpreadsheet,
  styleHeaderRow,
  applyDataBorders,
  styleSummaryRow,
} from './helpers';
import { readMetricsFromAllRepositorySheets } from './repositorySheet';

/**
 * DevOps Metrics Summaryのヘッダー
 */
const DEVOPS_SUMMARY_HEADERS = [
  'リポジトリ',
  'データポイント数',
  '平均デプロイ回数',
  '平均リードタイム (時間)',
  '平均変更障害率 (%)',
  '平均復旧時間 (時間)',
  '最終更新日時',
];

/**
 * リポジトリ別シートからデータを集計してSummaryシートを作成
 *
 * @param spreadsheetId - スプレッドシートID
 * @param repositories - リポジトリ名の配列
 * @param summarySheetName - サマリーシート名（デフォルト: "DevOps Summary"）
 */
export function createDevOpsSummaryFromRepositorySheets(
  spreadsheetId: string,
  repositories: string[],
  summarySheetName: string = 'DevOps Summary'
): void {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);

  // 全リポジトリシートからメトリクスを読み取り
  const allMetrics = readMetricsFromAllRepositorySheets(spreadsheetId, repositories);

  if (allMetrics.length === 0) {
    logger.log('⚠️ No metrics found in repository sheets');
    return;
  }

  // 集計
  const aggregated = aggregateMultiRepoMetrics(allMetrics);

  // サマリーシートを作成または取得
  let sheet = spreadsheet.getSheetByName(summarySheetName);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = spreadsheet.insertSheet(summarySheetName);
  }

  // ヘッダー設定
  sheet.getRange(1, 1, 1, DEVOPS_SUMMARY_HEADERS.length).setValues([DEVOPS_SUMMARY_HEADERS]);
  styleHeaderRow(sheet, DEVOPS_SUMMARY_HEADERS.length);

  // 行データを作成
  const rows: (string | number)[][] = [];

  for (const summary of aggregated.repositorySummaries) {
    rows.push([
      summary.repository,
      summary.dataPointCount,
      summary.avgDeploymentCount,
      summary.avgLeadTimeHours,
      summary.avgChangeFailureRate,
      summary.avgMttrHours ?? 'N/A',
      summary.lastUpdated,
    ]);
  }

  // 全体平均行（複数リポジトリの場合）
  if (aggregated.repositorySummaries.length > 1) {
    rows.push([
      '【全体平均】',
      allMetrics.length,
      aggregated.overallSummary.avgDeploymentCount,
      aggregated.overallSummary.avgLeadTimeHours,
      aggregated.overallSummary.avgChangeFailureRate,
      aggregated.overallSummary.avgMttrHours ?? 'N/A',
      new Date().toISOString(),
    ]);
  }

  // 書き込み
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, DEVOPS_SUMMARY_HEADERS.length).setValues(rows);
  }

  // フォーマット
  formatSummarySheet(sheet, rows.length, aggregated.repositorySummaries.length > 1);

  // 各リポジトリシートへのリンクを追加（末尾に）
  addRepositoryLinks(sheet, repositories, rows.length + 2);

  logger.log(
    `✅ DevOps Summary created with ${aggregated.repositorySummaries.length} repositories`
  );
}

/**
 * サマリーシートのフォーマット
 */
function formatSummarySheet(sheet: Sheet, rowCount: number, hasOverallRow: boolean): void {
  if (rowCount === 0) {
    return;
  }

  const lastCol = sheet.getLastColumn();

  // 数値列のフォーマット
  sheet.getRange(2, 2, rowCount, 1).setNumberFormat('#,##0'); // データポイント数
  sheet.getRange(2, 3, rowCount, 1).setNumberFormat('#,##0.0'); // 平均デプロイ回数
  sheet.getRange(2, 4, rowCount, 1).setNumberFormat('#,##0.0'); // 平均リードタイム
  sheet.getRange(2, 5, rowCount, 1).setNumberFormat('#,##0.0'); // 平均変更障害率
  sheet.getRange(2, 6, rowCount, 1).setNumberFormat('#,##0.0'); // 平均復旧時間

  // データ範囲にボーダーを適用
  applyDataBorders(sheet, rowCount, lastCol);

  // 全体平均行にスタイルを適用
  if (hasOverallRow) {
    styleSummaryRow(sheet, rowCount + 1, lastCol);
  }

  autoResizeColumns(sheet, lastCol);
}

/**
 * リポジトリシートへのリンクを追加
 */
function addRepositoryLinks(sheet: Sheet, repositories: string[], startRow: number): void {
  if (repositories.length === 0) {
    return;
  }

  // 空行を挟む
  sheet.getRange(startRow, 1, 1, 1).setValues([['']]);

  // リンクセクションのヘッダー
  sheet.getRange(startRow + 1, 1, 1, 1).setValues([['詳細データ']]);
  sheet.getRange(startRow + 1, 1, 1, 1).setFontWeight('bold');

  // 各リポジトリへのリンク（シート内リンクはGASでは直接作成できないため、テキストで表示）
  for (let i = 0; i < repositories.length; i++) {
    const row = startRow + 2 + i;
    sheet.getRange(row, 1, 1, 1).setValues([[`→ ${repositories[i]}`]]);
  }
}

/**
 * メトリクスから直接Summaryシートを作成
 * （リポジトリ別シートを経由しない場合に使用）
 *
 * @param spreadsheetId - スプレッドシートID
 * @param metrics - 全メトリクス
 * @param summarySheetName - サマリーシート名
 */
export function createDevOpsSummaryFromMetrics(
  spreadsheetId: string,
  metrics: DevOpsMetrics[],
  summarySheetName: string = 'DevOps Summary'
): void {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);

  if (metrics.length === 0) {
    logger.log('⚠️ No metrics for summary');
    return;
  }

  // 集計
  const aggregated = aggregateMultiRepoMetrics(metrics);

  // サマリーシートを作成または取得
  let sheet = spreadsheet.getSheetByName(summarySheetName);
  if (sheet) {
    sheet.clear();
  } else {
    sheet = spreadsheet.insertSheet(summarySheetName);
  }

  // ヘッダー設定
  sheet.getRange(1, 1, 1, DEVOPS_SUMMARY_HEADERS.length).setValues([DEVOPS_SUMMARY_HEADERS]);
  styleHeaderRow(sheet, DEVOPS_SUMMARY_HEADERS.length);

  // 行データを作成
  const rows: (string | number)[][] = [];

  for (const summary of aggregated.repositorySummaries) {
    rows.push([
      summary.repository,
      summary.dataPointCount,
      summary.avgDeploymentCount,
      summary.avgLeadTimeHours,
      summary.avgChangeFailureRate,
      summary.avgMttrHours ?? 'N/A',
      summary.lastUpdated,
    ]);
  }

  // 全体平均行
  if (aggregated.repositorySummaries.length > 1) {
    rows.push([
      '【全体平均】',
      metrics.length,
      aggregated.overallSummary.avgDeploymentCount,
      aggregated.overallSummary.avgLeadTimeHours,
      aggregated.overallSummary.avgChangeFailureRate,
      aggregated.overallSummary.avgMttrHours ?? 'N/A',
      new Date().toISOString(),
    ]);
  }

  // 書き込み
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, DEVOPS_SUMMARY_HEADERS.length).setValues(rows);
  }

  // フォーマット
  formatSummarySheet(sheet, rows.length, aggregated.repositorySummaries.length > 1);

  // リポジトリ一覧を取得してリンク追加
  const repositories = [...new Set(metrics.map((m) => m.repository))];
  addRepositoryLinks(sheet, repositories, rows.length + 2);

  logger.log(
    `✅ DevOps Summary created from metrics with ${aggregated.repositorySummaries.length} repositories`
  );
}
