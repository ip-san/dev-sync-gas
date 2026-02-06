/**
 * カラムマッピング機能
 */

import type { SheetSchema } from '../../schemas';
import { getHeadersFromSchema } from '../../schemas';
import type { ColumnMapping } from './types';

/**
 * 旧ヘッダーから新スキーマへのカラムマッピングを作成
 */
export function createColumnMapping(oldHeaders: string[], schema: SheetSchema): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  for (let newIndex = 0; newIndex < schema.columns.length; newIndex++) {
    const column = schema.columns[newIndex];

    // 1. まず現在のヘッダー名で探す
    let oldIndex = oldHeaders.indexOf(column.header);

    // 2. 見つからない場合、カラムIDをヘッダーとして探す（フォールバック）
    if (oldIndex === -1) {
      oldIndex = oldHeaders.indexOf(column.id);
    }

    mappings.push({ newIndex, oldIndex, column });
  }

  return mappings;
}

/**
 * 削除されるカラム（新スキーマに含まれないカラム）を検出
 */
export function findRemovedColumns(oldHeaders: string[], schema: SheetSchema): string[] {
  const targetHeaders = getHeadersFromSchema(schema);
  const targetSet = new Set(targetHeaders);
  const columnIds = new Set(schema.columns.map((c) => c.id));

  return oldHeaders.filter((h) => !targetSet.has(h) && !columnIds.has(h));
}
