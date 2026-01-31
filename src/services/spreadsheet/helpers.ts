/**
 * スプレッドシート操作の共通ヘルパー
 *
 * シート操作の共通パターンを抽象化したユーティリティ関数群。
 */

import type { Sheet, Spreadsheet } from '../../interfaces';
import { getContainer } from '../../container';

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
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
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
