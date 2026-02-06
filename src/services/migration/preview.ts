/**
 * マイグレーションプレビュー機能
 */

import type { Spreadsheet } from '../../interfaces';
import type { SheetSchema, MigrationPreview } from '../../schemas';
import { getHeadersFromSchema } from '../../schemas';

/**
 * シートのマイグレーションプレビューを取得
 */
export function getMigrationPreview(
  spreadsheet: Spreadsheet,
  schema: SheetSchema
): MigrationPreview {
  const sheet = spreadsheet.getSheetByName(schema.sheetName);
  const targetHeaders = getHeadersFromSchema(schema);

  if (!sheet) {
    return {
      sheetName: schema.sheetName,
      exists: false,
      currentHeaders: [],
      targetHeaders,
      status: 'new_sheet',
      changes: { added: targetHeaders, removed: [], reordered: false },
      rowCount: 0,
    };
  }

  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    return {
      sheetName: schema.sheetName,
      exists: true,
      currentHeaders: [],
      targetHeaders,
      status: 'new_sheet',
      changes: { added: targetHeaders, removed: [], reordered: false },
      rowCount: 0,
    };
  }

  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] as string[];

  const changes = analyzeChanges(currentHeaders, targetHeaders);
  const status =
    changes.added.length === 0 && changes.removed.length === 0 && !changes.reordered
      ? 'up_to_date'
      : 'migration_required';

  return {
    sheetName: schema.sheetName,
    exists: true,
    currentHeaders,
    targetHeaders,
    status,
    changes,
    rowCount: lastRow - 1, // ヘッダー行を除く
  };
}

/**
 * ヘッダーの変更を分析
 */
export function analyzeChanges(
  currentHeaders: string[],
  targetHeaders: string[]
): { added: string[]; removed: string[]; reordered: boolean } {
  const currentSet = new Set(currentHeaders);
  const targetSet = new Set(targetHeaders);

  const added = targetHeaders.filter((h) => !currentSet.has(h));
  const removed = currentHeaders.filter((h) => !targetSet.has(h));

  // 並び順の変更を検出
  let reordered = false;
  if (added.length === 0 && removed.length === 0) {
    for (let i = 0; i < targetHeaders.length; i++) {
      if (currentHeaders[i] !== targetHeaders[i]) {
        reordered = true;
        break;
      }
    }
  }

  return { added, removed, reordered };
}
