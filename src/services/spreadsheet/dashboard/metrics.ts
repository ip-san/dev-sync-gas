/**
 * Dashboardメトリクス抽出・集計
 *
 * リポジトリ別の最新メトリクスを抽出し、拡張指標を統合
 */

import type { DevOpsMetrics } from '../../../types';
import type { Spreadsheet } from '../../../interfaces';
import type { RepositoryLatestData } from '../dashboardTypes';
import { openSpreadsheet } from '../helpers';
import { getExtendedMetricSheetName } from '../extendedMetricsRepositorySheet';
import { SpreadsheetError, ErrorCode, AppError } from '../../../utils/errors';

/**
 * メトリクスから各リポジトリの最新データを抽出
 */
export function extractLatestMetricsByRepository(
  metrics: DevOpsMetrics[]
): Map<string, RepositoryLatestData> {
  const latestByRepo = new Map<string, RepositoryLatestData>();

  for (const metric of metrics) {
    const existing = latestByRepo.get(metric.repository);

    if (!existing || metric.date > existing.latestDate) {
      latestByRepo.set(metric.repository, {
        repository: metric.repository,
        latestDate: metric.date,
        deploymentFrequency: metric.deploymentFrequency,
        leadTimeHours: metric.leadTimeForChangesHours,
        changeFailureRate: metric.changeFailureRate,
        mttrHours: metric.meanTimeToRecoveryHours,
        // 拡張指標は後で統合
        cycleTimeHours: null,
        codingTimeHours: null,
        timeToFirstReviewHours: null,
        reviewDurationHours: null,
        avgLinesOfCode: null,
        avgAdditionalCommits: null,
        avgForcePushCount: null,
      });
    }
  }

  return latestByRepo;
}

/**
 * リポジトリ別シートから数値列の平均を計算
 */
function calculateAverageFromSheet(
  spreadsheet: Spreadsheet,
  sheetName: string,
  columnIndex: number
): number | null {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    return null;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    // ヘッダーのみまたは空
    return null;
  }

  const data = sheet.getRange(2, columnIndex, lastRow - 1, 1).getValues();
  const validValues: number[] = [];

  for (const row of data) {
    const value = row[0];
    if (typeof value === 'number' && !isNaN(value) && value !== null) {
      validValues.push(value);
    }
  }

  if (validValues.length === 0) {
    return null;
  }

  return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
}

/**
 * リポジトリの拡張指標を読み取って統合
 */
export function enrichWithExtendedMetrics(
  spreadsheetId: string,
  latestByRepo: Map<string, RepositoryLatestData>
): void {
  try {
    const spreadsheet = openSpreadsheet(spreadsheetId);

    for (const [repository, data] of latestByRepo) {
      // サイクルタイム (6列目: コーディング時間 (時間))
      const cycleTimeSheetName = getExtendedMetricSheetName(repository, 'サイクルタイム');
      data.cycleTimeHours = calculateAverageFromSheet(spreadsheet, cycleTimeSheetName, 5);

      // コーディング時間 (6列目: コーディング時間 (時間))
      const codingTimeSheetName = getExtendedMetricSheetName(repository, 'コーディング時間');
      data.codingTimeHours = calculateAverageFromSheet(spreadsheet, codingTimeSheetName, 6);

      // レビュー効率 (8列目: レビュー待ち時間、9列目: レビュー時間)
      const reviewEffSheetName = getExtendedMetricSheetName(repository, 'レビュー効率');
      data.timeToFirstReviewHours = calculateAverageFromSheet(spreadsheet, reviewEffSheetName, 8);
      data.reviewDurationHours = calculateAverageFromSheet(spreadsheet, reviewEffSheetName, 9);

      // PRサイズ (7列目: 変更行数)
      const prSizeSheetName = getExtendedMetricSheetName(repository, 'PRサイズ');
      data.avgLinesOfCode = calculateAverageFromSheet(spreadsheet, prSizeSheetName, 7);

      // 手戻り率 (7列目: 追加コミット数、8列目: Force Push回数)
      const reworkRateSheetName = getExtendedMetricSheetName(repository, '手戻り率');
      data.avgAdditionalCommits = calculateAverageFromSheet(spreadsheet, reworkRateSheetName, 7);
      data.avgForcePushCount = calculateAverageFromSheet(spreadsheet, reworkRateSheetName, 8);
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new SpreadsheetError('Failed to enrich with extended metrics', {
      code: ErrorCode.SPREADSHEET_READ_FAILED,
      context: { spreadsheetId, repositoryCount: latestByRepo.size },
      cause: error as Error,
    });
  }
}
