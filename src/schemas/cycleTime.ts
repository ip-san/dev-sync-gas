/**
 * サイクルタイム スキーマ定義
 */
import type { SheetSchema } from './types';

export const CYCLE_TIME_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: 'サイクルタイム',
  columns: [
    { id: 'period', header: '期間', type: 'string' },
    { id: 'completedTaskCount', header: '完了タスク数', type: 'number', numberFormat: '#,##0' },
    {
      id: 'avgCycleTimeHours',
      header: '平均サイクルタイム (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'avgCycleTimeDays',
      header: '平均サイクルタイム (日)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    { id: 'medianHours', header: '中央値 (時間)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'minHours', header: '最小 (時間)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'maxHours', header: '最大 (時間)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'recordedAt', header: '記録日時', type: 'date' },
  ],
};

export const CYCLE_TIME_DETAIL_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: 'サイクルタイム - Details',
  columns: [
    { id: 'taskId', header: 'タスクID', type: 'string' },
    { id: 'title', header: 'タイトル', type: 'string' },
    { id: 'startedAt', header: '着手日時', type: 'date' },
    { id: 'completedAt', header: '完了日時', type: 'date' },
    {
      id: 'cycleTimeHours',
      header: 'サイクルタイム (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    { id: 'cycleTimeDays', header: 'サイクルタイム (日)', type: 'number', numberFormat: '#,##0.0' },
  ],
};
