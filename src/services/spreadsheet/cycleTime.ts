/**
 * サイクルタイム指標スプレッドシート操作
 *
 * Issue作成からproductionマージまでの時間を計測した結果を
 * スプレッドシートに書き出す機能を提供。
 */

import type { CycleTimeMetrics, IssueCycleTimeDetail } from '../../types';
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

const SHEET_NAME = 'サイクルタイム';

/**
 * リポジトリ別シートのヘッダー定義（リポジトリ列を除く）
 */
const REPOSITORY_DETAIL_HEADERS = [
  'Issue番号',
  'タイトル',
  'Issue作成日時',
  'Productionマージ日時',
  'サイクルタイム (時間)',
  'サイクルタイム (日)',
  'PRチェーン',
];

/**
 * サイクルタイム指標をスプレッドシートに書き出す
 *
 * リポジトリ別シートに書き込む。
 * レガシーのグローバルシート（"サイクルタイム"、"サイクルタイム - Details"）は作成されない。
 */
export function writeCycleTimeToSheet(spreadsheetId: string, metrics: CycleTimeMetrics): void {
  const { logger } = getContainer();

  // リポジトリ別シートに書き込み
  writeCycleTimeToAllRepositorySheets(spreadsheetId, metrics);

  logger.info(`📝 Wrote cycle time metrics to repository sheets`);
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

  // Issue番号列のみを取得（1列目）
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
 * リポジトリ別シートにサイクルタイム詳細を書き込む
 *
 * @param spreadsheetId - スプレッドシートID
 * @param repository - リポジトリ名（owner/repo形式）
 * @param details - 書き込むIssue詳細（このリポジトリのもののみ）
 * @param options - オプション
 * @returns 書き込み結果
 */
export function writeCycleTimeToRepositorySheet(
  spreadsheetId: string,
  repository: string,
  details: IssueCycleTimeDetail[],
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

  // リポジトリ列を除いた行データを作成
  const rows = detailsToWrite.map((issue) => [
    `#${issue.issueNumber}`,
    issue.title,
    issue.issueCreatedAt,
    issue.productionMergedAt,
    issue.cycleTimeHours,
    Math.round((issue.cycleTimeHours / 24) * 10) / 10,
    issue.prChainSummary,
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, REPOSITORY_DETAIL_HEADERS.length).setValues(rows);

  formatRepositoryCycleTimeSheet(sheet);
  logger.info(`✅ [${repository}] Wrote ${detailsToWrite.length} cycle time records`);

  return { written: detailsToWrite.length, skipped: skippedCount };
}

/**
 * リポジトリ別サイクルタイムシートのフォーマットを整える
 */
function formatRepositoryCycleTimeSheet(sheet: Sheet): void {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow > 1) {
    // サイクルタイム列（5〜6列目）を小数点1桁でフォーマット
    formatDecimalColumns(sheet, 5, 2);

    // データ範囲にボーダーを適用
    applyDataBorders(sheet, lastRow - 1, lastCol);
  }

  autoResizeColumns(sheet, lastCol);
}

/**
 * 全リポジトリをそれぞれのシートに書き込む
 *
 * @param spreadsheetId - スプレッドシートID
 * @param metrics - サイクルタイムメトリクス
 * @param options - オプション
 * @returns 各リポジトリの書き込み結果
 */
export function writeCycleTimeToAllRepositorySheets(
  spreadsheetId: string,
  metrics: CycleTimeMetrics,
  options: { skipDuplicates?: boolean } = {}
): Map<string, { written: number; skipped: number }> {
  const { logger } = getContainer();
  const grouped = groupIssueDetailsByRepository(metrics.issueDetails);
  const results = new Map<string, { written: number; skipped: number }>();

  logger.info(`📊 Writing cycle time to ${grouped.size} repository sheets...`);

  for (const [repository, repoDetails] of grouped) {
    const result = writeCycleTimeToRepositorySheet(spreadsheetId, repository, repoDetails, options);
    results.set(repository, result);
  }

  // 集計ログ
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
