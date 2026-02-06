/**
 * マイグレーション結果ビルダー
 */

import type { MigrationResult } from '../../schemas';

/**
 * シートが存在しない場合のMigrationResultを構築
 */
export function createSheetNotFoundResult(
  sheetName: string,
  version: string,
  duration: number
): MigrationResult {
  return {
    sheetName,
    success: false,
    status: 'skipped',
    toVersion: version,
    rowsMigrated: 0,
    columnsAdded: [],
    columnsRemoved: [],
    columnsRenamed: [],
    duration,
    error: 'Sheet does not exist',
  };
}

/**
 * シート作成時のMigrationResultを構築
 */
export function createSheetCreatedResult(
  sheetName: string,
  version: string,
  headers: string[],
  duration: number
): MigrationResult {
  return {
    sheetName,
    success: true,
    status: 'created',
    toVersion: version,
    rowsMigrated: 0,
    columnsAdded: headers,
    columnsRemoved: [],
    columnsRenamed: [],
    duration,
  };
}

/**
 * ヘッダー更新成功時のMigrationResultを構築
 */
export function createHeadersUpdatedResult(
  sheetName: string,
  version: string,
  duration: number
): MigrationResult {
  return {
    sheetName,
    success: true,
    status: 'migrated',
    toVersion: version,
    rowsMigrated: 0,
    columnsAdded: [],
    columnsRemoved: [],
    columnsRenamed: [],
    duration,
  };
}

/**
 * エラー時のMigrationResultを構築
 */
export function createMigrationErrorResult(
  sheetName: string,
  version: string,
  duration: number,
  errorMessage: string
): MigrationResult {
  return {
    sheetName,
    success: false,
    status: 'error',
    toVersion: version,
    rowsMigrated: 0,
    columnsAdded: [],
    columnsRemoved: [],
    columnsRenamed: [],
    duration,
    error: errorMessage,
  };
}
