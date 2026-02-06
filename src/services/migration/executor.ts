/**
 * マイグレーション実行オーケストレーター
 */

import { getContainer } from '../../container';
import type { Spreadsheet, Sheet } from '../../interfaces';
import type { SheetSchema, MigrationResult } from '../../schemas';
import { getHeadersFromSchema } from '../../schemas';
import { createBackup } from './backup';
import {
  createNewSheet,
  initializeEmptySheet,
  checkSchemaUpToDate,
  performDataMigration,
  handleMigrationError,
} from './operations';

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

    if (!sheet) {
      return createNewSheet(spreadsheet, schema, targetHeaders, Date.now() - startTime);
    }

    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      return initializeEmptySheet(sheet, schema, targetHeaders, Date.now() - startTime);
    }

    const oldData = sheet.getDataRange().getValues();
    const oldHeaders = oldData[0] as string[];

    const upToDateResult = checkSchemaUpToDate(
      oldHeaders,
      targetHeaders,
      schema,
      Date.now() - startTime
    );
    if (upToDateResult) {
      return upToDateResult;
    }

    backup = createBackup(spreadsheet, sheet, schema.sheetName);
    if (backup) {
      logger.debug(`   Backup available: ${backup.backupName}`);
    }

    return performDataMigration({
      sheet,
      oldData,
      oldHeaders,
      schema,
      targetHeaders,
      lastRow,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    return handleMigrationError({
      error,
      spreadsheet,
      schema,
      backup,
      duration: Date.now() - startTime,
    });
  }
}
