/**
 * DevOps Metrics（DORA指標）スプレッドシート操作
 *
 * DORA Four Key Metricsをスプレッドシートに書き出す機能を提供。
 * - writeMetricsToSheet: メトリクス書き出し
 * - clearOldData: 古いデータのクリーンアップ
 * - createSummarySheet: サマリーシート生成
 */

import type { DevOpsMetrics } from "../../types";
import type { Sheet } from "../../interfaces";
import { getContainer } from "../../container";
import { aggregateMultiRepoMetrics } from "../../utils/metrics";
import {
  getOrCreateSheet,
  autoResizeColumns,
  openSpreadsheet,
} from "./helpers";

/**
 * DevOps Metrics シートのヘッダー定義
 * DORA Four Key Metrics に基づく指標
 */
const HEADERS = [
  "日付",                    // 計測日
  "リポジトリ",              // 対象リポジトリ名
  "デプロイ回数",            // 期間内のデプロイ回数
  "デプロイ頻度",            // デプロイ頻度（回/日）
  "リードタイム (時間)",     // コード変更から本番デプロイまでの時間
  "総デプロイ数",            // 累計デプロイ数
  "失敗デプロイ数",          // 失敗したデプロイの数
  "変更障害率 (%)",          // 失敗デプロイ / 総デプロイ × 100
  "平均復旧時間 (時間)",     // Mean Time To Recovery
];

/**
 * DevOps Metricsをスプレッドシートに書き出す
 */
export function writeMetricsToSheet(
  spreadsheetId: string,
  sheetName: string,
  metrics: DevOpsMetrics[]
): void {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const sheet = getOrCreateSheet(spreadsheet, sheetName, HEADERS);

  if (metrics.length === 0) {
    logger.log("⚠️ No metrics to write");
    return;
  }

  const rows = metrics.map((m) => [
    m.date,
    m.repository,
    m.deploymentCount,
    m.deploymentFrequency,
    m.leadTimeForChangesHours,
    m.totalDeployments,
    m.failedDeployments,
    m.changeFailureRate,
    m.meanTimeToRecoveryHours ?? "N/A",
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, HEADERS.length).setValues(rows);

  formatSheet(sheet);
}

/**
 * シートのフォーマットを整える
 */
function formatSheet(sheet: Sheet): void {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  // 数値列のフォーマット
  if (lastRow > 1) {
    sheet.getRange(2, 3, lastRow - 1, 1).setNumberFormat("#,##0");
    sheet.getRange(2, 5, lastRow - 1, 1).setNumberFormat("#,##0.0");
    sheet.getRange(2, 8, lastRow - 1, 1).setNumberFormat("#,##0.0");
  }

  autoResizeColumns(sheet, lastCol);
}

/**
 * 古いデータを削除する
 *
 * @param daysToKeep - 保持する日数（デフォルト: 90日）
 */
export function clearOldData(
  spreadsheetId: string,
  sheetName: string,
  daysToKeep = 90
): void {
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const data = sheet.getDataRange().getValues();
  const rowsToDelete: number[] = [];

  // 古い行を逆順で収集（削除時のインデックスずれを防ぐ）
  for (let i = data.length - 1; i >= 1; i--) {
    const rowDate = new Date(data[i][0] as string);
    if (rowDate < cutoffDate) {
      rowsToDelete.push(i + 1);
    }
  }

  for (const row of rowsToDelete) {
    sheet.deleteRow(row);
  }
}

/**
 * サマリーシートを作成する
 *
 * ソースシートのデータを集計し、リポジトリごとのサマリーと全体平均を表示。
 */
export function createSummarySheet(
  spreadsheetId: string,
  sourceSheetName: string
): void {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const summarySheetName = `${sourceSheetName} - Summary`;

  let summarySheet = spreadsheet.getSheetByName(summarySheetName);
  if (!summarySheet) {
    summarySheet = spreadsheet.insertSheet(summarySheetName);
  } else {
    summarySheet.clear();
  }

  const sourceSheet = spreadsheet.getSheetByName(sourceSheetName);
  if (!sourceSheet) {
    logger.log("⚠️ Source sheet not found");
    return;
  }

  const summaryHeaders = [
    "リポジトリ",
    "データポイント数",
    "平均デプロイ回数",
    "平均リードタイム (時間)",
    "平均変更障害率 (%)",
    "平均復旧時間 (時間)",
    "最終更新日時",
  ];

  summarySheet.getRange(1, 1, 1, summaryHeaders.length).setValues([summaryHeaders]);
  summarySheet.getRange(1, 1, 1, summaryHeaders.length).setFontWeight("bold");
  summarySheet.setFrozenRows(1);

  // ソースシートからデータを読み取り
  const data = sourceSheet.getDataRange().getValues();
  if (data.length <= 1) {
    logger.log("⚠️ No data in source sheet");
    return;
  }

  // DevOpsMetrics形式に変換
  const metrics = parseDevOpsMetricsFromSheet(data);
  const aggregated = aggregateMultiRepoMetrics(metrics);

  // サマリー行を作成
  const rows = buildSummaryRows(aggregated, metrics.length);

  if (rows.length > 0) {
    writeSummaryRows(summarySheet, rows, summaryHeaders.length, aggregated.repositorySummaries.length);
  }

  logger.log(`✅ Summary sheet created with ${aggregated.repositorySummaries.length} repositories`);
}

/**
 * シートデータをDevOpsMetrics形式に変換
 */
function parseDevOpsMetricsFromSheet(data: unknown[][]): DevOpsMetrics[] {
  const metrics: DevOpsMetrics[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    metrics.push({
      date: String(row[0]),
      repository: String(row[1]),
      deploymentCount: Number(row[2]) || 0,
      deploymentFrequency: row[3] as "daily" | "weekly" | "monthly" | "yearly",
      leadTimeForChangesHours: Number(row[4]) || 0,
      totalDeployments: Number(row[5]) || 0,
      failedDeployments: Number(row[6]) || 0,
      changeFailureRate: Number(row[7]) || 0,
      meanTimeToRecoveryHours: row[8] === "N/A" ? null : Number(row[8]) || null,
    });
  }

  return metrics;
}

/**
 * サマリー行データを構築
 */
function buildSummaryRows(
  aggregated: ReturnType<typeof aggregateMultiRepoMetrics>,
  totalDataPoints: number
): (string | number)[][] {
  const rows: (string | number)[][] = [];

  // リポジトリごとのサマリー
  for (const summary of aggregated.repositorySummaries) {
    rows.push([
      summary.repository,
      summary.dataPointCount,
      summary.avgDeploymentCount,
      summary.avgLeadTimeHours,
      summary.avgChangeFailureRate,
      summary.avgMttrHours ?? "N/A",
      summary.lastUpdated,
    ]);
  }

  // 全体平均行（複数リポジトリがある場合のみ）
  if (aggregated.repositorySummaries.length > 1) {
    rows.push([
      "【全体平均】",
      totalDataPoints,
      aggregated.overallSummary.avgDeploymentCount,
      aggregated.overallSummary.avgLeadTimeHours,
      aggregated.overallSummary.avgChangeFailureRate,
      aggregated.overallSummary.avgMttrHours ?? "N/A",
      new Date().toISOString(),
    ]);
  }

  return rows;
}

/**
 * サマリー行をシートに書き込み
 */
function writeSummaryRows(
  sheet: Sheet,
  rows: (string | number)[][],
  columnCount: number,
  repoCount: number
): void {
  sheet.getRange(2, 1, rows.length, columnCount).setValues(rows);

  // フォーマット設定
  const lastRow = rows.length + 1;
  sheet.getRange(2, 3, rows.length, 1).setNumberFormat("#,##0.0");
  sheet.getRange(2, 4, rows.length, 1).setNumberFormat("#,##0.0");
  sheet.getRange(2, 5, rows.length, 1).setNumberFormat("#,##0.0");

  // 全体平均行を太字にする
  if (repoCount > 1) {
    sheet.getRange(lastRow, 1, 1, columnCount).setFontWeight("bold");
  }

  autoResizeColumns(sheet, columnCount);
}
