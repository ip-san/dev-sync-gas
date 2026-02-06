/**
 * コーディング時間 スキーマ定義
 */
import type { SheetSchema } from './types';

export const CODING_TIME_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: 'コーディング時間',
  columns: [
    { id: 'period', header: '期間', type: 'string' },
    { id: 'taskCount', header: 'タスク数', type: 'number', numberFormat: '#,##0' },
    {
      id: 'avgCodingTimeHours',
      header: '平均コーディング時間 (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'avgCodingTimeDays',
      header: '平均コーディング時間 (日)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    { id: 'medianHours', header: '中央値 (時間)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'minHours', header: '最小 (時間)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'maxHours', header: '最大 (時間)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'recordedAt', header: '記録日時', type: 'date' },
  ],
};

export const CODING_TIME_DETAIL_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: 'コーディング時間 - Details',
  columns: [
    { id: 'taskId', header: 'タスクID', type: 'string' },
    { id: 'title', header: 'タイトル', type: 'string' },
    { id: 'startedAt', header: '着手日時', type: 'date' },
    { id: 'prCreatedAt', header: 'PR作成日時', type: 'date' },
    { id: 'prUrl', header: 'PR URL', type: 'string' },
    {
      id: 'codingTimeHours',
      header: 'コーディング時間 (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'codingTimeDays',
      header: 'コーディング時間 (日)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
  ],
};
