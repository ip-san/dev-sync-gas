/**
 * リポジトリ別 DevOps Metrics スキーマ定義
 */
import type { SheetSchema } from './types';

export const REPOSITORY_DEVOPS_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: '', // 動的に設定（owner/repo形式）
  columns: [
    { id: 'date', header: '日付', type: 'date' },
    { id: 'deploymentCount', header: 'デプロイ回数', type: 'number', numberFormat: '#,##0' },
    { id: 'deploymentFrequency', header: 'デプロイ頻度', type: 'string' },
    { id: 'leadTimeHours', header: 'リードタイム (時間)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'totalDeployments', header: '総デプロイ数', type: 'number', numberFormat: '#,##0' },
    { id: 'failedDeployments', header: '失敗デプロイ数', type: 'number', numberFormat: '#,##0' },
    { id: 'changeFailureRate', header: '変更障害率 (%)', type: 'number', numberFormat: '#,##0.0' },
    {
      id: 'mttrHours',
      header: '平均復旧時間 (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
      defaultValue: 'N/A',
    },
  ],
};
