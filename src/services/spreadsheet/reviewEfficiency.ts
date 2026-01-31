/**
 * レビュー効率指標スプレッドシート操作
 *
 * PRの各ステータスにおける滞留時間を計測した結果を
 * スプレッドシートに書き出す機能を提供。
 */

import type { ReviewEfficiencyMetrics } from '../../types';
import { getContainer } from '../../container';
import {
  getOrCreateSheet,
  autoResizeColumns,
  openSpreadsheet,
  formatDecimalColumns,
  applyDataBorders,
} from './helpers';

const SHEET_NAME = 'レビュー効率';

/**
 * サマリーシートのヘッダー定義
 * PRの各ステータス間の時間を計測
 */
const SUMMARY_HEADERS = [
  '期間', // 計測期間
  'PR数', // 分析対象のPR数
  'レビュー待ち時間 (平均)', // Ready for Review → First Review
  'レビュー待ち時間 (中央値)', // 外れ値の影響を受けにくい
  'レビュー待ち時間 (最小)', // 最も早くレビューされたPR
  'レビュー待ち時間 (最大)', // 最も待たされたPR
  'レビュー時間 (平均)', // First Review → Approved
  'レビュー時間 (中央値)', // コード理解・修正にかかる時間
  'レビュー時間 (最小)', // 最も早く承認されたPR
  'レビュー時間 (最大)', // 最も時間がかかったPR
  'マージ待ち時間 (平均)', // Approved → Merged
  'マージ待ち時間 (中央値)', // 承認後のプロセス時間
  'マージ待ち時間 (最小)', // 最も早くマージされたPR
  'マージ待ち時間 (最大)', // 最も待たされたPR
  '全体時間 (平均)', // Ready for Review → Merged
  '全体時間 (中央値)', // PR完了までの総時間
  '全体時間 (最小)', // 最も早く完了したPR
  '全体時間 (最大)', // 最も時間がかかったPR
  '記録日時', // データ記録時刻
];

/**
 * 詳細シートのヘッダー定義
 */
const DETAIL_HEADERS = [
  'PR番号', // GitHubのPR番号
  'タイトル', // PRタイトル
  'リポジトリ', // 対象リポジトリ
  '作成日時', // PR作成日時
  'レビュー準備完了日時', // Ready for Review になった日時
  '初回レビュー日時', // 最初のレビューを受けた日時
  '承認日時', // Approvedになった日時
  'マージ日時', // マージされた日時
  'レビュー待ち時間 (時間)', // Ready → First Review
  'レビュー時間 (時間)', // First Review → Approved
  'マージ待ち時間 (時間)', // Approved → Merged
  '全体時間 (時間)', // Ready → Merged
];

/**
 * レビュー効率指標をスプレッドシートに書き出す
 *
 * 2つのシートを作成/更新:
 * - "レビュー効率": サマリー情報
 * - "レビュー効率 - Details": 各PRの詳細
 */
export function writeReviewEfficiencyToSheet(
  spreadsheetId: string,
  metrics: ReviewEfficiencyMetrics
): void {
  const { logger } = getContainer();
  const spreadsheet = openSpreadsheet(spreadsheetId);

  writeSummarySheet(spreadsheet, metrics);
  writeDetailSheet(spreadsheet, metrics);

  logger.log(`📝 Wrote review efficiency metrics to sheet "${SHEET_NAME}"`);
}

/**
 * サマリーシートに書き込み
 */
function writeSummarySheet(
  spreadsheet: ReturnType<typeof openSpreadsheet>,
  metrics: ReviewEfficiencyMetrics
): void {
  const sheet = getOrCreateSheet(spreadsheet, SHEET_NAME, SUMMARY_HEADERS);

  const row = [
    metrics.period,
    metrics.prCount,
    metrics.timeToFirstReview.avgHours ?? 'N/A',
    metrics.timeToFirstReview.medianHours ?? 'N/A',
    metrics.timeToFirstReview.minHours ?? 'N/A',
    metrics.timeToFirstReview.maxHours ?? 'N/A',
    metrics.reviewDuration.avgHours ?? 'N/A',
    metrics.reviewDuration.medianHours ?? 'N/A',
    metrics.reviewDuration.minHours ?? 'N/A',
    metrics.reviewDuration.maxHours ?? 'N/A',
    metrics.timeToMerge.avgHours ?? 'N/A',
    metrics.timeToMerge.medianHours ?? 'N/A',
    metrics.timeToMerge.minHours ?? 'N/A',
    metrics.timeToMerge.maxHours ?? 'N/A',
    metrics.totalTime.avgHours ?? 'N/A',
    metrics.totalTime.medianHours ?? 'N/A',
    metrics.totalTime.minHours ?? 'N/A',
    metrics.totalTime.maxHours ?? 'N/A',
    new Date().toISOString(),
  ];

  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1, 1, SUMMARY_HEADERS.length).setValues([row]);

  // 時間列（3-18列目）を小数点1桁でフォーマット
  formatDecimalColumns(sheet, 3, 16);

  // データ範囲にボーダーを適用
  const lastRowAfterWrite = sheet.getLastRow();
  if (lastRowAfterWrite > 1) {
    applyDataBorders(sheet, lastRowAfterWrite - 1, SUMMARY_HEADERS.length);
  }

  autoResizeColumns(sheet, SUMMARY_HEADERS.length);
}

/**
 * 詳細シートに書き込み
 */
function writeDetailSheet(
  spreadsheet: ReturnType<typeof openSpreadsheet>,
  metrics: ReviewEfficiencyMetrics
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
  sheet.getRange(lastRow + 1, 1, rows.length, DETAIL_HEADERS.length).setValues(rows);

  // 時間列（9-12列目）を小数点1桁でフォーマット
  formatDecimalColumns(sheet, 9, 4);

  // データ範囲にボーダーを適用
  const lastRowAfterWrite = sheet.getLastRow();
  if (lastRowAfterWrite > 1) {
    applyDataBorders(sheet, lastRowAfterWrite - 1, DETAIL_HEADERS.length);
  }

  autoResizeColumns(sheet, DETAIL_HEADERS.length);
}
