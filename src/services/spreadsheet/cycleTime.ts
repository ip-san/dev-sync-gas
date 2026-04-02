/**
 * サイクルタイム指標スプレッドシート操作
 *
 * Issue作成からproductionマージまでの時間を計測した結果を
 * スプレッドシートに書き出す機能を提供。
 */

import { getContainer } from '../../container';
import type { Sheet } from '../../interfaces';
import type { CycleTimeMetrics, IssueCycleTimeDetail } from '../../types';
import {
  getExtendedMetricDetailSheetName,
  getExtendedMetricSheetName,
  groupIssueDetailsByRepository,
} from './extendedMetricsRepositorySheet';
import {
  applyDataBorders,
  autoResizeColumns,
  formatDecimalColumns,
  getOrCreateSheet,
  openSpreadsheet,
} from './helpers';

const SHEET_NAME = 'サイクルタイム';

/**
 * 集計シートのヘッダー定義
 */
const REPOSITORY_AGGREGATE_HEADERS = [
  '日付',
  '完了Issue数',
  '平均サイクルタイム (時間)',
  '平均サイクルタイム (日)',
  '中央値 (時間)',
  '最小 (時間)',
  '最大 (時間)',
];

/**
 * 詳細シートのヘッダー定義
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
 * Issue詳細を日付ごとにグループ化
 */
interface DailyAggregate {
  date: string;
  issueCount: number;
  avgCycleTimeHours: number;
  medianCycleTimeHours: number;
  minCycleTimeHours: number;
  maxCycleTimeHours: number;
}

/**
 * Issue詳細を完了日ごとにグループ化して集計
 */
function aggregateByDate(details: IssueCycleTimeDetail[]): DailyAggregate[] {
  if (details.length === 0) {
    return [];
  }

  // 日付ごとにグループ化
  const grouped = new Map<string, IssueCycleTimeDetail[]>();
  for (const detail of details) {
    // productionMergedAtから日付のみを抽出 (YYYY-MM-DD)
    const date = detail.productionMergedAt.split('T')[0].split(' ')[0];
    const existing = grouped.get(date) ?? [];
    existing.push(detail);
    grouped.set(date, existing);
  }

  // 各日付の統計値を計算
  const aggregates: DailyAggregate[] = [];
  for (const [date, issues] of grouped) {
    const cycleTimeValues = issues.map((i) => i.cycleTimeHours).sort((a, b) => a - b);
    const sum = cycleTimeValues.reduce((acc, val) => acc + val, 0);
    const avg = sum / cycleTimeValues.length;
    const median =
      cycleTimeValues.length % 2 === 0
        ? (cycleTimeValues[cycleTimeValues.length / 2 - 1] +
            cycleTimeValues[cycleTimeValues.length / 2]) /
          2
        : cycleTimeValues[Math.floor(cycleTimeValues.length / 2)];

    aggregates.push({
      date,
      issueCount: issues.length,
      avgCycleTimeHours: avg,
      medianCycleTimeHours: median,
      minCycleTimeHours: Math.min(...cycleTimeValues),
      maxCycleTimeHours: Math.max(...cycleTimeValues),
    });
  }

  // 日付順にソート
  return aggregates.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * サイクルタイム指標をスプレッドシートに書き出す
 *
 * リポジトリ別の集計シートと詳細シートに書き込む。
 */
export function writeCycleTimeToSheet(spreadsheetId: string, metrics: CycleTimeMetrics): void {
  const { logger } = getContainer();

  // 集計シートと詳細シートの両方に書き込み
  writeCycleTimeToAllRepositorySheets(spreadsheetId, metrics);

  logger.info(`📝 Wrote cycle time metrics to repository sheets (aggregate + details)`);
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

  // 日付列のみを取得（1列目）
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
 * 既存Issueキーを収集（詳細シート用）
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
 * リポジトリ別集計シートにサイクルタイムを書き込む
 *
 * @param spreadsheetId - スプレッドシートID
 * @param repository - リポジトリ名（owner/repo形式）
 * @param details - Issue詳細（このリポジトリのもののみ）
 * @returns 書き込み結果
 */
function writeCycleTimeAggregateToRepositorySheet(
  spreadsheetId: string,
  repository: string,
  details: IssueCycleTimeDetail[]
): { written: number } {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const sheetName = getExtendedMetricSheetName(repository, SHEET_NAME);
  const sheet = getOrCreateSheet(spreadsheet, sheetName, REPOSITORY_AGGREGATE_HEADERS);

  if (details.length === 0) {
    return { written: 0 };
  }

  // 日付ごとに集計
  const aggregates = aggregateByDate(details);

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
    agg.issueCount,
    agg.avgCycleTimeHours,
    Math.round((agg.avgCycleTimeHours / 24) * 10) / 10,
    agg.medianCycleTimeHours,
    agg.minCycleTimeHours,
    agg.maxCycleTimeHours,
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, REPOSITORY_AGGREGATE_HEADERS.length).setValues(rows);

  formatRepositoryCycleTimeAggregateSheet(sheet);
  logger.info(`✅ [${repository}] Wrote ${newAggregates.length} aggregate records`);

  return { written: newAggregates.length };
}

/**
 * リポジトリ別詳細シートにサイクルタイムを書き込む
 *
 * @param spreadsheetId - スプレッドシートID
 * @param repository - リポジトリ名（owner/repo形式）
 * @param details - 書き込むIssue詳細（このリポジトリのもののみ）
 * @param options - オプション
 * @returns 書き込み結果
 */
export function writeCycleTimeDetailsToRepositorySheet(
  spreadsheetId: string,
  repository: string,
  details: IssueCycleTimeDetail[],
  options: { skipDuplicates?: boolean } = {}
): { written: number; skipped: number } {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const sheetName = getExtendedMetricDetailSheetName(repository, SHEET_NAME);
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

  formatRepositoryCycleTimeDetailSheet(sheet);
  logger.info(`✅ [${repository}] Wrote ${detailsToWrite.length} cycle time detail records`);

  return { written: detailsToWrite.length, skipped: skippedCount };
}

/**
 * リポジトリ別サイクルタイム集計シートのフォーマットを整える
 */
function formatRepositoryCycleTimeAggregateSheet(sheet: Sheet): void {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow > 1) {
    // 数値列（3〜7列目）を小数点1桁でフォーマット
    formatDecimalColumns(sheet, 3, 5);

    // データ範囲にボーダーを適用
    applyDataBorders(sheet, lastRow - 1, lastCol);
  }

  autoResizeColumns(sheet, lastCol);
}

/**
 * リポジトリ別サイクルタイム詳細シートのフォーマットを整える
 */
function formatRepositoryCycleTimeDetailSheet(sheet: Sheet): void {
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
 * 全リポジトリをそれぞれのシートに書き込む（集計 + 詳細）
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

  logger.info(
    `📊 Writing cycle time to ${grouped.size} repository sheets (aggregate + details)...`
  );

  for (const [repository, repoDetails] of grouped) {
    // 集計シート作成
    const aggregateResult = writeCycleTimeAggregateToRepositorySheet(
      spreadsheetId,
      repository,
      repoDetails
    );

    // 詳細シート作成
    const detailResult = writeCycleTimeDetailsToRepositorySheet(
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

/**
 * リポジトリ別シートにサイクルタイムを書き込む（後方互換性用）
 * @deprecated Use writeCycleTimeDetailsToRepositorySheet instead
 */
export function writeCycleTimeToRepositorySheet(
  spreadsheetId: string,
  repository: string,
  details: IssueCycleTimeDetail[],
  options: { skipDuplicates?: boolean } = {}
): { written: number; skipped: number } {
  return writeCycleTimeDetailsToRepositorySheet(spreadsheetId, repository, details, options);
}
