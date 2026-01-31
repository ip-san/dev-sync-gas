/**
 * PRサイズ指標スプレッドシート操作
 *
 * PRの変更規模（行数・ファイル数）を計測した結果を
 * スプレッドシートに書き出す機能を提供。
 */

import type { PRSizeMetrics } from "../../types";
import { getContainer } from "../../container";
import {
  getOrCreateSheet,
  autoResizeColumns,
  openSpreadsheet,
  formatDecimalColumns,
  formatIntegerColumns,
} from "./helpers";

const SHEET_NAME = "PRサイズ";

/**
 * サマリーシートのヘッダー定義
 */
const SUMMARY_HEADERS = [
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
 * 詳細シートのヘッダー定義
 */
const DETAIL_HEADERS = [
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
 * - "PRサイズ": サマリー情報
 * - "PRサイズ - Details": 各PRの詳細
 */
export function writePRSizeToSheet(
  spreadsheetId: string,
  metrics: PRSizeMetrics
): void {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);

  writeSummarySheet(spreadsheet, metrics);
  writeDetailSheet(spreadsheet, metrics);

  logger.log(`📝 Wrote PR size metrics to sheet "${SHEET_NAME}"`);
}

/**
 * サマリーシートに書き込み
 */
function writeSummarySheet(
  spreadsheet: ReturnType<typeof openSpreadsheet>,
  metrics: PRSizeMetrics
): void {
  const sheet = getOrCreateSheet(spreadsheet, SHEET_NAME, SUMMARY_HEADERS);

  const row = [
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

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, SUMMARY_HEADERS.length).setValues([row]);

  // フォーマット: 整数列（Total）と小数列（Avg, Median, Min, Max）
  formatIntegerColumns(sheet, 3, 1);  // 変更行数 合計
  formatIntegerColumns(sheet, 8, 1);  // ファイル数 合計
  formatDecimalColumns(sheet, 4, 4);  // 変更行数 平均〜最大
  formatDecimalColumns(sheet, 9, 4);  // ファイル数 平均〜最大

  autoResizeColumns(sheet, SUMMARY_HEADERS.length);
}

/**
 * 詳細シートに書き込み
 */
function writeDetailSheet(
  spreadsheet: ReturnType<typeof openSpreadsheet>,
  metrics: PRSizeMetrics
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
    pr.additions,
    pr.deletions,
    pr.linesOfCode,
    pr.filesChanged,
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, DETAIL_HEADERS.length).setValues(rows);

  // 数値列（6-9列目）を整数でフォーマット
  formatIntegerColumns(sheet, 6, 4);
  autoResizeColumns(sheet, DETAIL_HEADERS.length);
}
