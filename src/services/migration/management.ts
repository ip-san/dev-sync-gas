/**
 * バックアップシート管理
 */

import { getContainer } from '../../container';
import type { Spreadsheet } from '../../interfaces';

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

  logger.info('=== Backup Sheets ===');
  logger.info("Note: Check your spreadsheet for sheets starting with '_backup_'");
  logger.info('These are created during migration and can be safely deleted after verification.');

  return backupSheets;
}

/**
 * 指定されたバックアップシートを削除
 * （Spreadsheetインターフェースにdeleteシートがないため、
 *   ユーザーへの手動削除を案内）
 */
export function logBackupCleanupInstructions(): void {
  const { logger } = getContainer();

  logger.info('\n=== Backup Cleanup Instructions ===');
  logger.info('To remove backup sheets:');
  logger.info('1. Open your spreadsheet in Google Sheets');
  logger.info("2. Right-click on sheets starting with '_backup_'");
  logger.info("3. Select 'Delete' to remove them");
  logger.info('');
  logger.warn('⚠️ Only delete backups after verifying the migration was successful!');
}
