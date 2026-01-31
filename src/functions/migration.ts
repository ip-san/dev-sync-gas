/**
 * スキーママイグレーション関数モジュール
 *
 * スプレッドシートのスキーマ更新、バックアップ管理など
 * マイグレーションに関するGASエントリーポイント関数を提供。
 */

import { getConfig } from '../config/settings';
import { getContainer } from '../container';
import { ALL_SCHEMAS, findSchemaBySheetName } from '../schemas';
import {
  getMigrationPreview,
  migrateSheetSchema,
  updateSheetHeadersOnly,
  logMigrationPreview,
  logMigrationResult,
  logMigrationSummary,
  logBackupCleanupInstructions,
} from '../services/migration';
import { ensureContainerInitialized } from './helpers';

/**
 * 全シートのマイグレーションをプレビュー（ドライラン）
 */
export function previewMigration(): void {
  ensureContainerInitialized();
  const config = getConfig();
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(config.spreadsheet.id);

  logger.log('=== Schema Migration Preview ===');
  logger.log('This is a dry run. No changes will be made.\n');

  for (const schema of ALL_SCHEMAS) {
    const preview = getMigrationPreview(spreadsheet, schema);
    logMigrationPreview(preview);
  }

  logger.log('\nTo apply migrations, run: migrateAllSchemas()');
}

/**
 * 全シートのスキーママイグレーションを実行
 */
export function migrateAllSchemas(): void {
  ensureContainerInitialized();
  const config = getConfig();
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(config.spreadsheet.id);

  logger.log('=== Starting Schema Migration ===\n');

  const results = ALL_SCHEMAS.map((schema) => {
    logger.log(`Migrating: ${schema.sheetName}...`);
    const result = migrateSheetSchema(spreadsheet, schema);
    logMigrationResult(result);
    return result;
  });

  logMigrationSummary(results);
}

/**
 * 特定のシートのみマイグレーションを実行
 */
export function migrateSheet(sheetName: string): void {
  ensureContainerInitialized();
  const config = getConfig();
  const { spreadsheetClient, logger } = getContainer();

  const schema = findSchemaBySheetName(sheetName);
  if (!schema) {
    logger.log(`❌ Error: Unknown sheet name: ${sheetName}`);
    logger.log('Available sheets:');
    ALL_SCHEMAS.forEach((s) => logger.log(`  - ${s.sheetName}`));
    return;
  }

  const spreadsheet = spreadsheetClient.openById(config.spreadsheet.id);
  const result = migrateSheetSchema(spreadsheet, schema);
  logMigrationResult(result);
}

/**
 * ヘッダー行のみを最新に更新（データの列順は変更しない）
 */
export function updateHeadersOnly(): void {
  ensureContainerInitialized();
  const config = getConfig();
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(config.spreadsheet.id);

  logger.log('=== Updating Headers Only ===\n');

  const results = ALL_SCHEMAS.map((schema) => {
    logger.log(`Updating headers: ${schema.sheetName}...`);
    const result = updateSheetHeadersOnly(spreadsheet, schema);
    logMigrationResult(result);
    return result;
  });

  logMigrationSummary(results);
}

/**
 * バックアップシートの削除方法を表示
 */
export function showBackupCleanupHelp(): void {
  ensureContainerInitialized();
  logBackupCleanupInstructions();
}
