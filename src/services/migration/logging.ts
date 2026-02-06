/**
 * マイグレーションログ出力
 */

import { getContainer } from '../../container';
import type { MigrationPreview, MigrationResult } from '../../schemas';

/**
 * マイグレーションプレビューをログ出力
 */
export function logMigrationPreview(preview: MigrationPreview): void {
  const { logger } = getContainer();

  logger.info(`\nSheet: ${preview.sheetName}`);

  if (preview.status === 'new_sheet') {
    logger.info('  Status: NEW SHEET (will be created)');
    logger.info(`  Columns: ${preview.targetHeaders.length}`);
    return;
  }

  if (preview.status === 'up_to_date') {
    logger.info('  Status: UP TO DATE');
    logger.info('  No changes needed');
    return;
  }

  logger.info('  Status: MIGRATION REQUIRED');
  logger.info(`  Rows: ${preview.rowCount}`);

  if (preview.changes.added.length > 0) {
    logger.info(`  + Added columns: ${preview.changes.added.join(', ')}`);
  }
  if (preview.changes.removed.length > 0) {
    logger.info(`  - Removed columns: ${preview.changes.removed.join(', ')}`);
  }
  if (preview.changes.reordered) {
    logger.info('  ~ Column order will be changed');
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

    logger.info(`✅ ${result.sheetName}: ${statusText} (${result.duration}ms)`);

    if (result.rowsMigrated > 0) {
      logger.debug(`   Rows migrated: ${result.rowsMigrated}`);
    }
    if (result.columnsAdded.length > 0) {
      logger.debug(`   Columns added: ${result.columnsAdded.join(', ')}`);
    }
    if (result.columnsRemoved.length > 0) {
      logger.debug(`   Columns removed: ${result.columnsRemoved.join(', ')}`);
    }
  } else {
    logger.error(`❌ ${result.sheetName}: FAILED`);
    logger.error(`   Error: ${result.error}`);
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

  logger.info('\n=== Migration Summary ===');
  logger.info(`Total sheets: ${results.length}`);
  logger.info(`  Succeeded: ${succeeded}`);
  logger.info(`  Failed: ${failed}`);
  logger.info(`  - Migrated: ${migrated}`);
  logger.info(`  - Created: ${created}`);
  logger.info(`  - Up to date: ${upToDate}`);
  logger.info(`Total duration: ${totalDuration}ms`);

  if (migrated > 0) {
    logger.info('\n💡 Tip: Backup sheets (_backup_*) were created.');
    logger.info('   Run showBackupCleanupHelp() for cleanup instructions.');
  }
}
