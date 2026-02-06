/**
 * シートフォーマット機能
 */

import type { Sheet } from '../../interfaces';
import type { SheetSchema } from '../../schemas';
import { getHeadersFromSchema } from '../../schemas';

/**
 * シートを初期化（ヘッダー設定とフォーマット適用）
 */
export function initializeSheet(sheet: Sheet, schema: SheetSchema): void {
  const headers = getHeadersFromSchema(schema);

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // 列幅の自動調整
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
}

/**
 * シートにフォーマットを適用
 */
export function applySheetFormat(sheet: Sheet, schema: SheetSchema): void {
  const lastRow = sheet.getLastRow();

  // ヘッダー行のフォーマット
  sheet.getRange(1, 1, 1, schema.columns.length).setFontWeight('bold');
  sheet.setFrozenRows(1);

  // 数値フォーマットを適用
  if (lastRow > 1) {
    for (let i = 0; i < schema.columns.length; i++) {
      const column = schema.columns[i];
      if (column.numberFormat) {
        sheet.getRange(2, i + 1, lastRow - 1, 1).setNumberFormat(column.numberFormat);
      }
    }
  }

  // 列幅の自動調整
  for (let i = 1; i <= schema.columns.length; i++) {
    sheet.autoResizeColumn(i);
  }
}
