/**
 * DevOps Metrics（DORA指標）スプレッドシート操作
 *
 * DORA Four Key Metricsをスプレッドシートに書き出す機能を提供。
 * - writeMetricsToSheet: メトリクス書き出し
 * - clearOldData: 古いデータのクリーンアップ
 */

import type { DevOpsMetrics } from '../../types';
import type { Sheet } from '../../interfaces';
import { getContainer } from '../../container';
import { getOrCreateSheet, autoResizeColumns, applyDataBorders, openSpreadsheet } from './helpers';

/**
 * DevOps Metrics シートのヘッダー定義
 * DORA Four Key Metrics に基づく指標
 */
const HEADERS = [
  '日付', // 計測日
  'リポジトリ', // 対象リポジトリ名
  'デプロイ回数', // 期間内のデプロイ回数
  'デプロイ頻度', // デプロイ頻度（回/日）
  'リードタイム (時間)', // コード変更から本番デプロイまでの時間
  '総デプロイ数', // 累計デプロイ数
  '失敗デプロイ数', // 失敗したデプロイの数
  '変更障害率 (%)', // 失敗デプロイ / 総デプロイ × 100
  '平均復旧時間 (時間)', // Mean Time To Recovery
];

/**
 * DevOps Metricsをスプレッドシートに書き出す
 */
export function writeMetricsToSheet(
  spreadsheetId: string,
  sheetName: string,
  metrics: DevOpsMetrics[]
): void {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const sheet = getOrCreateSheet(spreadsheet, sheetName, HEADERS);

  if (metrics.length === 0) {
    logger.log('⚠️ No metrics to write');
    return;
  }

  const rows = metrics.map((m) => [
    m.date,
    m.repository,
    m.deploymentCount,
    m.deploymentFrequency,
    m.leadTimeForChangesHours,
    m.totalDeployments,
    m.failedDeployments,
    m.changeFailureRate,
    m.meanTimeToRecoveryHours ?? 'N/A',
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, HEADERS.length).setValues(rows);

  formatSheet(sheet);
}

/**
 * 既存データの(date, repository)キーを収集
 */
function getExistingKeys(sheet: Sheet): Set<string> {
  const keys = new Set<string>();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return keys;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();

  for (const row of data) {
    const date = String(row[0]);
    const repository = String(row[1]);
    if (date && repository) {
      keys.add(`${date}_${repository}`);
    }
  }

  return keys;
}

/**
 * 重複チェック付きでメトリクスを書き込む
 *
 * @param spreadsheetId - スプレッドシートID
 * @param sheetName - シート名
 * @param metrics - 書き込むメトリクス
 * @param options - オプション
 *   - skipDuplicates: 重複をスキップ（デフォルト: true）
 */
export function writeMetricsWithDuplicateCheck(
  spreadsheetId: string,
  sheetName: string,
  metrics: DevOpsMetrics[],
  options: { skipDuplicates?: boolean } = {}
): void {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const sheet = getOrCreateSheet(spreadsheet, sheetName, HEADERS);

  if (metrics.length === 0) {
    logger.log('⚠️ No metrics to write');
    return;
  }

  const skipDuplicates = options.skipDuplicates !== false;

  let metricsToWrite = metrics;

  if (skipDuplicates) {
    // 既存データの(date, repository)キーを収集
    const existingKeys = getExistingKeys(sheet);
    logger.log(`📋 Found ${existingKeys.size} existing records`);

    // 重複を除外
    const originalCount = metrics.length;
    metricsToWrite = metrics.filter((m) => {
      const key = `${m.date}_${m.repository}`;
      return !existingKeys.has(key);
    });

    const skippedCount = originalCount - metricsToWrite.length;
    if (skippedCount > 0) {
      logger.log(`⏭️ Skipped ${skippedCount} duplicate records`);
    }
  }

  if (metricsToWrite.length === 0) {
    logger.log('✅ All records already exist, nothing to write');
    return;
  }

  // 書き込み
  const rows = metricsToWrite.map((m) => [
    m.date,
    m.repository,
    m.deploymentCount,
    m.deploymentFrequency,
    m.leadTimeForChangesHours,
    m.totalDeployments,
    m.failedDeployments,
    m.changeFailureRate,
    m.meanTimeToRecoveryHours ?? 'N/A',
  ]);

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, rows.length, HEADERS.length).setValues(rows);

  formatSheet(sheet);
  logger.log(`✅ Wrote ${metricsToWrite.length} new records`);
}

/**
 * シートのフォーマットを整える
 */
function formatSheet(sheet: Sheet): void {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  // 数値列のフォーマット
  if (lastRow > 1) {
    sheet.getRange(2, 3, lastRow - 1, 1).setNumberFormat('#,##0');
    sheet.getRange(2, 5, lastRow - 1, 1).setNumberFormat('#,##0.0');
    sheet.getRange(2, 8, lastRow - 1, 1).setNumberFormat('#,##0.0');

    // データ範囲にボーダーを適用
    applyDataBorders(sheet, lastRow - 1, lastCol);
  }

  autoResizeColumns(sheet, lastCol);
}

/**
 * 古いデータを削除する
 *
 * @param daysToKeep - 保持する日数（デフォルト: 90日）
 */
export function clearOldData(spreadsheetId: string, sheetName: string, daysToKeep = 90): void {
  const spreadsheet = openSpreadsheet(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    return;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const data = sheet.getDataRange().getValues();
  const rowsToDelete: number[] = [];

  // 古い行を逆順で収集（削除時のインデックスずれを防ぐ）
  for (let i = data.length - 1; i >= 1; i--) {
    const rowDate = new Date(data[i][0] as string);
    if (rowDate < cutoffDate) {
      rowsToDelete.push(i + 1);
    }
  }

  for (const row of rowsToDelete) {
    sheet.deleteRow(row);
  }
}
