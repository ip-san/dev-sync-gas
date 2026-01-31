/**
 * サイクルタイム指標スプレッドシート操作
 *
 * Issue作成からproductionマージまでの時間を計測した結果を
 * スプレッドシートに書き出す機能を提供。
 */

import type { CycleTimeMetrics } from "../../types";
import { getContainer } from "../../container";
import {
  getOrCreateSheet,
  autoResizeColumns,
  openSpreadsheet,
  formatDecimalColumns,
} from "./helpers";

const SHEET_NAME = "サイクルタイム";

/**
 * サマリーシートのヘッダー定義
 */
const SUMMARY_HEADERS = [
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
 * 詳細シートのヘッダー定義
 */
const DETAIL_HEADERS = [
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
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);

  writeSummarySheet(spreadsheet, metrics);
  writeDetailSheet(spreadsheet, metrics);

  logger.log(`📝 Wrote cycle time metrics to sheet "${SHEET_NAME}"`);
}

/**
 * サマリーシートに書き込み
 */
function writeSummarySheet(
  spreadsheet: ReturnType<typeof openSpreadsheet>,
  metrics: CycleTimeMetrics
): void {
  const sheet = getOrCreateSheet(spreadsheet, SHEET_NAME, SUMMARY_HEADERS);

  const avgDays = metrics.avgCycleTimeHours !== null
    ? Math.round((metrics.avgCycleTimeHours / 24) * 10) / 10
    : "N/A";

  const row = [
    metrics.period,
    metrics.completedTaskCount,
    metrics.avgCycleTimeHours ?? "N/A",
    avgDays,
    metrics.medianCycleTimeHours ?? "N/A",
    metrics.minCycleTimeHours ?? "N/A",
    metrics.maxCycleTimeHours ?? "N/A",
    new Date().toISOString(),
  ];

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, SUMMARY_HEADERS.length).setValues([row]);

  // 数値列（3〜7列目）を小数点1桁でフォーマット
  formatDecimalColumns(sheet, 3, 5);
  autoResizeColumns(sheet, SUMMARY_HEADERS.length);
}

/**
 * 詳細シートに書き込み
 */
function writeDetailSheet(
  spreadsheet: ReturnType<typeof openSpreadsheet>,
  metrics: CycleTimeMetrics
): void {
  if (metrics.issueDetails.length === 0) return;

  const detailSheetName = `${SHEET_NAME} - Details`;
  const sheet = getOrCreateSheet(spreadsheet, detailSheetName, DETAIL_HEADERS);

  const rows = metrics.issueDetails.map((issue) => [
    `#${issue.issueNumber}`,
    issue.title,
    issue.repository,
    issue.issueCreatedAt,
    issue.productionMergedAt,
    issue.cycleTimeHours,
    Math.round((issue.cycleTimeHours / 24) * 10) / 10,
    issue.prChainSummary,
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, DETAIL_HEADERS.length).setValues(rows);

  // サイクルタイム列（6〜7列目）を小数点1桁でフォーマット
  formatDecimalColumns(sheet, 6, 2);
  autoResizeColumns(sheet, DETAIL_HEADERS.length);
}
