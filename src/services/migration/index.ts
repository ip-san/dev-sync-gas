/**
 * スプレッドシートのスキーママイグレーション機能
 *
 * 既存シートのヘッダー更新、列追加、列順変更に対応する。
 * 全データ再書き込み方式を採用し、データの整合性を保証する。
 */

export { migrateSheetSchema } from './executor';
export { updateSheetHeadersOnly } from './headers';
export { logMigrationPreview, logMigrationResult, logMigrationSummary } from './logging';
export { isBackupSheet, listBackupSheets, logBackupCleanupInstructions } from './management';
export { createColumnMapping, findRemovedColumns } from './mapping';
// パブリックAPI（外部から利用可能な関数）
export { getMigrationPreview } from './preview';
export { migrateData } from './transform';
