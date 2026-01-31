/**
 * スプレッドシート操作の共通ヘルパー
 *
 * シート操作の共通パターンを抽象化したユーティリティ関数群。
 */

import type { Sheet, Spreadsheet } from '../../interfaces';
import { getContainer } from '../../container';

// デザイン定数
export const COLORS = {
  // ヘッダー
  headerBackground: '#4a5568', // ダークグレー
  headerText: '#ffffff', // 白
  // ステータス
  good: '#c6f6d5', // ライトグリーン
  warning: '#fefcbf', // ライトイエロー
  critical: '#fed7d7', // ライトレッド
  // ボーダー
  border: '#cbd5e0', // グレー
  // 全体平均行
  summaryBackground: '#edf2f7', // ライトグレー
} as const;

/**
 * シートを取得または作成し、ヘッダーを設定する
 *
 * @param spreadsheet - スプレッドシートオブジェクト
 * @param sheetName - シート名
 * @param headers - ヘッダー行の配列
 * @returns 取得または新規作成されたシート
 */
export function getOrCreateSheet(
  spreadsheet: Spreadsheet,
  sheetName: string,
  headers: string[]
): Sheet {
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    styleHeaderRow(sheet, headers.length);
  }

  return sheet;
}

/**
 * シートの列幅を自動調整する
 *
 * @param sheet - 対象シート
 * @param columnCount - 調整する列数
 */
export function autoResizeColumns(sheet: Sheet, columnCount: number): void {
  for (let i = 1; i <= columnCount; i++) {
    sheet.autoResizeColumn(i);
  }
}

/**
 * スプレッドシートをIDで開く
 *
 * @param spreadsheetId - スプレッドシートID
 * @returns スプレッドシートオブジェクト
 */
export function openSpreadsheet(spreadsheetId: string): Spreadsheet {
  const { spreadsheetClient } = getContainer();
  return spreadsheetClient.openById(spreadsheetId);
}

/**
 * 数値列のフォーマットを設定する（小数点1桁）
 *
 * @param sheet - 対象シート
 * @param startColumn - 開始列（1-indexed）
 * @param columnCount - 列数
 */
export function formatDecimalColumns(sheet: Sheet, startColumn: number, columnCount: number): void {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, startColumn, lastRow - 1, columnCount).setNumberFormat('#,##0.0');
  }
}

/**
 * 数値列のフォーマットを設定する（整数）
 *
 * @param sheet - 対象シート
 * @param startColumn - 開始列（1-indexed）
 * @param columnCount - 列数
 */
export function formatIntegerColumns(sheet: Sheet, startColumn: number, columnCount: number): void {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, startColumn, lastRow - 1, columnCount).setNumberFormat('#,##0');
  }
}

/**
 * ヘッダー行にスタイルを適用する
 *
 * @param sheet - 対象シート
 * @param columnCount - 列数
 */
export function styleHeaderRow(sheet: Sheet, columnCount: number): void {
  const headerRange = sheet.getRange(1, 1, 1, columnCount);
  headerRange.setFontWeight('bold');
  headerRange.setBackground(COLORS.headerBackground);
  headerRange.setFontColor(COLORS.headerText);
  headerRange.setHorizontalAlignment('center');
  headerRange.setBorder(true, true, true, true, false, false, COLORS.border, 'solid');
  sheet.setFrozenRows(1);
}

/**
 * データ範囲にボーダーを適用する
 *
 * @param sheet - 対象シート
 * @param rowCount - データ行数（ヘッダー除く）
 * @param columnCount - 列数
 */
export function applyDataBorders(sheet: Sheet, rowCount: number, columnCount: number): void {
  if (rowCount <= 0) {
    return;
  }
  const dataRange = sheet.getRange(2, 1, rowCount, columnCount);
  dataRange.setBorder(true, true, true, true, true, true, COLORS.border, 'solid');
}

/**
 * 全体平均/サマリー行にスタイルを適用する
 *
 * @param sheet - 対象シート
 * @param rowNumber - 行番号（1-indexed）
 * @param columnCount - 列数
 */
export function styleSummaryRow(sheet: Sheet, rowNumber: number, columnCount: number): void {
  const summaryRange = sheet.getRange(rowNumber, 1, 1, columnCount);
  summaryRange.setFontWeight('bold');
  summaryRange.setBackground(COLORS.summaryBackground);
}
