/**
 * マイグレーション操作
 */

import { getContainer } from '../../container';
import type { Sheet, Spreadsheet } from '../../interfaces';
import type { MigrationResult, SheetSchema } from '../../schemas';
import { restoreFromBackup } from './backup';
import { applySheetFormat, initializeSheet } from './formatting';
import { createColumnMapping, findRemovedColumns } from './mapping';
import { analyzeChanges } from './preview';
import { migrateData } from './transform';
import type { HandleMigrationErrorParams, PerformDataMigrationParams } from './types';

/**
 * 新しいシートを作成して初期化
 */
export function createNewSheet(
  spreadsheet: Spreadsheet,
  schema: SheetSchema,
  targetHeaders: string[],
  duration: number
): MigrationResult {
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
    duration,
  };
}

/**
 * 空のシートを初期化
 */
export function initializeEmptySheet(
  sheet: Sheet,
  schema: SheetSchema,
  targetHeaders: string[],
  duration: number
): MigrationResult {
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
    duration,
  };
}

/**
 * スキーマが最新かチェックし、最新の場合は結果を返す
 */
export function checkSchemaUpToDate(
  oldHeaders: string[],
  targetHeaders: string[],
  schema: SheetSchema,
  duration: number
): MigrationResult | null {
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
      duration,
    };
  }
  return null;
}

/**
 * データマイグレーションを実行
 */
export function performDataMigration(params: PerformDataMigrationParams): MigrationResult {
  const { sheet, oldData, oldHeaders, schema, targetHeaders, lastRow, duration } = params;
  const { logger } = getContainer();

  const mappings = createColumnMapping(oldHeaders, schema);
  const removedColumns = findRemovedColumns(oldHeaders, schema);
  const newData = migrateData(oldData, mappings);
  const changes = analyzeChanges(oldHeaders, targetHeaders);

  sheet.clear();
  sheet.getRange(1, 1, newData.length, schema.columns.length).setValues(newData);
  applySheetFormat(sheet, schema);

  logger.info(`✅ Migrated: ${schema.sheetName}`);

  return {
    sheetName: schema.sheetName,
    success: true,
    status: 'migrated',
    toVersion: schema.version,
    rowsMigrated: lastRow - 1,
    columnsAdded: changes.added,
    columnsRemoved: removedColumns,
    columnsRenamed: [],
    duration,
  };
}

/**
 * マイグレーションエラーを処理
 */
export function handleMigrationError(params: HandleMigrationErrorParams): MigrationResult {
  const { error, spreadsheet, schema, backup, duration } = params;
  const { logger } = getContainer();
  const errorMessage = error instanceof Error ? error.message : String(error);

  logger.error(`❌ Migration failed for ${schema.sheetName}: ${errorMessage}`);

  if (backup) {
    const sheet = spreadsheet.getSheetByName(schema.sheetName);
    if (sheet && restoreFromBackup(sheet, backup.backupSheet)) {
      logger.info(`🔄 Restored ${schema.sheetName} from backup`);
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
    duration,
    error: errorMessage,
  };
}
