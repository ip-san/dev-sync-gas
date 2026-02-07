/**
 * レビュー効率指標スプレッドシート操作
 *
 * PRの各ステータスにおける滞留時間を計測した結果を
 * スプレッドシートに書き出す機能を提供。
 */

import type { ReviewEfficiencyMetrics } from '../../types';
import type { Sheet } from '../../interfaces';
import { getContainer } from '../../container';
import {
  getOrCreateSheet,
  autoResizeColumns,
  openSpreadsheet,
  formatDecimalColumns,
  applyDataBorders,
} from './helpers';
import {
  groupPRDetailsByRepository,
  getExtendedMetricSheetName,
} from './extendedMetricsRepositorySheet';
import { SpreadsheetError, ErrorCode, AppError } from '../../utils/errors';
import { formatRowsForSheet } from '../../utils/dateFormat';

const SHEET_NAME = 'レビュー効率';

/**
 * リポジトリ別シートのヘッダー定義（リポジトリ列を除く）
 */
const REPOSITORY_DETAIL_HEADERS = [
  'PR番号',
  'タイトル',
  '作成日時',
  'レビュー準備完了日時',
  '初回レビュー日時',
  '承認日時',
  'マージ日時',
  'レビュー待ち時間 (時間)',
  'レビュー時間 (時間)',
  'マージ待ち時間 (時間)',
  '全体時間 (時間)',
];

/**
 * レビュー効率指標をスプレッドシートに書き出す
 *
 * リポジトリ別シートに書き込む。
 */
export function writeReviewEfficiencyToSheet(
  spreadsheetId: string,
  metrics: ReviewEfficiencyMetrics
): void {
  const { logger } = getContainer();

  try {
    // リポジトリ別シートに書き込み
    writeReviewEfficiencyToAllRepositorySheets(spreadsheetId, metrics);

    logger.info(`📝 Wrote review efficiency metrics to repository sheets`);
  } catch (error) {
    if (error instanceof AppError) {
      throw error; // Re-throw custom errors
    }
    throw new SpreadsheetError('Failed to write review efficiency metrics', {
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
  details: ReviewEfficiencyMetrics['prDetails'],
  sheet: Sheet,
  skipDuplicates: boolean
): { filtered: ReviewEfficiencyMetrics['prDetails']; skippedCount: number } {
  if (!skipDuplicates) {
    return { filtered: details, skippedCount: 0 };
  }

  const existingKeys = getExistingPRKeys(sheet);
  const filtered = details.filter((d) => !existingKeys.has(d.prNumber));
  return { filtered, skippedCount: details.length - filtered.length };
}

/**
 * リポジトリ別シートにレビュー効率詳細を書き込む
 */
export function writeReviewEfficiencyToRepositorySheet(
  spreadsheetId: string,
  repository: string,
  details: ReviewEfficiencyMetrics['prDetails'],
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
      pr.readyForReviewAt,
      pr.firstReviewAt ?? 'N/A',
      pr.approvedAt ?? 'N/A',
      pr.mergedAt ?? 'Not merged',
      pr.timeToFirstReviewHours ?? 'N/A',
      pr.reviewDurationHours ?? 'N/A',
      pr.timeToMergeHours ?? 'N/A',
      pr.totalTimeHours ?? 'N/A',
    ]);

    const lastRow = sheet.getLastRow();
    sheet
      .getRange(lastRow + 1, 1, rows.length, REPOSITORY_DETAIL_HEADERS.length)
      .setValues(formatRowsForSheet(rows));

    formatRepositoryReviewEfficiencySheet(sheet);
    logger.info(`✅ [${repository}] Wrote ${filtered.length} review efficiency records`);

    return { written: filtered.length, skipped: skippedCount };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new SpreadsheetError('Failed to write review efficiency to repository sheet', {
      code: ErrorCode.SPREADSHEET_WRITE_FAILED,
      context: { spreadsheetId, repository, sheetName: SHEET_NAME, detailCount: details.length },
      cause: error as Error,
    });
  }
}

/**
 * リポジトリ別レビュー効率シートのフォーマットを整える
 */
function formatRepositoryReviewEfficiencySheet(sheet: Sheet): void {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow > 1) {
    // 時間列（8-11列目）を小数点1桁でフォーマット
    formatDecimalColumns(sheet, 8, 4);
    applyDataBorders(sheet, lastRow - 1, lastCol);
  }

  autoResizeColumns(sheet, lastCol);
}

/**
 * 全リポジトリをそれぞれのシートに書き込む
 */
export function writeReviewEfficiencyToAllRepositorySheets(
  spreadsheetId: string,
  metrics: ReviewEfficiencyMetrics,
  options: { skipDuplicates?: boolean } = {}
): Map<string, { written: number; skipped: number }> {
  const { logger } = getContainer();
  const grouped = groupPRDetailsByRepository(metrics.prDetails);
  const results = new Map<string, { written: number; skipped: number }>();

  logger.info(`📊 Writing review efficiency to ${grouped.size} repository sheets...`);

  for (const [repository, repoDetails] of grouped) {
    const result = writeReviewEfficiencyToRepositorySheet(
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
