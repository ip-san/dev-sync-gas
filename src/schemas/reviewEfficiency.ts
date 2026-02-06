/**
 * レビュー効率 スキーマ定義
 */
import type { SheetSchema } from './types';

export const REVIEW_EFFICIENCY_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: 'レビュー効率',
  columns: [
    { id: 'period', header: '期間', type: 'string' },
    { id: 'prCount', header: 'PR数', type: 'number', numberFormat: '#,##0' },
    {
      id: 'timeToFirstReviewAvg',
      header: 'レビュー待ち時間 (平均)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'timeToFirstReviewMedian',
      header: 'レビュー待ち時間 (中央値)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'timeToFirstReviewMin',
      header: 'レビュー待ち時間 (最小)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'timeToFirstReviewMax',
      header: 'レビュー待ち時間 (最大)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'reviewDurationAvg',
      header: 'レビュー時間 (平均)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'reviewDurationMedian',
      header: 'レビュー時間 (中央値)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'reviewDurationMin',
      header: 'レビュー時間 (最小)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'reviewDurationMax',
      header: 'レビュー時間 (最大)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'timeToMergeAvg',
      header: 'マージ待ち時間 (平均)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'timeToMergeMedian',
      header: 'マージ待ち時間 (中央値)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'timeToMergeMin',
      header: 'マージ待ち時間 (最小)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'timeToMergeMax',
      header: 'マージ待ち時間 (最大)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    { id: 'totalTimeAvg', header: '全体時間 (平均)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'totalTimeMedian', header: '全体時間 (中央値)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'totalTimeMin', header: '全体時間 (最小)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'totalTimeMax', header: '全体時間 (最大)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'recordedAt', header: '記録日時', type: 'date' },
  ],
};

export const REVIEW_EFFICIENCY_DETAIL_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: 'レビュー効率 - Details',
  columns: [
    { id: 'prNumber', header: 'PR番号', type: 'number', numberFormat: '#,##0' },
    { id: 'title', header: 'タイトル', type: 'string' },
    { id: 'repository', header: 'リポジトリ', type: 'string' },
    { id: 'createdAt', header: '作成日時', type: 'date' },
    { id: 'readyForReviewAt', header: 'レビュー準備完了日時', type: 'date' },
    { id: 'firstReviewAt', header: '初回レビュー日時', type: 'date' },
    { id: 'approvedAt', header: '承認日時', type: 'date' },
    { id: 'mergedAt', header: 'マージ日時', type: 'date' },
    {
      id: 'timeToFirstReviewHours',
      header: 'レビュー待ち時間 (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'reviewDurationHours',
      header: 'レビュー時間 (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'timeToMergeHours',
      header: 'マージ待ち時間 (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    { id: 'totalTimeHours', header: '全体時間 (時間)', type: 'number', numberFormat: '#,##0.0' },
  ],
};
