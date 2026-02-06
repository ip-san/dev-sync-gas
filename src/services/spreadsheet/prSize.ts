/**
 * PRサイズ指標スプレッドシート操作
 *
 * PRの変更規模（行数・ファイル数）を計測した結果を
 * スプレッドシートに書き出す機能を提供。
 */

import type { PRSizeMetrics } from '../../types';
import type { Sheet } from '../../interfaces';
import { getContainer } from '../../container';
import {
  getOrCreateSheet,
  autoResizeColumns,
  openSpreadsheet,
  formatDecimalColumns,
  formatIntegerColumns,
  applyDataBorders,
} from './helpers';
import {
  groupPRSizeDetailsByRepository,
  getExtendedMetricSheetName,
} from './extendedMetricsRepositorySheet';
import { SpreadsheetError, ErrorCode, AppError } from '../../utils/errors';
import { formatDateForDisplay, formatRowsForSheet } from '../../utils/dateFormat';

const SHEET_NAME = 'PRサイズ';

/**
 * サマリーシートのヘッダー定義
 */
const SUMMARY_HEADERS = [
  '期間', // 計測期間
  'PR数', // 分析対象のPR数
  '変更行数 (合計)', // 全PRの変更行数合計（additions + deletions）
  '変更行数 (平均)', // PRあたりの平均値
  '変更行数 (中央値)', // ソート後の中央値
  '変更行数 (最小)', // 最も小さかったPR
  '変更行数 (最大)', // 最も大きかったPR
  '変更ファイル数 (合計)', // 全PRの変更ファイル数合計
  '変更ファイル数 (平均)', // PRあたりの平均値
  '変更ファイル数 (中央値)', // ソート後の中央値
  '変更ファイル数 (最小)', // 最も少なかったPR
  '変更ファイル数 (最大)', // 最も多かったPR
  '記録日時', // データ記録時刻
];

/**
 * 詳細シートのヘッダー定義（グローバル）
 */
const DETAIL_HEADERS = [
  'PR番号', // GitHubのPR番号
  'タイトル', // PRタイトル
  'リポジトリ', // 対象リポジトリ
  '作成日時', // PR作成日時
  'マージ日時', // マージされた日時
  '追加行数', // 追加された行数
  '削除行数', // 削除された行数
  '変更行数', // additions + deletions
  '変更ファイル数', // 変更されたファイル数
];

/**
 * リポジトリ別シートのヘッダー定義（リポジトリ列を除く）
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
 * PRサイズ指標をスプレッドシートに書き出す
 *
 * リポジトリ別シートに書き込む。
 */
export function writePRSizeToSheet(spreadsheetId: string, metrics: PRSizeMetrics): void {
  const { logger } = getContainer();

  try {
    // リポジトリ別シートに書き込み
    writePRSizeToAllRepositorySheets(spreadsheetId, metrics);

    logger.info(`📝 Wrote PR size metrics to repository sheets`);
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
 * サマリーシートに書き込み
 * @deprecated レガシー機能。マイグレーション用に保持。
 */
export function writeSummarySheet(
  spreadsheet: ReturnType<typeof openSpreadsheet>,
  metrics: PRSizeMetrics
): void {
  const sheet = getOrCreateSheet(spreadsheet, SHEET_NAME, SUMMARY_HEADERS);

  const row = [
    metrics.period,
    metrics.prCount,
    metrics.linesOfCode.total,
    metrics.linesOfCode.avg ?? 'N/A',
    metrics.linesOfCode.median ?? 'N/A',
    metrics.linesOfCode.min ?? 'N/A',
    metrics.linesOfCode.max ?? 'N/A',
    metrics.filesChanged.total,
    metrics.filesChanged.avg ?? 'N/A',
    metrics.filesChanged.median ?? 'N/A',
    metrics.filesChanged.min ?? 'N/A',
    metrics.filesChanged.max ?? 'N/A',
    formatDateForDisplay(new Date()),
  ];

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, SUMMARY_HEADERS.length).setValues([row]);

  // フォーマット: 整数列（Total）と小数列（Avg, Median, Min, Max）
  formatIntegerColumns(sheet, 3, 1); // 変更行数 合計
  formatIntegerColumns(sheet, 8, 1); // ファイル数 合計
  formatDecimalColumns(sheet, 4, 4); // 変更行数 平均〜最大
  formatDecimalColumns(sheet, 9, 4); // ファイル数 平均〜最大

  // データ範囲にボーダーを適用
  const lastRowAfterWrite = sheet.getLastRow();
  if (lastRowAfterWrite > 1) {
    applyDataBorders(sheet, lastRowAfterWrite - 1, SUMMARY_HEADERS.length);
  }

  autoResizeColumns(sheet, SUMMARY_HEADERS.length);
}

/**
 * 詳細シートに書き込み
 * @deprecated レガシー機能。マイグレーション用に保持。
 */
export function writeDetailSheet(
  spreadsheet: ReturnType<typeof openSpreadsheet>,
  metrics: PRSizeMetrics
): void {
  if (metrics.prDetails.length === 0) {
    return;
  }

  const detailSheetName = `${SHEET_NAME} - Details`;
  const sheet = getOrCreateSheet(spreadsheet, detailSheetName, DETAIL_HEADERS);

  const rows = metrics.prDetails.map((pr) => [
    pr.prNumber,
    pr.title,
    pr.repository,
    pr.createdAt,
    pr.mergedAt ?? 'Not merged',
    pr.additions,
    pr.deletions,
    pr.linesOfCode,
    pr.filesChanged,
  ]);

  const lastRow = sheet.getLastRow();
  sheet
    .getRange(lastRow + 1, 1, rows.length, DETAIL_HEADERS.length)
    .setValues(formatRowsForSheet(rows));

  // 数値列（6-9列目）を整数でフォーマット
  formatIntegerColumns(sheet, 6, 4);

  // データ範囲にボーダーを適用
  const lastRowAfterWrite = sheet.getLastRow();
  if (lastRowAfterWrite > 1) {
    applyDataBorders(sheet, lastRowAfterWrite - 1, DETAIL_HEADERS.length);
  }

  autoResizeColumns(sheet, DETAIL_HEADERS.length);
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
 * リポジトリ別シートにPRサイズ詳細を書き込む
 */
export function writePRSizeToRepositorySheet(
  spreadsheetId: string,
  repository: string,
  details: PRSizeMetrics['prDetails'],
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
      pr.additions,
      pr.deletions,
      pr.linesOfCode,
      pr.filesChanged,
    ]);

    const lastRow = sheet.getLastRow();
    sheet
      .getRange(lastRow + 1, 1, rows.length, REPOSITORY_DETAIL_HEADERS.length)
      .setValues(formatRowsForSheet(rows));

    formatRepositoryPRSizeSheet(sheet);
    logger.info(`✅ [${repository}] Wrote ${filtered.length} PR size records`);

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
 * リポジトリ別PRサイズシートのフォーマットを整える
 */
function formatRepositoryPRSizeSheet(sheet: Sheet): void {
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
 * 全リポジトリをそれぞれのシートに書き込む
 */
export function writePRSizeToAllRepositorySheets(
  spreadsheetId: string,
  metrics: PRSizeMetrics,
  options: { skipDuplicates?: boolean } = {}
): Map<string, { written: number; skipped: number }> {
  const { logger } = getContainer();
  const grouped = groupPRSizeDetailsByRepository(metrics.prDetails);
  const results = new Map<string, { written: number; skipped: number }>();

  logger.info(`📊 Writing PR size to ${grouped.size} repository sheets...`);

  for (const [repository, repoDetails] of grouped) {
    const result = writePRSizeToRepositorySheet(spreadsheetId, repository, repoDetails, options);
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
