/**
 * PRサイズ指標スプレッドシート操作
 *
 * PRの変更規模（行数・ファイル数）を計測した結果を
 * スプレッドシートに書き出す機能を提供。
 */

import { getContainer } from '../../container';
import type { Sheet } from '../../interfaces';
import type { PRSizeMetrics } from '../../types';
import { formatRowsForSheet } from '../../utils/dateFormat';
import { AppError, ErrorCode, SpreadsheetError } from '../../utils/errors';
import {
  getExtendedMetricDetailSheetName,
  getExtendedMetricSheetName,
  groupPRDetailsByRepository,
} from './extendedMetricsRepositorySheet';
import {
  applyDataBorders,
  autoResizeColumns,
  formatIntegerColumns,
  getOrCreateSheet,
  openSpreadsheet,
} from './helpers';

const SHEET_NAME = 'PRサイズ';

/**
 * 集計シートのヘッダー定義
 */
const REPOSITORY_AGGREGATE_HEADERS = [
  '日付',
  'PR数',
  '平均コード行数',
  'コード行数中央値',
  '平均ファイル数',
  'ファイル数中央値',
];

/**
 * 詳細シートのヘッダー定義
 */
const REPOSITORY_DETAIL_HEADERS = [
  'PR番号',
  'タイトル',
  '作成日時',
  'マージ日時',
  '追加行数',
  '削除行数',
  '変更行数',
  '変更ファイル数',
];

/**
 * PR詳細を日付ごとにグループ化
 */
interface DailyPRSizeAggregate {
  date: string;
  prCount: number;
  avgLinesOfCode: number;
  medianLinesOfCode: number;
  avgFilesChanged: number;
  medianFilesChanged: number;
}

/**
 * PR詳細をマージ日ごとにグループ化して集計
 */
function aggregatePRSizeByDate(details: PRSizeMetrics['prDetails']): DailyPRSizeAggregate[] {
  if (details.length === 0) {
    return [];
  }

  // 日付ごとにグループ化
  const grouped = new Map<string, PRSizeMetrics['prDetails']>();
  for (const detail of details) {
    if (!detail.mergedAt) {
      continue;
    }
    // mergedAtから日付のみを抽出 (YYYY-MM-DD)
    const date = detail.mergedAt.split('T')[0].split(' ')[0];
    const existing = grouped.get(date) ?? [];
    existing.push(detail);
    grouped.set(date, existing);
  }

  // 各日付の統計値を計算
  const aggregates: DailyPRSizeAggregate[] = [];
  for (const [date, prs] of grouped) {
    const linesOfCodeValues = prs.map((pr) => pr.linesOfCode).sort((a, b) => a - b);
    const filesChangedValues = prs.map((pr) => pr.filesChanged).sort((a, b) => a - b);

    const sumLinesOfCode = linesOfCodeValues.reduce((acc, val) => acc + val, 0);
    const avgLinesOfCode = sumLinesOfCode / linesOfCodeValues.length;
    const medianLinesOfCode =
      linesOfCodeValues.length % 2 === 0
        ? (linesOfCodeValues[linesOfCodeValues.length / 2 - 1] +
            linesOfCodeValues[linesOfCodeValues.length / 2]) /
          2
        : linesOfCodeValues[Math.floor(linesOfCodeValues.length / 2)];

    const sumFilesChanged = filesChangedValues.reduce((acc, val) => acc + val, 0);
    const avgFilesChanged = sumFilesChanged / filesChangedValues.length;
    const medianFilesChanged =
      filesChangedValues.length % 2 === 0
        ? (filesChangedValues[filesChangedValues.length / 2 - 1] +
            filesChangedValues[filesChangedValues.length / 2]) /
          2
        : filesChangedValues[Math.floor(filesChangedValues.length / 2)];

    aggregates.push({
      date,
      prCount: prs.length,
      avgLinesOfCode,
      medianLinesOfCode,
      avgFilesChanged,
      medianFilesChanged,
    });
  }

  // 日付順にソート
  return aggregates.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * PRサイズ指標をスプレッドシートに書き出す
 *
 * リポジトリ別の集計シートと詳細シートに書き込む。
 */
export function writePRSizeToSheet(spreadsheetId: string, metrics: PRSizeMetrics): void {
  const { logger } = getContainer();

  try {
    // 集計シートと詳細シートの両方に書き込み
    writePRSizeToAllRepositorySheets(spreadsheetId, metrics);

    logger.info(`📝 Wrote PR size metrics to repository sheets (aggregate + details)`);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new SpreadsheetError('Failed to write PR size metrics', {
      code: ErrorCode.SPREADSHEET_WRITE_FAILED,
      context: { spreadsheetId, period: metrics.period, prCount: metrics.prCount },
      cause: error as Error,
    });
  }
}

/**
 * 既存の日付を収集（集計シート用）
 */
function getExistingDates(sheet: Sheet): Set<string> {
  const dates = new Set<string>();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return dates;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (const row of data) {
    const date = String(row[0]);
    if (date) {
      dates.add(date);
    }
  }

  return dates;
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
  details: PRSizeMetrics['prDetails'],
  sheet: Sheet,
  skipDuplicates: boolean
): { filtered: PRSizeMetrics['prDetails']; skippedCount: number } {
  if (!skipDuplicates) {
    return { filtered: details, skippedCount: 0 };
  }

  const existingKeys = getExistingPRKeys(sheet);
  const filtered = details.filter((d) => !existingKeys.has(d.prNumber));
  return { filtered, skippedCount: details.length - filtered.length };
}

/**
 * リポジトリ別集計シートにPRサイズを書き込む
 */
function writePRSizeAggregateToRepositorySheet(
  spreadsheetId: string,
  repository: string,
  details: PRSizeMetrics['prDetails']
): { written: number } {
  const { logger } = getContainer();

  try {
    const spreadsheet = openSpreadsheet(spreadsheetId);
    const sheetName = getExtendedMetricSheetName(repository, SHEET_NAME);
    const sheet = getOrCreateSheet(spreadsheet, sheetName, REPOSITORY_AGGREGATE_HEADERS);

    if (details.length === 0) {
      return { written: 0 };
    }

    // 日付ごとに集計
    const aggregates = aggregatePRSizeByDate(details);

    // 既存の日付を取得
    const existingDates = getExistingDates(sheet);

    // 新しい日付のみをフィルタリング
    const newAggregates = aggregates.filter((agg) => !existingDates.has(agg.date));

    if (newAggregates.length === 0) {
      logger.info(`[${repository}] No new dates to write to aggregate sheet`);
      return { written: 0 };
    }

    // 行データを作成
    const rows = newAggregates.map((agg) => [
      agg.date,
      agg.prCount,
      agg.avgLinesOfCode,
      agg.medianLinesOfCode,
      agg.avgFilesChanged,
      agg.medianFilesChanged,
    ]);

    const lastRow = sheet.getLastRow();
    sheet
      .getRange(lastRow + 1, 1, rows.length, REPOSITORY_AGGREGATE_HEADERS.length)
      .setValues(rows);

    formatRepositoryPRSizeAggregateSheet(sheet);
    logger.info(`✅ [${repository}] Wrote ${newAggregates.length} PR size aggregate records`);

    return { written: newAggregates.length };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new SpreadsheetError('Failed to write PR size aggregate', {
      code: ErrorCode.SPREADSHEET_WRITE_FAILED,
      context: { spreadsheetId, repository },
      cause: error as Error,
    });
  }
}

/**
 * リポジトリ別詳細シートにPRサイズを書き込む
 */
export function writePRSizeDetailsToRepositorySheet(
  spreadsheetId: string,
  repository: string,
  details: PRSizeMetrics['prDetails'],
  options: { skipDuplicates?: boolean } = {}
): { written: number; skipped: number } {
  const { logger } = getContainer();

  try {
    const spreadsheet = openSpreadsheet(spreadsheetId);
    const sheetName = getExtendedMetricDetailSheetName(repository, SHEET_NAME);
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
      pr.additions,
      pr.deletions,
      pr.linesOfCode,
      pr.filesChanged,
    ]);

    const lastRow = sheet.getLastRow();
    sheet
      .getRange(lastRow + 1, 1, rows.length, REPOSITORY_DETAIL_HEADERS.length)
      .setValues(formatRowsForSheet(rows));

    formatRepositoryPRSizeDetailSheet(sheet);
    logger.info(`✅ [${repository}] Wrote ${filtered.length} PR size detail records`);

    return { written: filtered.length, skipped: skippedCount };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new SpreadsheetError('Failed to write PR size to repository sheet', {
      code: ErrorCode.SPREADSHEET_WRITE_FAILED,
      context: { spreadsheetId, repository, sheetName: SHEET_NAME, detailCount: details.length },
      cause: error as Error,
    });
  }
}

/**
 * リポジトリ別PRサイズ集計シートのフォーマットを整える
 */
function formatRepositoryPRSizeAggregateSheet(sheet: Sheet): void {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow > 1) {
    // 数値列（3〜6列目）を整数でフォーマット
    formatIntegerColumns(sheet, 3, 4);
    applyDataBorders(sheet, lastRow - 1, lastCol);
  }

  autoResizeColumns(sheet, lastCol);
}

/**
 * リポジトリ別PRサイズ詳細シートのフォーマットを整える
 */
function formatRepositoryPRSizeDetailSheet(sheet: Sheet): void {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow > 1) {
    // 数値列（5-8列目）を整数でフォーマット
    formatIntegerColumns(sheet, 5, 4);
    applyDataBorders(sheet, lastRow - 1, lastCol);
  }

  autoResizeColumns(sheet, lastCol);
}

/**
 * 全リポジトリをそれぞれのシートに書き込む（集計 + 詳細）
 */
export function writePRSizeToAllRepositorySheets(
  spreadsheetId: string,
  metrics: PRSizeMetrics,
  options: { skipDuplicates?: boolean } = {}
): Map<string, { written: number; skipped: number }> {
  const { logger } = getContainer();
  const grouped = groupPRDetailsByRepository(metrics.prDetails);
  const results = new Map<string, { written: number; skipped: number }>();

  logger.info(`📊 Writing PR size to ${grouped.size} repository sheets (aggregate + details)...`);

  for (const [repository, repoDetails] of grouped) {
    // 集計シート作成
    const aggregateResult = writePRSizeAggregateToRepositorySheet(
      spreadsheetId,
      repository,
      repoDetails
    );

    // 詳細シート作成
    const detailResult = writePRSizeDetailsToRepositorySheet(
      spreadsheetId,
      repository,
      repoDetails,
      options
    );

    // 両方の結果を合算
    results.set(repository, {
      written: aggregateResult.written + detailResult.written,
      skipped: detailResult.skipped,
    });
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

/**
 * リポジトリ別シートにPRサイズを書き込む（後方互換性用）
 * @deprecated Use writePRSizeDetailsToRepositorySheet instead
 */
export function writePRSizeToRepositorySheet(
  spreadsheetId: string,
  repository: string,
  details: PRSizeMetrics['prDetails'],
  options: { skipDuplicates?: boolean } = {}
): { written: number; skipped: number } {
  return writePRSizeDetailsToRepositorySheet(spreadsheetId, repository, details, options);
}
