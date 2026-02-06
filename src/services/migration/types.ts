/**
 * マイグレーション内部型定義
 */

import type { ColumnDefinition, SheetSchema } from '../../schemas';
import type { Sheet } from '../../interfaces';

/**
 * カラムマッピング情報
 */
export interface ColumnMapping {
  /** 新スキーマでのカラムインデックス */
  newIndex: number;
  /** 旧データでのカラムインデックス（-1 = 新規カラム） */
  oldIndex: number;
  /** カラム定義 */
  column: ColumnDefinition;
}

/**
 * データマイグレーションのパラメータ
 */
export interface PerformDataMigrationParams {
  sheet: Sheet;
  oldData: unknown[][];
  oldHeaders: string[];
  schema: SheetSchema;
  targetHeaders: string[];
  lastRow: number;
  duration: number;
}

/**
 * マイグレーションエラー処理のパラメータ
 */
export interface HandleMigrationErrorParams {
  error: unknown;
  spreadsheet: import('../../interfaces').Spreadsheet;
  schema: SheetSchema;
  backup: { backupSheet: Sheet; backupName: string } | null;
  duration: number;
}
