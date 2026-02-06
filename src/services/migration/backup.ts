/**
 * バックアップ/リストア機能
 */

import { getContainer } from '../../container';
import type { Sheet, Spreadsheet } from '../../interfaces';

/**
 * バックアップシート名を生成
 */
export function getBackupSheetName(sheetName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `_backup_${sheetName}_${timestamp}`;
}

/**
 * シートのバックアップを作成
 */
export function createBackup(
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

    logger.info(`📋 Backup created: ${backupName}`);
    return { backupSheet, backupName };
  } catch (error) {
    logger.warn(
      `⚠️ Failed to create backup: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * バックアップからリストア
 */
export function restoreFromBackup(sheet: Sheet, backupSheet: Sheet): boolean {
  const { logger } = getContainer();

  try {
    const backupData = backupSheet.getDataRange().getValues();
    if (backupData.length === 0) {
      return false;
    }

    sheet.clear();
    const firstRow = backupData[0];
    sheet.getRange(1, 1, backupData.length, firstRow.length).setValues(backupData);

    logger.info(`🔄 Restored from backup`);
    return true;
  } catch (error) {
    logger.error(
      `❌ Failed to restore from backup: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}
