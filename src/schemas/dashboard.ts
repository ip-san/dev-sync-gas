/**
 * Dashboard スキーマ定義
 */
import type { SheetSchema } from './types';

export const DASHBOARD_SCHEMA: SheetSchema = {
  version: '2.0.0',
  sheetName: 'Dashboard',
  columns: [
    { id: 'repository', header: 'リポジトリ', type: 'string' },
    { id: 'deploymentFrequency', header: 'デプロイ頻度', type: 'string' },
    { id: 'leadTimeHours', header: 'リードタイム (時間)', type: 'number', numberFormat: '#,##0.0' },
    {
      id: 'changeFailureRate',
      header: '変更障害率 (%)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    { id: 'mttrHours', header: 'MTTR (時間)', type: 'number', numberFormat: '#,##0.0' },
    {
      id: 'cycleTimeHours',
      header: 'サイクルタイム (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'codingTimeHours',
      header: 'コーディング時間 (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'timeToFirstReviewHours',
      header: 'レビュー待ち (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'reviewDurationHours',
      header: 'レビュー時間 (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    { id: 'avgLinesOfCode', header: 'PRサイズ (行)', type: 'number', numberFormat: '#,##0' },
    {
      id: 'avgAdditionalCommits',
      header: '追加コミット数 (平均)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'avgForcePushCount',
      header: 'Force Push回数 (平均)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    { id: 'status', header: 'ステータス', type: 'string' },
  ],
};

export const DASHBOARD_TREND_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: 'Dashboard - Trend',
  columns: [
    { id: 'week', header: '週', type: 'string' },
    { id: 'totalDeployments', header: 'デプロイ回数', type: 'number', numberFormat: '#,##0' },
    {
      id: 'avgLeadTimeHours',
      header: 'リードタイム (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'avgChangeFailureRate',
      header: '変更障害率 (%)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'avgCycleTimeHours',
      header: 'サイクルタイム (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    { id: 'changeIndicator', header: '前週比', type: 'string' },
  ],
};
