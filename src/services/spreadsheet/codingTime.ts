/**
 * コーディング時間指標スプレッドシート操作
 *
 * Issue作成からPR作成までの時間を計測した結果を
 * スプレッドシートに書き出す機能を提供。
 */

import type { CodingTimeMetrics, IssueCodingTimeDetail } from '../../types';
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
  groupIssueDetailsByRepository,
  getExtendedMetricSheetName,
} from './extendedMetricsRepositorySheet';

const SHEET_NAME = 'コーディング時間';

/**
 * リポジトリ別シートのヘッダー定義（リポジトリ列を除く）
 */
const REPOSITORY_DETAIL_HEADERS = [
  'Issue番号',
  'タイトル',
  'Issue作成日時',
  'PR作成日時',
  'PR番号',
  'コーディング時間 (時間)',
  'コーディング時間 (日)',
];

/**
 * コーディング時間指標をスプレッドシートに書き出す
 *
 * リポジトリ別シートに書き込む。
 */
export function writeCodingTimeToSheet(spreadsheetId: string, metrics: CodingTimeMetrics): void {
  const { logger } = getContainer();

  // リポジトリ別シートに書き込み
  writeCodingTimeToAllRepositorySheets(spreadsheetId, metrics);

  logger.info(`📝 Wrote coding time metrics to repository sheets`);
}

/**
 * 既存Issueキーを収集（リポジトリ別シート用）
 */
function getExistingIssueKeys(sheet: Sheet): Set<number> {
  const keys = new Set<number>();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return keys;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (const row of data) {
    const issueNum = Number(String(row[0]).replace('#', ''));
    if (issueNum) {
      keys.add(issueNum);
    }
  }

  return keys;
}

/**
 * リポジトリ別シートにコーディング時間詳細を書き込む
 */
export function writeCodingTimeToRepositorySheet(
  spreadsheetId: string,
  repository: string,
  details: IssueCodingTimeDetail[],
  options: { skipDuplicates?: boolean } = {}
): { written: number; skipped: number } {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const sheetName = getExtendedMetricSheetName(repository, SHEET_NAME);
  const sheet = getOrCreateSheet(spreadsheet, sheetName, REPOSITORY_DETAIL_HEADERS);

  if (details.length === 0) {
    return { written: 0, skipped: 0 };
  }

  const skipDuplicates = options.skipDuplicates !== false;
  let detailsToWrite = details;
  let skippedCount = 0;

  if (skipDuplicates) {
    const existingKeys = getExistingIssueKeys(sheet);
    const originalCount = details.length;
    detailsToWrite = details.filter((d) => !existingKeys.has(d.issueNumber));
    skippedCount = originalCount - detailsToWrite.length;
  }

  if (detailsToWrite.length === 0) {
    return { written: 0, skipped: skippedCount };
  }

  const rows = detailsToWrite.map((issue) => [
    `#${issue.issueNumber}`,
    issue.title,
    issue.issueCreatedAt,
    issue.prCreatedAt,
    `#${issue.prNumber}`,
    issue.codingTimeHours,
    Math.round((issue.codingTimeHours / 24) * 10) / 10,
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, REPOSITORY_DETAIL_HEADERS.length).setValues(rows);

  formatRepositoryCodingTimeSheet(sheet);
  logger.info(`✅ [${repository}] Wrote ${detailsToWrite.length} coding time records`);

  return { written: detailsToWrite.length, skipped: skippedCount };
}

/**
 * リポジトリ別コーディング時間シートのフォーマットを整える
 */
function formatRepositoryCodingTimeSheet(sheet: Sheet): void {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow > 1) {
    // コーディング時間列（6〜7列目）を小数点1桁でフォーマット
    formatDecimalColumns(sheet, 6, 2);
    applyDataBorders(sheet, lastRow - 1, lastCol);
  }

  autoResizeColumns(sheet, lastCol);
}

/**
 * 全リポジトリをそれぞれのシートに書き込む
 */
export function writeCodingTimeToAllRepositorySheets(
  spreadsheetId: string,
  metrics: CodingTimeMetrics,
  options: { skipDuplicates?: boolean } = {}
): Map<string, { written: number; skipped: number }> {
  const { logger } = getContainer();
  const grouped = groupIssueDetailsByRepository(metrics.issueDetails);
  const results = new Map<string, { written: number; skipped: number }>();

  logger.info(`📊 Writing coding time to ${grouped.size} repository sheets...`);

  for (const [repository, repoDetails] of grouped) {
    const result = writeCodingTimeToRepositorySheet(
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
