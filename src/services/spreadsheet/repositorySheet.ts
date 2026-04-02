/**
 * リポジトリ別シート操作
 *
 * 各リポジトリを個別のシートに分離して書き込む機能を提供。
 * シート名は `owner/repo` 形式で作成される。
 */

import { REPOSITORY_NAME_MAX_LENGTH } from '../../config/apiConfig';
import { getContainer } from '../../container';
import type { Sheet } from '../../interfaces';
import { getHeadersFromSchema, REPOSITORY_DEVOPS_SCHEMA } from '../../schemas';
import type { DevOpsMetrics } from '../../types';
import { applyDataBorders, autoResizeColumns, getOrCreateSheet, openSpreadsheet } from './helpers';

/**
 * 文字列が有効なデプロイメント頻度かをチェックする型ガード
 */
/**
 * レガシー形式のデプロイ頻度（文字列）を数値に変換
 * マイグレーション用のヘルパー関数
 */
function convertLegacyDeploymentFrequency(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  // レガシー形式の変換（後方互換性）
  if (value === 'daily') {
    return 1.0;
  }
  if (value === 'weekly') {
    return 1 / 7;
  }
  if (value === 'monthly') {
    return 1 / 30;
  }
  if (value === 'yearly') {
    return 1 / 365;
  }
  return 0;
}

/**
 * リポジトリ別シートのヘッダー
 * リポジトリ列は不要（シート名で識別）
 */
const REPOSITORY_SHEET_HEADERS = getHeadersFromSchema(REPOSITORY_DEVOPS_SCHEMA);

/**
 * リポジトリ名からシート名を生成
 *
 * @param repository - リポジトリ名（owner/repo形式）
 * @returns シート名
 */
export function getRepositorySheetName(repository: string): string {
  // Google Sheetsのシート名制限: 100文字以内
  // owner/repo形式をそのまま使用（スラッシュはシート名に使用可能）
  return repository.length > REPOSITORY_NAME_MAX_LENGTH
    ? repository.substring(0, REPOSITORY_NAME_MAX_LENGTH)
    : repository;
}

/**
 * リポジトリ別にメトリクスを分類
 *
 * @param metrics - 全メトリクス
 * @returns リポジトリ名をキーとしたマップ
 */
export function groupMetricsByRepository(metrics: DevOpsMetrics[]): Map<string, DevOpsMetrics[]> {
  const grouped = new Map<string, DevOpsMetrics[]>();

  for (const metric of metrics) {
    const existing = grouped.get(metric.repository) ?? [];
    existing.push(metric);
    grouped.set(metric.repository, existing);
  }

  return grouped;
}

/**
 * 既存データの日付キーを収集（リポジトリ別シート用）
 */
function getExistingDateKeys(sheet: Sheet): Set<string> {
  const keys = new Set<string>();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return keys;
  }

  // 日付列のみを取得（1列目）
  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (const row of data) {
    const date = String(row[0]);
    if (date) {
      keys.add(date);
    }
  }

  return keys;
}

/**
 * リポジトリ別シートにメトリクスを書き込む
 *
 * @param spreadsheetId - スプレッドシートID
 * @param repository - リポジトリ名（owner/repo形式）
 * @param metrics - 書き込むメトリクス（このリポジトリのもののみ）
 * @param options - オプション
 */
export function writeMetricsToRepositorySheet(
  spreadsheetId: string,
  repository: string,
  metrics: DevOpsMetrics[],
  options: { skipDuplicates?: boolean } = {}
): { written: number; skipped: number } {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const sheetName = getRepositorySheetName(repository);
  const sheet = getOrCreateSheet(spreadsheet, sheetName, REPOSITORY_SHEET_HEADERS);

  if (metrics.length === 0) {
    return { written: 0, skipped: 0 };
  }

  const skipDuplicates = options.skipDuplicates !== false;
  let metricsToWrite = metrics;
  let skippedCount = 0;

  if (skipDuplicates) {
    const existingKeys = getExistingDateKeys(sheet);
    const originalCount = metrics.length;
    metricsToWrite = metrics.filter((m) => !existingKeys.has(m.date));
    skippedCount = originalCount - metricsToWrite.length;
  }

  if (metricsToWrite.length === 0) {
    return { written: 0, skipped: skippedCount };
  }

  // リポジトリ列を除いた行データを作成
  const rows = metricsToWrite.map((m) => [
    m.date,
    m.deploymentCount,
    m.deploymentFrequency,
    m.leadTimeForChangesHours,
    m.totalDeployments,
    m.failedDeployments,
    m.changeFailureRate,
    m.meanTimeToRecoveryHours ?? 'N/A',
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, REPOSITORY_SHEET_HEADERS.length).setValues(rows);

  formatRepositorySheet(sheet);
  logger.log(`✅ [${repository}] Wrote ${metricsToWrite.length} records`);

  return { written: metricsToWrite.length, skipped: skippedCount };
}

/**
 * リポジトリ別シートのフォーマットを整える
 */
function formatRepositorySheet(sheet: Sheet): void {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow > 1) {
    // デプロイ回数（2列目）: 整数
    sheet.getRange(2, 2, lastRow - 1, 1).setNumberFormat('#,##0');
    // リードタイム（4列目）: 小数1桁
    sheet.getRange(2, 4, lastRow - 1, 1).setNumberFormat('#,##0.0');
    // 総デプロイ数、失敗デプロイ数（5-6列目）: 整数
    sheet.getRange(2, 5, lastRow - 1, 2).setNumberFormat('#,##0');
    // 変更障害率（7列目）: 小数1桁
    sheet.getRange(2, 7, lastRow - 1, 1).setNumberFormat('#,##0.0');
    // MTTR（8列目）: 小数1桁
    sheet.getRange(2, 8, lastRow - 1, 1).setNumberFormat('#,##0.0');

    // データ範囲にボーダーを適用
    applyDataBorders(sheet, lastRow - 1, lastCol);
  }

  autoResizeColumns(sheet, lastCol);
}

/**
 * 全リポジトリをそれぞれのシートに書き込む
 *
 * @param spreadsheetId - スプレッドシートID
 * @param metrics - 全メトリクス（複数リポジトリ混在可）
 * @param options - オプション
 * @returns 各リポジトリの書き込み結果
 */
export function writeMetricsToAllRepositorySheets(
  spreadsheetId: string,
  metrics: DevOpsMetrics[],
  options: { skipDuplicates?: boolean } = {}
): Map<string, { written: number; skipped: number }> {
  const { logger } = getContainer();
  const grouped = groupMetricsByRepository(metrics);
  const results = new Map<string, { written: number; skipped: number }>();

  logger.log(`📊 Writing metrics to ${grouped.size} repository sheets...`);

  for (const [repository, repoMetrics] of grouped) {
    const result = writeMetricsToRepositorySheet(spreadsheetId, repository, repoMetrics, options);
    results.set(repository, result);
  }

  // 集計ログ
  let totalWritten = 0;
  let totalSkipped = 0;
  for (const result of results.values()) {
    totalWritten += result.written;
    totalSkipped += result.skipped;
  }

  logger.log(
    `✅ Total: ${totalWritten} written, ${totalSkipped} skipped across ${grouped.size} repositories`
  );

  return results;
}

/**
 * 行データをDevOpsMetricsにパース（リポジトリ別シート用）
 */
function parseRepositoryMetricRow(row: unknown[], repository: string): DevOpsMetrics {
  return {
    date: String(row[0]),
    repository: repository,
    deploymentCount: Number(row[1]) || 0,
    deploymentFrequency: convertLegacyDeploymentFrequency(row[2]),
    leadTimeForChangesHours: Number(row[3]) || 0,
    totalDeployments: Number(row[4]) || 0,
    failedDeployments: Number(row[5]) || 0,
    changeFailureRate: Number(row[6]) || 0,
    meanTimeToRecoveryHours: row[7] === 'N/A' ? null : Number(row[7]) || null,
  };
}

/**
 * 指定されたリポジトリのシートからメトリクスを読み取る
 *
 * @param spreadsheetId - スプレッドシートID
 * @param repository - リポジトリ名
 * @returns メトリクス配列（シートが存在しない場合は空配列）
 */
export function readMetricsFromRepositorySheet(
  spreadsheetId: string,
  repository: string
): DevOpsMetrics[] {
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const sheetName = getRepositorySheetName(repository);
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    return [];
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }

  const data = sheet.getRange(2, 1, lastRow - 1, REPOSITORY_SHEET_HEADERS.length).getValues();
  const metrics: DevOpsMetrics[] = [];

  for (const row of data) {
    metrics.push(parseRepositoryMetricRow(row, repository));
  }

  return metrics;
}

/**
 * 全リポジトリシートからメトリクスを読み取る
 *
 * @param spreadsheetId - スプレッドシートID
 * @param repositories - リポジトリ名の配列
 * @returns 全メトリクス
 */
export function readMetricsFromAllRepositorySheets(
  spreadsheetId: string,
  repositories: string[]
): DevOpsMetrics[] {
  const allMetrics: DevOpsMetrics[] = [];

  for (const repository of repositories) {
    const metrics = readMetricsFromRepositorySheet(spreadsheetId, repository);
    allMetrics.push(...metrics);
  }

  return allMetrics;
}
