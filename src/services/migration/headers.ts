/**
 * ヘッダー更新機能
 */

import { getContainer } from '../../container';
import type { Spreadsheet } from '../../interfaces';
import type { SheetSchema, MigrationResult } from '../../schemas';
import { getHeadersFromSchema } from '../../schemas';
import { initializeSheet } from './formatting';
import {
  createSheetNotFoundResult,
  createSheetCreatedResult,
  createHeadersUpdatedResult,
  createMigrationErrorResult,
} from './results';

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
      return createSheetNotFoundResult(schema.sheetName, schema.version, Date.now() - startTime);
    }

    const lastRow = sheet.getLastRow();
    if (lastRow === 0) {
      initializeSheet(sheet, schema);
      return createSheetCreatedResult(
        schema.sheetName,
        schema.version,
        targetHeaders,
        Date.now() - startTime
      );
    }

    // ヘッダー行のみ更新
    sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
    sheet.getRange(1, 1, 1, targetHeaders.length).setFontWeight('bold');

    logger.info(`✅ Headers updated: ${schema.sheetName}`);

    return createHeadersUpdatedResult(schema.sheetName, schema.version, Date.now() - startTime);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return createMigrationErrorResult(
      schema.sheetName,
      schema.version,
      Date.now() - startTime,
      errorMessage
    );
  }
}
