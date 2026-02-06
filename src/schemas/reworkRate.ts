/**
 * 手戻り率 スキーマ定義
 */
import type { SheetSchema } from './types';

export const REWORK_RATE_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: '手戻り率',
  columns: [
    { id: 'period', header: '期間', type: 'string' },
    { id: 'prCount', header: 'PR数', type: 'number', numberFormat: '#,##0' },
    {
      id: 'additionalCommitsTotal',
      header: '追加コミット数 (合計)',
      type: 'number',
      numberFormat: '#,##0',
    },
    {
      id: 'additionalCommitsAvg',
      header: '追加コミット数 (平均)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'additionalCommitsMedian',
      header: '追加コミット数 (中央値)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'additionalCommitsMax',
      header: '追加コミット数 (最大)',
      type: 'number',
      numberFormat: '#,##0',
    },
    {
      id: 'forcePushTotal',
      header: 'Force Push回数 (合計)',
      type: 'number',
      numberFormat: '#,##0',
    },
    {
      id: 'forcePushAvg',
      header: 'Force Push回数 (平均)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'prsWithForcePush',
      header: 'Force Pushがあった PR数',
      type: 'number',
      numberFormat: '#,##0',
    },
    { id: 'forcePushRate', header: 'Force Push率 (%)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'recordedAt', header: '記録日時', type: 'date' },
  ],
};

export const REWORK_RATE_DETAIL_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: '手戻り率 - Details',
  columns: [
    { id: 'prNumber', header: 'PR番号', type: 'number', numberFormat: '#,##0' },
    { id: 'title', header: 'タイトル', type: 'string' },
    { id: 'repository', header: 'リポジトリ', type: 'string' },
    { id: 'createdAt', header: '作成日時', type: 'date' },
    { id: 'mergedAt', header: 'マージ日時', type: 'date' },
    { id: 'totalCommits', header: '総コミット数', type: 'number', numberFormat: '#,##0' },
    { id: 'additionalCommits', header: '追加コミット数', type: 'number', numberFormat: '#,##0' },
    { id: 'forcePushCount', header: 'Force Push回数', type: 'number', numberFormat: '#,##0' },
  ],
};
