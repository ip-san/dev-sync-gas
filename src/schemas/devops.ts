/**
 * DevOps Metrics スキーマ定義
 */
import type { SheetSchema } from './types';

export const DEVOPS_METRICS_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: 'DevOps Metrics',
  columns: [
    { id: 'date', header: '日付', type: 'date' },
    { id: 'repository', header: 'リポジトリ', type: 'string' },
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

export const DEVOPS_SUMMARY_SCHEMA: SheetSchema = {
  version: '1.0.0',
  sheetName: 'DevOps Metrics - Summary',
  columns: [
    { id: 'repository', header: 'リポジトリ', type: 'string' },
    {
      id: 'avgDeploymentFrequency',
      header: '平均デプロイ頻度',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'avgLeadTimeHours',
      header: '平均リードタイム (時間)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    {
      id: 'avgChangeFailureRate',
      header: '平均変更障害率 (%)',
      type: 'number',
      numberFormat: '#,##0.0',
    },
    { id: 'avgMttrHours', header: '平均復旧時間 (時間)', type: 'number', numberFormat: '#,##0.0' },
    { id: 'lastUpdated', header: '最終更新日時', type: 'date' },
  ],
};
