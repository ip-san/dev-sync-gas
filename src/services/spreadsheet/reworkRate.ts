/**
 * 手戻り率指標スプレッドシート操作
 *
 * PR作成後の追加コミット数とForce Push回数を計測した結果を
 * スプレッドシートに書き出す機能を提供。
 */

import type { ReworkRateMetrics } from "../../types";
import { getContainer } from "../../container";
import {
  getOrCreateSheet,
  autoResizeColumns,
  openSpreadsheet,
} from "./helpers";

const SHEET_NAME = "手戻り率";

/**
 * サマリーシートのヘッダー定義
 */
const SUMMARY_HEADERS = [
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
 * 詳細シートのヘッダー定義
 */
const DETAIL_HEADERS = [
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
 * - "手戻り率": サマリー情報
 * - "手戻り率 - Details": 各PRの詳細
 */
export function writeReworkRateToSheet(
  spreadsheetId: string,
  metrics: ReworkRateMetrics
): void {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);

  writeSummarySheet(spreadsheet, metrics);
  writeDetailSheet(spreadsheet, metrics);

  logger.log(`📝 Wrote rework rate metrics to sheet "${SHEET_NAME}"`);
}

/**
 * サマリーシートに書き込み
 */
function writeSummarySheet(
  spreadsheet: ReturnType<typeof openSpreadsheet>,
  metrics: ReworkRateMetrics
): void {
  const sheet = getOrCreateSheet(spreadsheet, SHEET_NAME, SUMMARY_HEADERS);

  const row = [
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

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, SUMMARY_HEADERS.length).setValues([row]);

  // フォーマット設定
  const newLastRow = sheet.getLastRow();
  if (newLastRow > 1) {
    // 追加コミット数の平均・中央値・最大（4〜6列目）
    sheet.getRange(2, 4, newLastRow - 1, 3).setNumberFormat("#,##0.0");
    // Force Push平均（8列目）
    sheet.getRange(2, 8, newLastRow - 1, 1).setNumberFormat("#,##0.0");
    // Force Push率（10列目）
    sheet.getRange(2, 10, newLastRow - 1, 1).setNumberFormat("#,##0.0");
  }

  autoResizeColumns(sheet, SUMMARY_HEADERS.length);
}

/**
 * 詳細シートに書き込み
 */
function writeDetailSheet(
  spreadsheet: ReturnType<typeof openSpreadsheet>,
  metrics: ReworkRateMetrics
): void {
  if (metrics.prDetails.length === 0) return;

  const detailSheetName = `${SHEET_NAME} - Details`;
  const sheet = getOrCreateSheet(spreadsheet, detailSheetName, DETAIL_HEADERS);

  const rows = metrics.prDetails.map((pr) => [
    pr.prNumber,
    pr.title,
    pr.repository,
    pr.createdAt,
    pr.mergedAt ?? "Not merged",
    pr.totalCommits,
    pr.additionalCommits,
    pr.forcePushCount,
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, DETAIL_HEADERS.length).setValues(rows);

  autoResizeColumns(sheet, DETAIL_HEADERS.length);
}
