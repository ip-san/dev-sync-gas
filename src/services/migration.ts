/**
 * スプレッドシートのスキーママイグレーション機能
 *
 * 既存シートのヘッダー更新、列追加、列順変更に対応する。
 * 全データ再書き込み方式を採用し、データの整合性を保証する。
 */

import { getContainer } from '../container';
import type { Sheet, Spreadsheet } from '../interfaces';
import {
  type SheetSchema,
  type MigrationResult,
  type MigrationPreview,
  type ColumnDefinition,
  getHeadersFromSchema,
} from '../schemas';

// =============================================================================
// 内部型定義
// =============================================================================

/**
 * カラムマッピング情報
 */
interface ColumnMapping {
  /** 新スキーマでのカラムインデックス */
  newIndex: number;
  /** 旧データでのカラムインデックス（-1 = 新規カラム） */
  oldIndex: number;
  /** カラム定義 */
  column: ColumnDefinition;
}

// =============================================================================
// マイグレーションプレビュー
// =============================================================================

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
function analyzeChanges(
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

// =============================================================================
// カラムマッピング
// =============================================================================

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

// =============================================================================
// データ変換
// =============================================================================

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

// =============================================================================
// バックアップ機能
// =============================================================================

/**
 * バックアップシート名を生成
 */
function getBackupSheetName(sheetName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `_backup_${sheetName}_${timestamp}`;
}

/**
 * シートのバックアップを作成
 */
function createBackup(
  spreadsheet: Spreadsheet,
  sheet: Sheet,
  sheetName: string
): { backupSheet: Sheet; backupName: string } | null {
  const { logger } = getContainer();

  try {
    const data = sheet.getDataRange().getValues();
    if (data.length === 0) {
      return null;
    }

    const backupName = getBackupSheetName(sheetName);
    const backupSheet = spreadsheet.insertSheet(backupName);

    const firstRow = data[0];
    backupSheet.getRange(1, 1, data.length, firstRow.length).setValues(data);

    logger.log(`📋 Backup created: ${backupName}`);
    return { backupSheet, backupName };
  } catch (error) {
    logger.log(
      `⚠️ Failed to create backup: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * バックアップからリストア
 */
function restoreFromBackup(sheet: Sheet, backupSheet: Sheet): boolean {
  const { logger } = getContainer();

  try {
    const backupData = backupSheet.getDataRange().getValues();
    if (backupData.length === 0) {
      return false;
    }

    sheet.clear();
    const firstRow = backupData[0];
    sheet.getRange(1, 1, backupData.length, firstRow.length).setValues(backupData);

    logger.log(`🔄 Restored from backup`);
    return true;
  } catch (error) {
    logger.log(
      `❌ Failed to restore from backup: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

// =============================================================================
// シートマイグレーション実行
// =============================================================================

/**
 * シートのスキーママイグレーションを実行
 *
 * マイグレーション前にバックアップシートを作成し、
 * 失敗した場合は自動的にリストアを試みる。
 * 成功した場合、バックアップは保持される（手動削除が必要）。
 */
export function migrateSheetSchema(spreadsheet: Spreadsheet, schema: SheetSchema): MigrationResult {
  const startTime = Date.now();
  const { logger } = getContainer();

  let backup: { backupSheet: Sheet; backupName: string } | null = null;

  try {
    const sheet = spreadsheet.getSheetByName(schema.sheetName);
    const targetHeaders = getHeadersFromSchema(schema);

    // シートが存在しない場合は新規作成
    if (!sheet) {
      const newSheet = spreadsheet.insertSheet(schema.sheetName);
      initializeSheet(newSheet, schema);

      return {
        sheetName: schema.sheetName,
        success: true,
        status: 'created',
        toVersion: schema.version,
        rowsMigrated: 0,
        columnsAdded: targetHeaders,
        columnsRemoved: [],
        columnsRenamed: [],
        duration: Date.now() - startTime,
      };
    }

    const lastRow = sheet.getLastRow();

    // 空のシートの場合はヘッダーのみ設定
    if (lastRow === 0) {
      initializeSheet(sheet, schema);

      return {
        sheetName: schema.sheetName,
        success: true,
        status: 'created',
        toVersion: schema.version,
        rowsMigrated: 0,
        columnsAdded: targetHeaders,
        columnsRemoved: [],
        columnsRenamed: [],
        duration: Date.now() - startTime,
      };
    }

    // 現在のデータを取得
    const oldData = sheet.getDataRange().getValues();
    const oldHeaders = oldData[0] as string[];

    // 変更が必要か確認
    const changes = analyzeChanges(oldHeaders, targetHeaders);
    if (changes.added.length === 0 && changes.removed.length === 0 && !changes.reordered) {
      return {
        sheetName: schema.sheetName,
        success: true,
        status: 'up_to_date',
        toVersion: schema.version,
        rowsMigrated: 0,
        columnsAdded: [],
        columnsRemoved: [],
        columnsRenamed: [],
        duration: Date.now() - startTime,
      };
    }

    // バックアップを作成（データがある場合のみ）
    backup = createBackup(spreadsheet, sheet, schema.sheetName);

    // マッピングを作成
    const mappings = createColumnMapping(oldHeaders, schema);
    const removedColumns = findRemovedColumns(oldHeaders, schema);

    // データを変換
    const newData = migrateData(oldData, mappings);

    // シートをクリアして再書き込み
    sheet.clear();
    sheet.getRange(1, 1, newData.length, schema.columns.length).setValues(newData);

    // フォーマットを適用
    applySheetFormat(sheet, schema);

    logger.log(`✅ Migrated: ${schema.sheetName}`);
    if (backup) {
      logger.log(`   Backup available: ${backup.backupName}`);
    }

    return {
      sheetName: schema.sheetName,
      success: true,
      status: 'migrated',
      toVersion: schema.version,
      rowsMigrated: lastRow - 1,
      columnsAdded: changes.added,
      columnsRemoved: removedColumns,
      columnsRenamed: [],
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log(`❌ Migration failed for ${schema.sheetName}: ${errorMessage}`);

    // バックアップからリストアを試みる
    if (backup) {
      const sheet = spreadsheet.getSheetByName(schema.sheetName);
      if (sheet) {
        const restored = restoreFromBackup(sheet, backup.backupSheet);
        if (restored) {
          logger.log(`🔄 Restored ${schema.sheetName} from backup`);
        }
      }
    }

    return {
      sheetName: schema.sheetName,
      success: false,
      status: 'error',
      toVersion: schema.version,
      rowsMigrated: 0,
      columnsAdded: [],
      columnsRemoved: [],
      columnsRenamed: [],
      duration: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

/**
 * ヘッダー行のみを更新（データの列順は変更しない）
 */
export function updateSheetHeadersOnly(
  spreadsheet: Spreadsheet,
  schema: SheetSchema
): MigrationResult {
  const startTime = Date.now();
  const { logger } = getContainer();

  try {
    const sheet = spreadsheet.getSheetByName(schema.sheetName);
    const targetHeaders = getHeadersFromSchema(schema);

    if (!sheet) {
      return {
        sheetName: schema.sheetName,
        success: false,
        status: 'skipped',
        toVersion: schema.version,
        rowsMigrated: 0,
        columnsAdded: [],
        columnsRemoved: [],
        columnsRenamed: [],
        duration: Date.now() - startTime,
        error: 'Sheet does not exist',
      };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      initializeSheet(sheet, schema);
      return {
        sheetName: schema.sheetName,
        success: true,
        status: 'created',
        toVersion: schema.version,
        rowsMigrated: 0,
        columnsAdded: targetHeaders,
        columnsRemoved: [],
        columnsRenamed: [],
        duration: Date.now() - startTime,
      };
    }

    // ヘッダー行のみ更新
    sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
    sheet.getRange(1, 1, 1, targetHeaders.length).setFontWeight('bold');

    logger.log(`✅ Headers updated: ${schema.sheetName}`);

    return {
      sheetName: schema.sheetName,
      success: true,
      status: 'migrated',
      toVersion: schema.version,
      rowsMigrated: 0,
      columnsAdded: [],
      columnsRemoved: [],
      columnsRenamed: [],
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      sheetName: schema.sheetName,
      success: false,
      status: 'error',
      toVersion: schema.version,
      rowsMigrated: 0,
      columnsAdded: [],
      columnsRemoved: [],
      columnsRenamed: [],
      duration: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * シートを初期化（ヘッダー設定とフォーマット適用）
 */
function initializeSheet(sheet: Sheet, schema: SheetSchema): void {
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
function applySheetFormat(sheet: Sheet, schema: SheetSchema): void {
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

// =============================================================================
// ログ出力ヘルパー
// =============================================================================

/**
 * マイグレーションプレビューをログ出力
 */
export function logMigrationPreview(preview: MigrationPreview): void {
  const { logger } = getContainer();

  logger.log(`\nSheet: ${preview.sheetName}`);

  if (preview.status === 'new_sheet') {
    logger.log('  Status: NEW SHEET (will be created)');
    logger.log(`  Columns: ${preview.targetHeaders.length}`);
    return;
  }

  if (preview.status === 'up_to_date') {
    logger.log('  Status: UP TO DATE');
    logger.log('  No changes needed');
    return;
  }

  logger.log('  Status: MIGRATION REQUIRED');
  logger.log(`  Rows: ${preview.rowCount}`);

  if (preview.changes.added.length > 0) {
    logger.log(`  + Added columns: ${preview.changes.added.join(', ')}`);
  }
  if (preview.changes.removed.length > 0) {
    logger.log(`  - Removed columns: ${preview.changes.removed.join(', ')}`);
  }
  if (preview.changes.reordered) {
    logger.log('  ~ Column order will be changed');
  }
}

/**
 * マイグレーション結果をログ出力
 */
export function logMigrationResult(result: MigrationResult): void {
  const { logger } = getContainer();

  if (result.success) {
    const statusText = {
      migrated: 'MIGRATED',
      created: 'CREATED',
      up_to_date: 'UP TO DATE',
      skipped: 'SKIPPED',
      error: 'ERROR',
    }[result.status];

    logger.log(`✅ ${result.sheetName}: ${statusText} (${result.duration}ms)`);

    if (result.rowsMigrated > 0) {
      logger.log(`   Rows migrated: ${result.rowsMigrated}`);
    }
    if (result.columnsAdded.length > 0) {
      logger.log(`   Columns added: ${result.columnsAdded.join(', ')}`);
    }
    if (result.columnsRemoved.length > 0) {
      logger.log(`   Columns removed: ${result.columnsRemoved.join(', ')}`);
    }
  } else {
    logger.log(`❌ ${result.sheetName}: FAILED`);
    logger.log(`   Error: ${result.error}`);
  }
}

/**
 * 全体の結果サマリーをログ出力
 */
export function logMigrationSummary(results: MigrationResult[]): void {
  const { logger } = getContainer();

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const migrated = results.filter((r) => r.status === 'migrated').length;
  const created = results.filter((r) => r.status === 'created').length;
  const upToDate = results.filter((r) => r.status === 'up_to_date').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  logger.log('\n=== Migration Summary ===');
  logger.log(`Total sheets: ${results.length}`);
  logger.log(`  Succeeded: ${succeeded}`);
  logger.log(`  Failed: ${failed}`);
  logger.log(`  - Migrated: ${migrated}`);
  logger.log(`  - Created: ${created}`);
  logger.log(`  - Up to date: ${upToDate}`);
  logger.log(`Total duration: ${totalDuration}ms`);

  if (migrated > 0) {
    logger.log('\n💡 Tip: Backup sheets (_backup_*) were created.');
    logger.log('   Run showBackupCleanupHelp() for cleanup instructions.');
  }
}

// =============================================================================
// バックアップシート管理
// =============================================================================

const BACKUP_SHEET_PREFIX = '_backup_';

/**
 * バックアップシートかどうかを判定
 */
export function isBackupSheet(sheetName: string): boolean {
  return sheetName.startsWith(BACKUP_SHEET_PREFIX);
}

/**
 * バックアップシートの一覧を取得
 */
export function listBackupSheets(_spreadsheet: Spreadsheet): string[] {
  const { logger } = getContainer();
  const backupSheets: string[] = [];

  // SpreadsheetにはgetSheetsメソッドがないため、既知のスキーマ名からバックアップを探す
  // 代わりに、スプレッドシートの全シートを取得する方法が必要
  // 現在のインターフェースでは制限があるため、既知のパターンでチェック

  logger.log('=== Backup Sheets ===');
  logger.log("Note: Check your spreadsheet for sheets starting with '_backup_'");
  logger.log('These are created during migration and can be safely deleted after verification.');

  return backupSheets;
}

/**
 * 指定されたバックアップシートを削除
 * （Spreadsheetインターフェースにdeleteシートがないため、
 *   ユーザーへの手動削除を案内）
 */
export function logBackupCleanupInstructions(): void {
  const { logger } = getContainer();

  logger.log('\n=== Backup Cleanup Instructions ===');
  logger.log('To remove backup sheets:');
  logger.log('1. Open your spreadsheet in Google Sheets');
  logger.log("2. Right-click on sheets starting with '_backup_'");
  logger.log("3. Select 'Delete' to remove them");
  logger.log('');
  logger.log('⚠️ Only delete backups after verifying the migration was successful!');
}
