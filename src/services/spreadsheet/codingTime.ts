/**
 * コーディング時間指標スプレッドシート操作
 *
 * Issue作成からPR作成までの時間を計測した結果を
 * スプレッドシートに書き出す機能を提供。
 */

import type { CodingTimeMetrics } from "../../types";
import { getContainer } from "../../container";
import {
  getOrCreateSheet,
  autoResizeColumns,
  openSpreadsheet,
  formatDecimalColumns,
} from "./helpers";

const SHEET_NAME = "コーディング時間";

/**
 * サマリーシートのヘッダー定義
 */
const SUMMARY_HEADERS = [
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
 * 詳細シートのヘッダー定義
 */
const DETAIL_HEADERS = [
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
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);

  writeSummarySheet(spreadsheet, metrics);
  writeDetailSheet(spreadsheet, metrics);

  logger.log(`📝 Wrote coding time metrics to sheet "${SHEET_NAME}"`);
}

/**
 * サマリーシートに書き込み
 */
function writeSummarySheet(
  spreadsheet: ReturnType<typeof openSpreadsheet>,
  metrics: CodingTimeMetrics
): void {
  const sheet = getOrCreateSheet(spreadsheet, SHEET_NAME, SUMMARY_HEADERS);

  const avgDays = metrics.avgCodingTimeHours !== null
    ? Math.round((metrics.avgCodingTimeHours / 24) * 10) / 10
    : "N/A";

  const row = [
    metrics.period,
    metrics.issueCount,
    metrics.avgCodingTimeHours ?? "N/A",
    avgDays,
    metrics.medianCodingTimeHours ?? "N/A",
    metrics.minCodingTimeHours ?? "N/A",
    metrics.maxCodingTimeHours ?? "N/A",
    new Date().toISOString(),
  ];

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, SUMMARY_HEADERS.length).setValues([row]);

  formatDecimalColumns(sheet, 3, 5);
  autoResizeColumns(sheet, SUMMARY_HEADERS.length);
}

/**
 * 詳細シートに書き込み
 */
function writeDetailSheet(
  spreadsheet: ReturnType<typeof openSpreadsheet>,
  metrics: CodingTimeMetrics
): void {
  if (metrics.issueDetails.length === 0) return;

  const detailSheetName = `${SHEET_NAME} - Details`;
  const sheet = getOrCreateSheet(spreadsheet, detailSheetName, DETAIL_HEADERS);

  const rows = metrics.issueDetails.map((issue) => [
    `#${issue.issueNumber}`,
    issue.title,
    issue.repository,
    issue.issueCreatedAt,
    issue.prCreatedAt,
    `#${issue.prNumber}`,
    issue.codingTimeHours,
    Math.round((issue.codingTimeHours / 24) * 10) / 10,
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, DETAIL_HEADERS.length).setValues(rows);

  // コーディング時間列（7〜8列目）を小数点1桁でフォーマット
  formatDecimalColumns(sheet, 7, 2);
  autoResizeColumns(sheet, DETAIL_HEADERS.length);
}
