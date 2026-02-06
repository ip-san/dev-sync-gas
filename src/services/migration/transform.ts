/**
 * データ変換機能
 */

import type { ColumnMapping } from './types';

/**
 * 旧データを新スキーマに変換
 */
export function migrateData(oldData: unknown[][], mappings: ColumnMapping[]): unknown[][] {
  const newData: unknown[][] = [];

  // ヘッダー行を生成
  const newHeaders = mappings.map((m) => m.column.header);
  newData.push(newHeaders);

  // データ行を変換（ヘッダー行をスキップ）
  for (let rowIndex = 1; rowIndex < oldData.length; rowIndex++) {
    const oldRow = oldData[rowIndex];
    const newRow: unknown[] = [];

    for (const mapping of mappings) {
      if (mapping.oldIndex >= 0 && mapping.oldIndex < oldRow.length) {
        // 既存データを移動
        const value = oldRow[mapping.oldIndex];
        newRow.push(value ?? mapping.column.defaultValue ?? '');
      } else {
        // 新規カラム：デフォルト値を設定
        newRow.push(mapping.column.defaultValue ?? '');
      }
    }

    newData.push(newRow);
  }

  return newData;
}
