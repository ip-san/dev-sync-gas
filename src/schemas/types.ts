/**
 * スプレッドシートのスキーマ定義 - 型定義
 *
 * 各シートの列構造を定義する際に使用する共通型。
 * カラムIDは内部識別子として使用し、ヘッダー名が変更されても
 * データの対応付けができるようにする。
 */

/**
 * カラム定義
 */
export interface ColumnDefinition {
  /** カラムの一意識別子（内部用、変更不可） */
  id: string;
  /** 表示用ヘッダー名（日本語、変更可能） */
  header: string;
  /** カラムの型 */
  type: 'string' | 'number' | 'date';
  /** 新規追加時のデフォルト値 */
  defaultValue?: unknown;
  /** 数値フォーマット（GASのsetNumberFormat用） */
  numberFormat?: string;
}

/**
 * シートスキーマ定義
 */
export interface SheetSchema {
  /** スキーマバージョン */
  version: string;
  /** シート名 */
  sheetName: string;
  /** カラム定義（順序が重要） */
  columns: ColumnDefinition[];
}

/**
 * マイグレーション結果
 */
export interface MigrationResult {
  sheetName: string;
  success: boolean;
  status: 'migrated' | 'created' | 'up_to_date' | 'skipped' | 'error';
  fromVersion?: string;
  toVersion: string;
  rowsMigrated: number;
  columnsAdded: string[];
  columnsRemoved: string[];
  columnsRenamed: Array<{ from: string; to: string }>;
  duration: number;
  error?: string;
}

/**
 * マイグレーションプレビュー
 */
export interface MigrationPreview {
  sheetName: string;
  exists: boolean;
  currentHeaders: string[];
  targetHeaders: string[];
  status: 'migration_required' | 'up_to_date' | 'new_sheet';
  changes: {
    added: string[];
    removed: string[];
    reordered: boolean;
  };
  rowCount: number;
}
