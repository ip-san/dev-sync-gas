/**
 * 手戻り率指標スプレッドシート操作
 *
 * PR作成後の追加コミット数とForce Push回数を計測した結果を
 * スプレッドシートに書き出す機能を提供。
 */

import type { ReworkRateMetrics } from '../../types';
import type { Sheet } from '../../interfaces';
import { getContainer } from '../../container';
import { getOrCreateSheet, autoResizeColumns, openSpreadsheet, applyDataBorders } from './helpers';
import {
  groupPRDetailsByRepository,
  getExtendedMetricSheetName,
} from './extendedMetricsRepositorySheet';
import { SpreadsheetError, ErrorCode, AppError } from '../../utils/errors';
import { formatRowsForSheet } from '../../utils/dateFormat';

const SHEET_NAME = '手戻り率';

/**
 * リポジトリ別シートのヘッダー定義（リポジトリ列を除く）
 */
const REPOSITORY_DETAIL_HEADERS = [
  'PR番号',
  'タイトル',
  '作成日時',
  'マージ日時',
  '総コミット数',
  '追加コミット数',
  'Force Push回数',
];

/**
 * 手戻り率指標をスプレッドシートに書き出す
 *
 * リポジトリ別シートに書き込む。
 */
export function writeReworkRateToSheet(spreadsheetId: string, metrics: ReworkRateMetrics): void {
  const { logger } = getContainer();

  try {
    // リポジトリ別シートに書き込み
    writeReworkRateToAllRepositorySheets(spreadsheetId, metrics);

    logger.info(`📝 Wrote rework rate metrics to repository sheets`);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new SpreadsheetError('Failed to write rework rate metrics', {
      code: ErrorCode.SPREADSHEET_WRITE_FAILED,
      context: { spreadsheetId, period: metrics.period, prCount: metrics.prCount },
      cause: error as Error,
    });
  }
}

/**
 * 既存PRキーを収集（リポジトリ別シート用）
 */
function getExistingPRKeys(sheet: Sheet): Set<number> {
  const keys = new Set<number>();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return keys;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (const row of data) {
    const prNum = Number(row[0]);
    if (prNum) {
      keys.add(prNum);
    }
  }

  return keys;
}

/**
 * 重複を除外してカウント
 */
function filterDuplicates(
  details: ReworkRateMetrics['prDetails'],
  sheet: Sheet,
  skipDuplicates: boolean
): { filtered: ReworkRateMetrics['prDetails']; skippedCount: number } {
  if (!skipDuplicates) {
    return { filtered: details, skippedCount: 0 };
  }

  const existingKeys = getExistingPRKeys(sheet);
  const filtered = details.filter((d) => !existingKeys.has(d.prNumber));
  return { filtered, skippedCount: details.length - filtered.length };
}

/**
 * リポジトリ別シートに手戻り率詳細を書き込む
 */
export function writeReworkRateToRepositorySheet(
  spreadsheetId: string,
  repository: string,
  details: ReworkRateMetrics['prDetails'],
  options: { skipDuplicates?: boolean } = {}
): { written: number; skipped: number } {
  const { logger } = getContainer();

  try {
    const spreadsheet = openSpreadsheet(spreadsheetId);
    const sheetName = getExtendedMetricSheetName(repository, SHEET_NAME);
    const sheet = getOrCreateSheet(spreadsheet, sheetName, REPOSITORY_DETAIL_HEADERS);

    if (details.length === 0) {
      return { written: 0, skipped: 0 };
    }

    const skipDuplicates = options.skipDuplicates !== false;
    const { filtered, skippedCount } = filterDuplicates(details, sheet, skipDuplicates);

    if (filtered.length === 0) {
      return { written: 0, skipped: skippedCount };
    }

    const rows = filtered.map((pr) => [
      pr.prNumber,
      pr.title,
      pr.createdAt,
      pr.mergedAt ?? 'Not merged',
      pr.totalCommits,
      pr.additionalCommits,
      pr.forcePushCount,
    ]);

    const lastRow = sheet.getLastRow();
    sheet
      .getRange(lastRow + 1, 1, rows.length, REPOSITORY_DETAIL_HEADERS.length)
      .setValues(formatRowsForSheet(rows));

    formatRepositoryReworkRateSheet(sheet);
    logger.info(`✅ [${repository}] Wrote ${filtered.length} rework rate records`);

    return { written: filtered.length, skipped: skippedCount };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new SpreadsheetError('Failed to write rework rate to repository sheet', {
      code: ErrorCode.SPREADSHEET_WRITE_FAILED,
      context: { spreadsheetId, repository, sheetName: SHEET_NAME, detailCount: details.length },
      cause: error as Error,
    });
  }
}

/**
 * リポジトリ別手戻り率シートのフォーマットを整える
 */
function formatRepositoryReworkRateSheet(sheet: Sheet): void {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow > 1) {
    applyDataBorders(sheet, lastRow - 1, lastCol);
  }

  autoResizeColumns(sheet, lastCol);
}

/**
 * 全リポジトリをそれぞれのシートに書き込む
 */
export function writeReworkRateToAllRepositorySheets(
  spreadsheetId: string,
  metrics: ReworkRateMetrics,
  options: { skipDuplicates?: boolean } = {}
): Map<string, { written: number; skipped: number }> {
  const { logger } = getContainer();
  const grouped = groupPRDetailsByRepository(metrics.prDetails);
  const results = new Map<string, { written: number; skipped: number }>();

  logger.info(`📊 Writing rework rate to ${grouped.size} repository sheets...`);

  for (const [repository, repoDetails] of grouped) {
    const result = writeReworkRateToRepositorySheet(
      spreadsheetId,
      repository,
      repoDetails,
      options
    );
    results.set(repository, result);
  }

  let totalWritten = 0;
  let totalSkipped = 0;
  for (const result of results.values()) {
    totalWritten += result.written;
    totalSkipped += result.skipped;
  }

  logger.info(
    `✅ Total: ${totalWritten} written, ${totalSkipped} skipped across ${grouped.size} repositories`
  );

  return results;
}
