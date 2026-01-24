import type { DevOpsMetrics, CycleTimeMetrics, CodingTimeMetrics, ReworkRateMetrics, ReviewEfficiencyMetrics, PRSizeMetrics, DeveloperSatisfactionMetrics } from "../types";
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

const CODING_TIME_SHEET_NAME = "Coding Time";

const CODING_TIME_HEADERS = [
  "Period",
  "Task Count",
  "Avg Coding Time (hours)",
  "Avg Coding Time (days)",
  "Median (hours)",
  "Min (hours)",
  "Max (hours)",
  "Recorded At",
];

const CODING_TIME_DETAIL_HEADERS = [
  "Task ID",
  "Title",
  "Started At",
  "PR Created At",
  "PR URL",
  "Coding Time (hours)",
  "Coding Time (days)",
];

/**
 * コーディング時間指標をスプレッドシートに書き出す
 *
 * 2つのシートを作成/更新:
 * - "Coding Time": サマリー情報
 * - "Coding Time - Details": 各タスクの詳細
 */
export function writeCodingTimeToSheet(
  spreadsheetId: string,
  metrics: CodingTimeMetrics
): void {
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(spreadsheetId);

  // サマリーシート
  let summarySheet = spreadsheet.getSheetByName(CODING_TIME_SHEET_NAME);
  if (!summarySheet) {
    summarySheet = spreadsheet.insertSheet(CODING_TIME_SHEET_NAME);
    summarySheet.getRange(1, 1, 1, CODING_TIME_HEADERS.length).setValues([CODING_TIME_HEADERS]);
    summarySheet.getRange(1, 1, 1, CODING_TIME_HEADERS.length).setFontWeight("bold");
    summarySheet.setFrozenRows(1);
  }

  const avgDays = metrics.avgCodingTimeHours !== null
    ? Math.round((metrics.avgCodingTimeHours / 24) * 10) / 10
    : "N/A";

  const summaryRow = [
    metrics.period,
    metrics.taskCount,
    metrics.avgCodingTimeHours ?? "N/A",
    avgDays,
    metrics.medianCodingTimeHours ?? "N/A",
    metrics.minCodingTimeHours ?? "N/A",
    metrics.maxCodingTimeHours ?? "N/A",
    new Date().toISOString(),
  ];

  const lastRow = summarySheet.getLastRow();
  summarySheet.getRange(lastRow + 1, 1, 1, CODING_TIME_HEADERS.length).setValues([summaryRow]);

  // 数値フォーマット（新しく追加した行を含む）
  const newLastRow = summarySheet.getLastRow();
  if (newLastRow > 1) {
    summarySheet.getRange(2, 3, newLastRow - 1, 5).setNumberFormat("#,##0.0");
  }

  // 列幅の自動調整
  for (let i = 1; i <= CODING_TIME_HEADERS.length; i++) {
    summarySheet.autoResizeColumn(i);
  }

  // 詳細シート
  const detailSheetName = `${CODING_TIME_SHEET_NAME} - Details`;
  let detailSheet = spreadsheet.getSheetByName(detailSheetName);
  if (!detailSheet) {
    detailSheet = spreadsheet.insertSheet(detailSheetName);
    detailSheet.getRange(1, 1, 1, CODING_TIME_DETAIL_HEADERS.length).setValues([CODING_TIME_DETAIL_HEADERS]);
    detailSheet.getRange(1, 1, 1, CODING_TIME_DETAIL_HEADERS.length).setFontWeight("bold");
    detailSheet.setFrozenRows(1);
  }

  if (metrics.taskDetails.length > 0) {
    const detailRows = metrics.taskDetails.map((task) => [
      task.taskId,
      task.title,
      task.startedAt,
      task.prCreatedAt,
      task.prUrl,
      task.codingTimeHours,
      Math.round((task.codingTimeHours / 24) * 10) / 10,
    ]);

    const detailLastRow = detailSheet.getLastRow();
    detailSheet.getRange(detailLastRow + 1, 1, detailRows.length, CODING_TIME_DETAIL_HEADERS.length).setValues(detailRows);

    // 数値フォーマット（新しく追加した行を含む）
    const newDetailLastRow = detailSheet.getLastRow();
    if (newDetailLastRow > 1) {
      detailSheet.getRange(2, 6, newDetailLastRow - 1, 2).setNumberFormat("#,##0.0");
    }

    // 列幅の自動調整
    for (let i = 1; i <= CODING_TIME_DETAIL_HEADERS.length; i++) {
      detailSheet.autoResizeColumn(i);
    }
  }

  logger.log(`📝 Wrote coding time metrics to sheet "${CODING_TIME_SHEET_NAME}"`);
}

const REWORK_RATE_SHEET_NAME = "Rework Rate";

const REWORK_RATE_HEADERS = [
  "Period",
  "PR Count",
  "Additional Commits (Total)",
  "Additional Commits (Avg)",
  "Additional Commits (Median)",
  "Additional Commits (Max)",
  "Force Pushes (Total)",
  "Force Pushes (Avg)",
  "PRs with Force Push",
  "Force Push Rate (%)",
  "Recorded At",
];

const REWORK_RATE_DETAIL_HEADERS = [
  "PR #",
  "Title",
  "Repository",
  "Created At",
  "Merged At",
  "Total Commits",
  "Additional Commits",
  "Force Push Count",
];

/**
 * 手戻り率指標をスプレッドシートに書き出す
 *
 * 2つのシートを作成/更新:
 * - "Rework Rate": サマリー情報
 * - "Rework Rate - Details": 各PRの詳細
 */
export function writeReworkRateToSheet(
  spreadsheetId: string,
  metrics: ReworkRateMetrics
): void {
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(spreadsheetId);

  // サマリーシート
  let summarySheet = spreadsheet.getSheetByName(REWORK_RATE_SHEET_NAME);
  if (!summarySheet) {
    summarySheet = spreadsheet.insertSheet(REWORK_RATE_SHEET_NAME);
    summarySheet.getRange(1, 1, 1, REWORK_RATE_HEADERS.length).setValues([REWORK_RATE_HEADERS]);
    summarySheet.getRange(1, 1, 1, REWORK_RATE_HEADERS.length).setFontWeight("bold");
    summarySheet.setFrozenRows(1);
  }

  const summaryRow = [
    metrics.period,
    metrics.prCount,
    metrics.additionalCommits.total,
    metrics.additionalCommits.avgPerPr ?? "N/A",
    metrics.additionalCommits.median ?? "N/A",
    metrics.additionalCommits.max ?? "N/A",
    metrics.forcePushes.total,
    metrics.forcePushes.avgPerPr ?? "N/A",
    metrics.forcePushes.prsWithForcePush,
    metrics.forcePushes.forcePushRate ?? "N/A",
    new Date().toISOString(),
  ];

  const lastRow = summarySheet.getLastRow();
  summarySheet.getRange(lastRow + 1, 1, 1, REWORK_RATE_HEADERS.length).setValues([summaryRow]);

  // 数値フォーマット（新しく追加した行を含む）
  const newLastRow = summarySheet.getLastRow();
  if (newLastRow > 1) {
    summarySheet.getRange(2, 4, newLastRow - 1, 3).setNumberFormat("#,##0.0");
    summarySheet.getRange(2, 8, newLastRow - 1, 1).setNumberFormat("#,##0.0");
    summarySheet.getRange(2, 10, newLastRow - 1, 1).setNumberFormat("#,##0.0");
  }

  // 列幅の自動調整
  for (let i = 1; i <= REWORK_RATE_HEADERS.length; i++) {
    summarySheet.autoResizeColumn(i);
  }

  // 詳細シート
  const detailSheetName = `${REWORK_RATE_SHEET_NAME} - Details`;
  let detailSheet = spreadsheet.getSheetByName(detailSheetName);
  if (!detailSheet) {
    detailSheet = spreadsheet.insertSheet(detailSheetName);
    detailSheet.getRange(1, 1, 1, REWORK_RATE_DETAIL_HEADERS.length).setValues([REWORK_RATE_DETAIL_HEADERS]);
    detailSheet.getRange(1, 1, 1, REWORK_RATE_DETAIL_HEADERS.length).setFontWeight("bold");
    detailSheet.setFrozenRows(1);
  }

  if (metrics.prDetails.length > 0) {
    const detailRows = metrics.prDetails.map((pr) => [
      pr.prNumber,
      pr.title,
      pr.repository,
      pr.createdAt,
      pr.mergedAt ?? "Not merged",
      pr.totalCommits,
      pr.additionalCommits,
      pr.forcePushCount,
    ]);

    const detailLastRow = detailSheet.getLastRow();
    detailSheet.getRange(detailLastRow + 1, 1, detailRows.length, REWORK_RATE_DETAIL_HEADERS.length).setValues(detailRows);

    // 列幅の自動調整
    for (let i = 1; i <= REWORK_RATE_DETAIL_HEADERS.length; i++) {
      detailSheet.autoResizeColumn(i);
    }
  }

  logger.log(`📝 Wrote rework rate metrics to sheet "${REWORK_RATE_SHEET_NAME}"`);
}

const REVIEW_EFFICIENCY_SHEET_NAME = "Review Efficiency";
const REVIEW_EFFICIENCY_HEADERS = [
  "Period",
  "PR Count",
  "Time to First Review (Avg)",
  "Time to First Review (Median)",
  "Time to First Review (Min)",
  "Time to First Review (Max)",
  "Review Duration (Avg)",
  "Review Duration (Median)",
  "Review Duration (Min)",
  "Review Duration (Max)",
  "Time to Merge (Avg)",
  "Time to Merge (Median)",
  "Time to Merge (Min)",
  "Time to Merge (Max)",
  "Total Time (Avg)",
  "Total Time (Median)",
  "Total Time (Min)",
  "Total Time (Max)",
  "Recorded At",
];

const REVIEW_EFFICIENCY_DETAIL_HEADERS = [
  "PR #",
  "Title",
  "Repository",
  "Created At",
  "Ready for Review At",
  "First Review At",
  "Approved At",
  "Merged At",
  "Time to First Review (h)",
  "Review Duration (h)",
  "Time to Merge (h)",
  "Total Time (h)",
];

/**
 * レビュー効率指標をスプレッドシートに書き出す
 *
 * 2つのシートを作成/更新:
 * - "Review Efficiency": サマリー情報
 * - "Review Efficiency - Details": 各PRの詳細
 */
export function writeReviewEfficiencyToSheet(
  spreadsheetId: string,
  metrics: ReviewEfficiencyMetrics
): void {
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(spreadsheetId);

  // サマリーシート
  let summarySheet = spreadsheet.getSheetByName(REVIEW_EFFICIENCY_SHEET_NAME);
  if (!summarySheet) {
    summarySheet = spreadsheet.insertSheet(REVIEW_EFFICIENCY_SHEET_NAME);
    summarySheet.getRange(1, 1, 1, REVIEW_EFFICIENCY_HEADERS.length).setValues([REVIEW_EFFICIENCY_HEADERS]);
    summarySheet.getRange(1, 1, 1, REVIEW_EFFICIENCY_HEADERS.length).setFontWeight("bold");
    summarySheet.setFrozenRows(1);
  }

  const summaryRow = [
    metrics.period,
    metrics.prCount,
    metrics.timeToFirstReview.avgHours ?? "N/A",
    metrics.timeToFirstReview.medianHours ?? "N/A",
    metrics.timeToFirstReview.minHours ?? "N/A",
    metrics.timeToFirstReview.maxHours ?? "N/A",
    metrics.reviewDuration.avgHours ?? "N/A",
    metrics.reviewDuration.medianHours ?? "N/A",
    metrics.reviewDuration.minHours ?? "N/A",
    metrics.reviewDuration.maxHours ?? "N/A",
    metrics.timeToMerge.avgHours ?? "N/A",
    metrics.timeToMerge.medianHours ?? "N/A",
    metrics.timeToMerge.minHours ?? "N/A",
    metrics.timeToMerge.maxHours ?? "N/A",
    metrics.totalTime.avgHours ?? "N/A",
    metrics.totalTime.medianHours ?? "N/A",
    metrics.totalTime.minHours ?? "N/A",
    metrics.totalTime.maxHours ?? "N/A",
    new Date().toISOString(),
  ];

  const lastRow = summarySheet.getLastRow();
  summarySheet.getRange(lastRow + 1, 1, 1, REVIEW_EFFICIENCY_HEADERS.length).setValues([summaryRow]);

  // 数値フォーマット（新しく追加した行を含む）
  const newLastRow = summarySheet.getLastRow();
  if (newLastRow > 1) {
    // 時間列（3-18）の書式設定
    summarySheet.getRange(2, 3, newLastRow - 1, 16).setNumberFormat("#,##0.0");
  }

  // 列幅の自動調整
  for (let i = 1; i <= REVIEW_EFFICIENCY_HEADERS.length; i++) {
    summarySheet.autoResizeColumn(i);
  }

  // 詳細シート
  const detailSheetName = `${REVIEW_EFFICIENCY_SHEET_NAME} - Details`;
  let detailSheet = spreadsheet.getSheetByName(detailSheetName);
  if (!detailSheet) {
    detailSheet = spreadsheet.insertSheet(detailSheetName);
    detailSheet.getRange(1, 1, 1, REVIEW_EFFICIENCY_DETAIL_HEADERS.length).setValues([REVIEW_EFFICIENCY_DETAIL_HEADERS]);
    detailSheet.getRange(1, 1, 1, REVIEW_EFFICIENCY_DETAIL_HEADERS.length).setFontWeight("bold");
    detailSheet.setFrozenRows(1);
  }

  if (metrics.prDetails.length > 0) {
    const detailRows = metrics.prDetails.map((pr) => [
      pr.prNumber,
      pr.title,
      pr.repository,
      pr.createdAt,
      pr.readyForReviewAt,
      pr.firstReviewAt ?? "N/A",
      pr.approvedAt ?? "N/A",
      pr.mergedAt ?? "Not merged",
      pr.timeToFirstReviewHours ?? "N/A",
      pr.reviewDurationHours ?? "N/A",
      pr.timeToMergeHours ?? "N/A",
      pr.totalTimeHours ?? "N/A",
    ]);

    const detailLastRow = detailSheet.getLastRow();
    detailSheet.getRange(detailLastRow + 1, 1, detailRows.length, REVIEW_EFFICIENCY_DETAIL_HEADERS.length).setValues(detailRows);

    // 数値フォーマット
    const detailNewLastRow = detailSheet.getLastRow();
    if (detailNewLastRow > 1) {
      detailSheet.getRange(2, 9, detailNewLastRow - 1, 4).setNumberFormat("#,##0.0");
    }

    // 列幅の自動調整
    for (let i = 1; i <= REVIEW_EFFICIENCY_DETAIL_HEADERS.length; i++) {
      detailSheet.autoResizeColumn(i);
    }
  }

  logger.log(`📝 Wrote review efficiency metrics to sheet "${REVIEW_EFFICIENCY_SHEET_NAME}"`);
}

const PR_SIZE_SHEET_NAME = "PR Size";
const PR_SIZE_HEADERS = [
  "Period",
  "PR Count",
  "Lines of Code (Total)",
  "Lines of Code (Avg)",
  "Lines of Code (Median)",
  "Lines of Code (Min)",
  "Lines of Code (Max)",
  "Files Changed (Total)",
  "Files Changed (Avg)",
  "Files Changed (Median)",
  "Files Changed (Min)",
  "Files Changed (Max)",
  "Recorded At",
];

const PR_SIZE_DETAIL_HEADERS = [
  "PR #",
  "Title",
  "Repository",
  "Created At",
  "Merged At",
  "Additions",
  "Deletions",
  "Lines of Code",
  "Files Changed",
];

/**
 * PRサイズ指標をスプレッドシートに書き出す
 *
 * 2つのシートを作成/更新:
 * - "PR Size": サマリー情報
 * - "PR Size - Details": 各PRの詳細
 */
export function writePRSizeToSheet(
  spreadsheetId: string,
  metrics: PRSizeMetrics
): void {
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(spreadsheetId);

  // サマリーシート
  let summarySheet = spreadsheet.getSheetByName(PR_SIZE_SHEET_NAME);
  if (!summarySheet) {
    summarySheet = spreadsheet.insertSheet(PR_SIZE_SHEET_NAME);
    summarySheet.getRange(1, 1, 1, PR_SIZE_HEADERS.length).setValues([PR_SIZE_HEADERS]);
    summarySheet.getRange(1, 1, 1, PR_SIZE_HEADERS.length).setFontWeight("bold");
    summarySheet.setFrozenRows(1);
  }

  const summaryRow = [
    metrics.period,
    metrics.prCount,
    metrics.linesOfCode.total,
    metrics.linesOfCode.avg ?? "N/A",
    metrics.linesOfCode.median ?? "N/A",
    metrics.linesOfCode.min ?? "N/A",
    metrics.linesOfCode.max ?? "N/A",
    metrics.filesChanged.total,
    metrics.filesChanged.avg ?? "N/A",
    metrics.filesChanged.median ?? "N/A",
    metrics.filesChanged.min ?? "N/A",
    metrics.filesChanged.max ?? "N/A",
    new Date().toISOString(),
  ];

  const lastRow = summarySheet.getLastRow();
  summarySheet.getRange(lastRow + 1, 1, 1, PR_SIZE_HEADERS.length).setValues([summaryRow]);

  // 数値フォーマット（新しく追加した行を含む）
  const newLastRow = summarySheet.getLastRow();
  if (newLastRow > 1) {
    // 整数列（Total）
    summarySheet.getRange(2, 3, newLastRow - 1, 1).setNumberFormat("#,##0");
    summarySheet.getRange(2, 8, newLastRow - 1, 1).setNumberFormat("#,##0");
    // 小数列（Avg, Median, Min, Max）
    summarySheet.getRange(2, 4, newLastRow - 1, 4).setNumberFormat("#,##0.0");
    summarySheet.getRange(2, 9, newLastRow - 1, 4).setNumberFormat("#,##0.0");
  }

  // 列幅の自動調整
  for (let i = 1; i <= PR_SIZE_HEADERS.length; i++) {
    summarySheet.autoResizeColumn(i);
  }

  // 詳細シート
  const detailSheetName = `${PR_SIZE_SHEET_NAME} - Details`;
  let detailSheet = spreadsheet.getSheetByName(detailSheetName);
  if (!detailSheet) {
    detailSheet = spreadsheet.insertSheet(detailSheetName);
    detailSheet.getRange(1, 1, 1, PR_SIZE_DETAIL_HEADERS.length).setValues([PR_SIZE_DETAIL_HEADERS]);
    detailSheet.getRange(1, 1, 1, PR_SIZE_DETAIL_HEADERS.length).setFontWeight("bold");
    detailSheet.setFrozenRows(1);
  }

  if (metrics.prDetails.length > 0) {
    const detailRows = metrics.prDetails.map((pr) => [
      pr.prNumber,
      pr.title,
      pr.repository,
      pr.createdAt,
      pr.mergedAt ?? "Not merged",
      pr.additions,
      pr.deletions,
      pr.linesOfCode,
      pr.filesChanged,
    ]);

    const detailLastRow = detailSheet.getLastRow();
    detailSheet.getRange(detailLastRow + 1, 1, detailRows.length, PR_SIZE_DETAIL_HEADERS.length).setValues(detailRows);

    // 数値フォーマット
    const detailNewLastRow = detailSheet.getLastRow();
    if (detailNewLastRow > 1) {
      detailSheet.getRange(2, 6, detailNewLastRow - 1, 4).setNumberFormat("#,##0");
    }

    // 列幅の自動調整
    for (let i = 1; i <= PR_SIZE_DETAIL_HEADERS.length; i++) {
      detailSheet.autoResizeColumn(i);
    }
  }

  logger.log(`📝 Wrote PR size metrics to sheet "${PR_SIZE_SHEET_NAME}"`);
}

const DEVELOPER_SATISFACTION_SHEET_NAME = "Developer Satisfaction";
const DEVELOPER_SATISFACTION_HEADERS = [
  "Period",
  "Task Count",
  "Satisfaction (Avg)",
  "Satisfaction (Median)",
  "Satisfaction (Min)",
  "Satisfaction (Max)",
  "★1 Count",
  "★2 Count",
  "★3 Count",
  "★4 Count",
  "★5 Count",
  "Recorded At",
];

const DEVELOPER_SATISFACTION_DETAIL_HEADERS = [
  "Task ID",
  "Title",
  "Assignee",
  "Completed At",
  "Satisfaction",
];

/**
 * 開発者満足度指標をスプレッドシートに書き出す
 *
 * 2つのシートを作成/更新:
 * - "Developer Satisfaction": サマリー情報
 * - "Developer Satisfaction - Details": 各タスクの詳細
 */
export function writeDeveloperSatisfactionToSheet(
  spreadsheetId: string,
  metrics: DeveloperSatisfactionMetrics
): void {
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(spreadsheetId);

  // サマリーシート
  let summarySheet = spreadsheet.getSheetByName(DEVELOPER_SATISFACTION_SHEET_NAME);
  if (!summarySheet) {
    summarySheet = spreadsheet.insertSheet(DEVELOPER_SATISFACTION_SHEET_NAME);
    summarySheet.getRange(1, 1, 1, DEVELOPER_SATISFACTION_HEADERS.length).setValues([DEVELOPER_SATISFACTION_HEADERS]);
    summarySheet.getRange(1, 1, 1, DEVELOPER_SATISFACTION_HEADERS.length).setFontWeight("bold");
    summarySheet.setFrozenRows(1);
  }

  const dist = metrics.satisfaction.distribution;
  const summaryRow = [
    metrics.period,
    metrics.taskCount,
    metrics.satisfaction.avg ?? "N/A",
    metrics.satisfaction.median ?? "N/A",
    metrics.satisfaction.min ?? "N/A",
    metrics.satisfaction.max ?? "N/A",
    dist.star1,
    dist.star2,
    dist.star3,
    dist.star4,
    dist.star5,
    new Date().toISOString(),
  ];

  const lastRow = summarySheet.getLastRow();
  summarySheet.getRange(lastRow + 1, 1, 1, DEVELOPER_SATISFACTION_HEADERS.length).setValues([summaryRow]);

  // 数値フォーマット
  const newLastRow = summarySheet.getLastRow();
  if (newLastRow > 1) {
    // 小数列（Avg, Median, Min, Max）
    summarySheet.getRange(2, 3, newLastRow - 1, 4).setNumberFormat("#,##0.0");
    // 整数列（★1〜★5）
    summarySheet.getRange(2, 7, newLastRow - 1, 5).setNumberFormat("#,##0");
  }

  // 列幅の自動調整
  for (let i = 1; i <= DEVELOPER_SATISFACTION_HEADERS.length; i++) {
    summarySheet.autoResizeColumn(i);
  }

  // 詳細シート
  const detailSheetName = `${DEVELOPER_SATISFACTION_SHEET_NAME} - Details`;
  let detailSheet = spreadsheet.getSheetByName(detailSheetName);
  if (!detailSheet) {
    detailSheet = spreadsheet.insertSheet(detailSheetName);
    detailSheet.getRange(1, 1, 1, DEVELOPER_SATISFACTION_DETAIL_HEADERS.length).setValues([DEVELOPER_SATISFACTION_DETAIL_HEADERS]);
    detailSheet.getRange(1, 1, 1, DEVELOPER_SATISFACTION_DETAIL_HEADERS.length).setFontWeight("bold");
    detailSheet.setFrozenRows(1);
  }

  if (metrics.taskDetails.length > 0) {
    const detailRows = metrics.taskDetails.map((task) => [
      task.taskId,
      task.title,
      task.assignee ?? "Unassigned",
      task.completedAt,
      `★${task.satisfactionScore}`,
    ]);

    const detailLastRow = detailSheet.getLastRow();
    detailSheet.getRange(detailLastRow + 1, 1, detailRows.length, DEVELOPER_SATISFACTION_DETAIL_HEADERS.length).setValues(detailRows);

    // 列幅の自動調整
    for (let i = 1; i <= DEVELOPER_SATISFACTION_DETAIL_HEADERS.length; i++) {
      detailSheet.autoResizeColumn(i);
    }
  }

  logger.log(`📝 Wrote developer satisfaction metrics to sheet "${DEVELOPER_SATISFACTION_SHEET_NAME}"`);
}
