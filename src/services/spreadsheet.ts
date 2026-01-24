import type { DevOpsMetrics, CycleTimeMetrics } from "../types";
import type { Sheet } from "../interfaces";
import { getContainer } from "../container";

const HEADERS = [
  "Date",
  "Repository",
  "Deployment Count",
  "Deployment Frequency",
  "Lead Time (hours)",
  "Total Deployments",
  "Failed Deployments",
  "Change Failure Rate (%)",
  "MTTR (hours)",
];

export function writeMetricsToSheet(
  spreadsheetId: string,
  sheetName: string,
  metrics: DevOpsMetrics[]
): void {
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }

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

function formatSheet(sheet: Sheet): void {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  // 数値列のフォーマット
  if (lastRow > 1) {
    sheet.getRange(2, 3, lastRow - 1, 1).setNumberFormat("#,##0");
    sheet.getRange(2, 5, lastRow - 1, 1).setNumberFormat("#,##0.0");
    sheet.getRange(2, 8, lastRow - 1, 1).setNumberFormat("#,##0.0");
  }

  // 列幅の自動調整
  for (let i = 1; i <= lastCol; i++) {
    sheet.autoResizeColumn(i);
  }
}

export function clearOldData(
  spreadsheetId: string,
  sheetName: string,
  daysToKeep = 90
): void {
  const { spreadsheetClient } = getContainer();
  const spreadsheet = spreadsheetClient.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const data = sheet.getDataRange().getValues();
  const rowsToDelete: number[] = [];

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

export function createSummarySheet(
  spreadsheetId: string,
  sourceSheetName: string
): void {
  const { spreadsheetClient } = getContainer();
  const spreadsheet = spreadsheetClient.openById(spreadsheetId);
  const summarySheetName = `${sourceSheetName} - Summary`;

  let summarySheet = spreadsheet.getSheetByName(summarySheetName);
  if (!summarySheet) {
    summarySheet = spreadsheet.insertSheet(summarySheetName);
  } else {
    summarySheet.clear();
  }

  const sourceSheet = spreadsheet.getSheetByName(sourceSheetName);
  if (!sourceSheet) return;

  const summaryHeaders = [
    "Repository",
    "Avg Deployment Freq",
    "Avg Lead Time (hours)",
    "Avg Change Failure Rate (%)",
    "Avg MTTR (hours)",
    "Last Updated",
  ];

  summarySheet.getRange(1, 1, 1, summaryHeaders.length).setValues([summaryHeaders]);
  summarySheet.getRange(1, 1, 1, summaryHeaders.length).setFontWeight("bold");
}

const CYCLE_TIME_SHEET_NAME = "Cycle Time";

const CYCLE_TIME_HEADERS = [
  "Period",
  "Completed Tasks",
  "Avg Cycle Time (hours)",
  "Avg Cycle Time (days)",
  "Median (hours)",
  "Min (hours)",
  "Max (hours)",
  "Recorded At",
];

const CYCLE_TIME_DETAIL_HEADERS = [
  "Task ID",
  "Title",
  "Started At",
  "Completed At",
  "Cycle Time (hours)",
  "Cycle Time (days)",
];

/**
 * サイクルタイム指標をスプレッドシートに書き出す
 *
 * 2つのシートを作成/更新:
 * - "Cycle Time": サマリー情報
 * - "Cycle Time - Details": 各タスクの詳細
 */
export function writeCycleTimeToSheet(
  spreadsheetId: string,
  metrics: CycleTimeMetrics
): void {
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(spreadsheetId);

  // サマリーシート
  let summarySheet = spreadsheet.getSheetByName(CYCLE_TIME_SHEET_NAME);
  if (!summarySheet) {
    summarySheet = spreadsheet.insertSheet(CYCLE_TIME_SHEET_NAME);
    summarySheet.getRange(1, 1, 1, CYCLE_TIME_HEADERS.length).setValues([CYCLE_TIME_HEADERS]);
    summarySheet.getRange(1, 1, 1, CYCLE_TIME_HEADERS.length).setFontWeight("bold");
    summarySheet.setFrozenRows(1);
  }

  const avgDays = metrics.avgCycleTimeHours !== null
    ? Math.round((metrics.avgCycleTimeHours / 24) * 10) / 10
    : "N/A";

  const summaryRow = [
    metrics.period,
    metrics.completedTaskCount,
    metrics.avgCycleTimeHours ?? "N/A",
    avgDays,
    metrics.medianCycleTimeHours ?? "N/A",
    metrics.minCycleTimeHours ?? "N/A",
    metrics.maxCycleTimeHours ?? "N/A",
    new Date().toISOString(),
  ];

  const lastRow = summarySheet.getLastRow();
  summarySheet.getRange(lastRow + 1, 1, 1, CYCLE_TIME_HEADERS.length).setValues([summaryRow]);

  // 数値フォーマット（新しく追加した行を含む）
  const newLastRow = summarySheet.getLastRow();
  if (newLastRow > 1) {
    summarySheet.getRange(2, 3, newLastRow - 1, 5).setNumberFormat("#,##0.0");
  }

  // 列幅の自動調整
  for (let i = 1; i <= CYCLE_TIME_HEADERS.length; i++) {
    summarySheet.autoResizeColumn(i);
  }

  // 詳細シート
  const detailSheetName = `${CYCLE_TIME_SHEET_NAME} - Details`;
  let detailSheet = spreadsheet.getSheetByName(detailSheetName);
  if (!detailSheet) {
    detailSheet = spreadsheet.insertSheet(detailSheetName);
    detailSheet.getRange(1, 1, 1, CYCLE_TIME_DETAIL_HEADERS.length).setValues([CYCLE_TIME_DETAIL_HEADERS]);
    detailSheet.getRange(1, 1, 1, CYCLE_TIME_DETAIL_HEADERS.length).setFontWeight("bold");
    detailSheet.setFrozenRows(1);
  }

  if (metrics.taskDetails.length > 0) {
    const detailRows = metrics.taskDetails.map((task) => [
      task.taskId,
      task.title,
      task.startedAt,
      task.completedAt,
      task.cycleTimeHours,
      Math.round((task.cycleTimeHours / 24) * 10) / 10,
    ]);

    const detailLastRow = detailSheet.getLastRow();
    detailSheet.getRange(detailLastRow + 1, 1, detailRows.length, CYCLE_TIME_DETAIL_HEADERS.length).setValues(detailRows);

    // 数値フォーマット（新しく追加した行を含む）
    const newDetailLastRow = detailSheet.getLastRow();
    if (newDetailLastRow > 1) {
      detailSheet.getRange(2, 5, newDetailLastRow - 1, 2).setNumberFormat("#,##0.0");
    }

    // 列幅の自動調整
    for (let i = 1; i <= CYCLE_TIME_DETAIL_HEADERS.length; i++) {
      detailSheet.autoResizeColumn(i);
    }
  }

  logger.log(`📝 Wrote cycle time metrics to sheet "${CYCLE_TIME_SHEET_NAME}"`);
}
