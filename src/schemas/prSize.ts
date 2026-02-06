/**
 * PRサイズ スキーマ定義
 */
import type { SheetSchema } from './types';

export const PR_SIZE_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: 'PRサイズ',
  columns: [
    { id: 'period', header: '期間', type: 'string' },
    { id: 'prCount', header: 'PR数', type: 'number', numberFormat: '#,##0' },
    { id: 'linesOfCodeTotal', header: '変更行数 (合計)', type: 'number', numberFormat: '#,##0' },
    { id: 'linesOfCodeAvg', header: '変更行数 (平均)', type: 'number', numberFormat: '#,##0.0' },
    {
      id: 'linesOfCodeMedian',
      header: '変更行数 (中央値)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    { id: 'linesOfCodeMin', header: '変更行数 (最小)', type: 'number', numberFormat: '#,##0' },
    { id: 'linesOfCodeMax', header: '変更行数 (最大)', type: 'number', numberFormat: '#,##0' },
    {
      id: 'filesChangedTotal',
      header: '変更ファイル数 (合計)',
      type: 'number',
      numberFormat: '#,##0',
    },
    {
      id: 'filesChangedAvg',
      header: '変更ファイル数 (平均)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'filesChangedMedian',
      header: '変更ファイル数 (中央値)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'filesChangedMin',
      header: '変更ファイル数 (最小)',
      type: 'number',
      numberFormat: '#,##0',
    },
    {
      id: 'filesChangedMax',
      header: '変更ファイル数 (最大)',
      type: 'number',
      numberFormat: '#,##0',
    },
    { id: 'recordedAt', header: '記録日時', type: 'date' },
  ],
};

export const PR_SIZE_DETAIL_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: 'PRサイズ - Details',
  columns: [
    { id: 'prNumber', header: 'PR番号', type: 'number', numberFormat: '#,##0' },
    { id: 'title', header: 'タイトル', type: 'string' },
    { id: 'repository', header: 'リポジトリ', type: 'string' },
    { id: 'createdAt', header: '作成日時', type: 'date' },
    { id: 'mergedAt', header: 'マージ日時', type: 'date' },
    { id: 'additions', header: '追加行数', type: 'number', numberFormat: '#,##0' },
    { id: 'deletions', header: '削除行数', type: 'number', numberFormat: '#,##0' },
    { id: 'linesOfCode', header: '変更行数', type: 'number', numberFormat: '#,##0' },
    { id: 'filesChanged', header: '変更ファイル数', type: 'number', numberFormat: '#,##0' },
  ],
};
