import type { DevOpsMetrics, CycleTimeMetrics, CodingTimeMetrics, ReworkRateMetrics, ReviewEfficiencyMetrics, PRSizeMetrics } from "../types";
import type { Sheet } from "../interfaces";
import { getContainer } from "../container";

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

  /**
   * サマリーシートのヘッダー定義
   * リポジトリごとの集計値を表示
   */
  const summaryHeaders = [
    "リポジトリ",              // 対象リポジトリ名
    "平均デプロイ頻度",        // 平均デプロイ回数/日
    "平均リードタイム (時間)", // 平均リードタイム
    "平均変更障害率 (%)",      // 平均変更障害率
    "平均復旧時間 (時間)",     // 平均MTTR
    "最終更新日時",            // 最後に更新された日時
  ];

  summarySheet.getRange(1, 1, 1, summaryHeaders.length).setValues([summaryHeaders]);
  summarySheet.getRange(1, 1, 1, summaryHeaders.length).setFontWeight("bold");
}

const CYCLE_TIME_SHEET_NAME = "サイクルタイム";

/**
 * サイクルタイム シートのヘッダー定義
 * GitHub Issue作成からproductionマージまでの時間を計測
 */
const CYCLE_TIME_HEADERS = [
  "期間",                    // 計測期間
  "完了Issue数",             // 期間内にproductionマージされたIssueの数
  "平均サイクルタイム (時間)", // 全Issueの平均値
  "平均サイクルタイム (日)",   // 日単位での平均値
  "中央値 (時間)",           // ソート後の中央値（外れ値の影響を受けにくい）
  "最小 (時間)",             // 最も短かったIssue
  "最大 (時間)",             // 最も長かったIssue
  "記録日時",                // データ記録時刻
];

/**
 * サイクルタイム詳細シートのヘッダー定義
 */
const CYCLE_TIME_DETAIL_HEADERS = [
  "Issue番号",               // GitHubのIssue番号
  "タイトル",                // Issue名
  "リポジトリ",              // 対象リポジトリ
  "Issue作成日時",           // Issue作成日時（着手日）
  "Productionマージ日時",    // productionマージ日時（完了日）
  "サイクルタイム (時間)",   // Issue作成からマージまでの時間
  "サイクルタイム (日)",     // 日単位でのサイクルタイム
  "PRチェーン",              // PRの連鎖（例: "#1→#2→#3"）
];

/**
 * サイクルタイム指標をスプレッドシートに書き出す
 *
 * 2つのシートを作成/更新:
 * - "サイクルタイム": サマリー情報
 * - "サイクルタイム - Details": 各Issueの詳細
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

  if (metrics.issueDetails.length > 0) {
    const detailRows = metrics.issueDetails.map((issue) => [
      `#${issue.issueNumber}`,
      issue.title,
      issue.repository,
      issue.issueCreatedAt,
      issue.productionMergedAt,
      issue.cycleTimeHours,
      Math.round((issue.cycleTimeHours / 24) * 10) / 10,
      issue.prChainSummary,
    ]);

    const detailLastRow = detailSheet.getLastRow();
    detailSheet.getRange(detailLastRow + 1, 1, detailRows.length, CYCLE_TIME_DETAIL_HEADERS.length).setValues(detailRows);

    // 数値フォーマット（新しく追加した行を含む）
    const newDetailLastRow = detailSheet.getLastRow();
    if (newDetailLastRow > 1) {
      detailSheet.getRange(2, 6, newDetailLastRow - 1, 2).setNumberFormat("#,##0.0");
    }

    // 列幅の自動調整
    for (let i = 1; i <= CYCLE_TIME_DETAIL_HEADERS.length; i++) {
      detailSheet.autoResizeColumn(i);
    }
  }

  logger.log(`📝 Wrote cycle time metrics to sheet "${CYCLE_TIME_SHEET_NAME}"`);
}

const CODING_TIME_SHEET_NAME = "コーディング時間";

/**
 * コーディング時間 シートのヘッダー定義
 * Issue作成からPR作成までの時間を計測
 */
const CODING_TIME_HEADERS = [
  "期間",                      // 計測期間
  "Issue数",                   // 計測対象Issue数
  "平均コーディング時間 (時間)", // 全Issueの平均値
  "平均コーディング時間 (日)",   // 日単位での平均値
  "中央値 (時間)",             // ソート後の中央値
  "最小 (時間)",               // 最も短かったIssue
  "最大 (時間)",               // 最も長かったIssue
  "記録日時",                  // データ記録時刻
];

/**
 * コーディング時間詳細シートのヘッダー定義
 */
const CODING_TIME_DETAIL_HEADERS = [
  "Issue番号",                 // GitHubのIssue番号
  "タイトル",                  // Issue名
  "リポジトリ",                // 対象リポジトリ
  "Issue作成日時",             // Issue作成日時（着手日）
  "PR作成日時",                // GitHubでPRを作成した日時
  "PR番号",                    // リンクされたPR番号
  "コーディング時間 (時間)",   // Issue作成からPR作成までの時間
  "コーディング時間 (日)",     // 日単位でのコーディング時間
];

/**
 * コーディング時間指標をスプレッドシートに書き出す
 *
 * 2つのシートを作成/更新:
 * - "コーディング時間": サマリー情報
 * - "コーディング時間 - Details": 各Issueの詳細
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
    metrics.issueCount,
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

  if (metrics.issueDetails.length > 0) {
    const detailRows = metrics.issueDetails.map((issue) => [
      `#${issue.issueNumber}`,
      issue.title,
      issue.repository,
      issue.issueCreatedAt,
      issue.prCreatedAt,
      `#${issue.prNumber}`,
      issue.codingTimeHours,
      Math.round((issue.codingTimeHours / 24) * 10) / 10,
    ]);

    const detailLastRow = detailSheet.getLastRow();
    detailSheet.getRange(detailLastRow + 1, 1, detailRows.length, CODING_TIME_DETAIL_HEADERS.length).setValues(detailRows);

    // 数値フォーマット（新しく追加した行を含む）
    const newDetailLastRow = detailSheet.getLastRow();
    if (newDetailLastRow > 1) {
      detailSheet.getRange(2, 7, newDetailLastRow - 1, 2).setNumberFormat("#,##0.0");
    }

    // 列幅の自動調整
    for (let i = 1; i <= CODING_TIME_DETAIL_HEADERS.length; i++) {
      detailSheet.autoResizeColumn(i);
    }
  }

  logger.log(`📝 Wrote coding time metrics to sheet "${CODING_TIME_SHEET_NAME}"`);
}

const REWORK_RATE_SHEET_NAME = "手戻り率";

/**
 * 手戻り率 シートのヘッダー定義
 * PR作成後の追加コミット数とForce Push回数を計測
 */
const REWORK_RATE_HEADERS = [
  "期間",                      // 計測期間
  "PR数",                      // 分析対象のPR数
  "追加コミット数 (合計)",     // 全PRの追加コミット数合計
  "追加コミット数 (平均)",     // PRあたりの平均値
  "追加コミット数 (中央値)",   // ソート後の中央値
  "追加コミット数 (最大)",     // 最も多かったPR
  "Force Push回数 (合計)",     // 全PRのForce Push回数合計
  "Force Push回数 (平均)",     // PRあたりの平均値
  "Force Pushがあった PR数",   // Force Pushが発生したPRの数
  "Force Push率 (%)",          // Force Pushが発生したPRの割合
  "記録日時",                  // データ記録時刻
];

/**
 * 手戻り率詳細シートのヘッダー定義
 */
const REWORK_RATE_DETAIL_HEADERS = [
  "PR番号",                    // GitHubのPR番号
  "タイトル",                  // PRタイトル
  "リポジトリ",                // 対象リポジトリ
  "作成日時",                  // PR作成日時
  "マージ日時",                // PRマージ日時
  "総コミット数",              // PRの総コミット数
  "追加コミット数",            // PR作成後の追加コミット数
  "Force Push回数",            // Force Push回数
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

const REVIEW_EFFICIENCY_SHEET_NAME = "レビュー効率";

/**
 * レビュー効率 シートのヘッダー定義
 * PRの各ステータスにおける滞留時間を計測
 */
const REVIEW_EFFICIENCY_HEADERS = [
  "期間",                            // 計測期間
  "PR数",                            // 分析対象のPR数
  "レビュー待ち時間 (平均)",         // Ready for Review → First Review
  "レビュー待ち時間 (中央値)",       // 外れ値の影響を受けにくい
  "レビュー待ち時間 (最小)",         // 最も早くレビューされたPR
  "レビュー待ち時間 (最大)",         // 最も待たされたPR
  "レビュー時間 (平均)",             // First Review → Approved
  "レビュー時間 (中央値)",           // コード理解・修正にかかる時間
  "レビュー時間 (最小)",             // 最も早く承認されたPR
  "レビュー時間 (最大)",             // 最も時間がかかったPR
  "マージ待ち時間 (平均)",           // Approved → Merged
  "マージ待ち時間 (中央値)",         // 承認後のプロセス時間
  "マージ待ち時間 (最小)",           // 最も早くマージされたPR
  "マージ待ち時間 (最大)",           // 最も待たされたPR
  "全体時間 (平均)",                 // Ready for Review → Merged
  "全体時間 (中央値)",               // PR完了までの総時間
  "全体時間 (最小)",                 // 最も早く完了したPR
  "全体時間 (最大)",                 // 最も時間がかかったPR
  "記録日時",                        // データ記録時刻
];

/**
 * レビュー効率詳細シートのヘッダー定義
 */
const REVIEW_EFFICIENCY_DETAIL_HEADERS = [
  "PR番号",                          // GitHubのPR番号
  "タイトル",                        // PRタイトル
  "リポジトリ",                      // 対象リポジトリ
  "作成日時",                        // PR作成日時
  "レビュー準備完了日時",            // Ready for Review になった日時
  "初回レビュー日時",                // 最初のレビューを受けた日時
  "承認日時",                        // Approvedになった日時
  "マージ日時",                      // マージされた日時
  "レビュー待ち時間 (時間)",         // Ready → First Review
  "レビュー時間 (時間)",             // First Review → Approved
  "マージ待ち時間 (時間)",           // Approved → Merged
  "全体時間 (時間)",                 // Ready → Merged
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

const PR_SIZE_SHEET_NAME = "PRサイズ";

/**
 * PRサイズ シートのヘッダー定義
 * PRの変更規模（行数・ファイル数）を計測
 */
const PR_SIZE_HEADERS = [
  "期間",                      // 計測期間
  "PR数",                      // 分析対象のPR数
  "変更行数 (合計)",           // 全PRの変更行数合計（additions + deletions）
  "変更行数 (平均)",           // PRあたりの平均値
  "変更行数 (中央値)",         // ソート後の中央値
  "変更行数 (最小)",           // 最も小さかったPR
  "変更行数 (最大)",           // 最も大きかったPR
  "変更ファイル数 (合計)",     // 全PRの変更ファイル数合計
  "変更ファイル数 (平均)",     // PRあたりの平均値
  "変更ファイル数 (中央値)",   // ソート後の中央値
  "変更ファイル数 (最小)",     // 最も少なかったPR
  "変更ファイル数 (最大)",     // 最も多かったPR
  "記録日時",                  // データ記録時刻
];

/**
 * PRサイズ詳細シートのヘッダー定義
 */
const PR_SIZE_DETAIL_HEADERS = [
  "PR番号",                    // GitHubのPR番号
  "タイトル",                  // PRタイトル
  "リポジトリ",                // 対象リポジトリ
  "作成日時",                  // PR作成日時
  "マージ日時",                // マージされた日時
  "追加行数",                  // 追加された行数
  "削除行数",                  // 削除された行数
  "変更行数",                  // additions + deletions
  "変更ファイル数",            // 変更されたファイル数
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
