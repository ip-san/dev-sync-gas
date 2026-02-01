/**
 * スプレッドシート操作の共通ヘルパー
 *
 * シート操作の共通パターンを抽象化したユーティリティ関数群。
 */

import type { Sheet, Spreadsheet } from '../../interfaces';
import { getContainer } from '../../container';
import { SpreadsheetError, ErrorCode } from '../../utils/errors';

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
    try {
      sheet = spreadsheet.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      styleHeaderRow(sheet, headers.length);
    } catch (error) {
      throw new SpreadsheetError(`Failed to create sheet: ${sheetName}`, {
        code: ErrorCode.SHEET_CREATION_FAILED,
        context: { sheetName, spreadsheetName: spreadsheet.getName(), headerCount: headers.length },
        cause: error as Error,
      });
    }
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
  const { spreadsheetClient, logger } = getContainer();
  try {
    return spreadsheetClient.openById(spreadsheetId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to open spreadsheet (${spreadsheetId}): ${errorMessage}`);

    throw new SpreadsheetError('Failed to open spreadsheet', {
      code: ErrorCode.SPREADSHEET_ACCESS_DENIED,
      context: { spreadsheetId },
      cause: error as Error,
    });
  }
}

/**
 * 数値列のフォーマットを設定する（小数点1桁）
 *
 * @param sheet - 対象シート
 * @param startColumn - 開始列（1-indexed）
 * @param columnCount - 列数
 */
export function formatDecimalColumns(sheet: Sheet, startColumn: number, columnCount: number): void {
  const sheetName = sheet.getName();
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, startColumn, lastRow - 1, columnCount).setNumberFormat('#,##0.0');
    }
  } catch (error) {
    throw new SpreadsheetError('Failed to format decimal columns', {
      code: ErrorCode.SPREADSHEET_FORMAT_ERROR,
      context: { startColumn, columnCount, sheetName },
      cause: error as Error,
    });
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
  const sheetName = sheet.getName();
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, startColumn, lastRow - 1, columnCount).setNumberFormat('#,##0');
    }
  } catch (error) {
    throw new SpreadsheetError('Failed to format integer columns', {
      code: ErrorCode.SPREADSHEET_FORMAT_ERROR,
      context: { startColumn, columnCount, sheetName },
      cause: error as Error,
    });
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
  headerRange.setBorder({
    top: true,
    left: true,
    bottom: true,
    right: true,
    vertical: false,
    horizontal: false,
    color: COLORS.border,
    style: 'solid',
  });
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
  dataRange.setBorder({
    top: true,
    left: true,
    bottom: true,
    right: true,
    vertical: true,
    horizontal: true,
    color: COLORS.border,
    style: 'solid',
  });
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
