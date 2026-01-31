/**
 * スプレッドシートのスキーマ定義
 *
 * 各シートの列構造を定義し、マイグレーション機能で使用する。
 * カラムIDは内部識別子として使用し、ヘッダー名が変更されても
 * データの対応付けができるようにする。
 */

// =============================================================================
// 型定義
// =============================================================================

/**
 * カラム定義
 */
export interface ColumnDefinition {
  /** カラムの一意識別子（内部用、変更不可） */
  id: string;
  /** 表示用ヘッダー名（日本語、変更可能） */
  header: string;
  /** カラムの型 */
  type: 'string' | 'number' | 'date';
  /** 新規追加時のデフォルト値 */
  defaultValue?: unknown;
  /** 数値フォーマット（GASのsetNumberFormat用） */
  numberFormat?: string;
}

/**
 * シートスキーマ定義
 */
export interface SheetSchema {
  /** スキーマバージョン */
  version: string;
  /** シート名 */
  sheetName: string;
  /** カラム定義（順序が重要） */
  columns: ColumnDefinition[];
}

/**
 * マイグレーション結果
 */
export interface MigrationResult {
  sheetName: string;
  success: boolean;
  status: 'migrated' | 'created' | 'up_to_date' | 'skipped' | 'error';
  fromVersion?: string;
  toVersion: string;
  rowsMigrated: number;
  columnsAdded: string[];
  columnsRemoved: string[];
  columnsRenamed: Array<{ from: string; to: string }>;
  duration: number;
  error?: string;
}

/**
 * マイグレーションプレビュー
 */
export interface MigrationPreview {
  sheetName: string;
  exists: boolean;
  currentHeaders: string[];
  targetHeaders: string[];
  status: 'migration_required' | 'up_to_date' | 'new_sheet';
  changes: {
    added: string[];
    removed: string[];
    reordered: boolean;
  };
  rowCount: number;
}

// =============================================================================
// DevOps Metrics スキーマ
// =============================================================================

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

// =============================================================================
// サイクルタイム スキーマ
// =============================================================================

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

// =============================================================================
// コーディング時間 スキーマ
// =============================================================================

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

// =============================================================================
// 手戻り率 スキーマ
// =============================================================================

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

// =============================================================================
// レビュー効率 スキーマ
// =============================================================================

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

// =============================================================================
// PRサイズ スキーマ
// =============================================================================

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

// =============================================================================
// 全スキーマ一覧
// =============================================================================

export const ALL_SCHEMAS: SheetSchema[] = [
  DEVOPS_METRICS_SCHEMA,
  DEVOPS_SUMMARY_SCHEMA,
  CYCLE_TIME_SCHEMA,
  CYCLE_TIME_DETAIL_SCHEMA,
  CODING_TIME_SCHEMA,
  CODING_TIME_DETAIL_SCHEMA,
  REWORK_RATE_SCHEMA,
  REWORK_RATE_DETAIL_SCHEMA,
  REVIEW_EFFICIENCY_SCHEMA,
  REVIEW_EFFICIENCY_DETAIL_SCHEMA,
  PR_SIZE_SCHEMA,
  PR_SIZE_DETAIL_SCHEMA,
];

/**
 * シート名からスキーマを取得
 */
export function findSchemaBySheetName(sheetName: string): SheetSchema | undefined {
  return ALL_SCHEMAS.find((schema) => schema.sheetName === sheetName);
}

/**
 * スキーマからヘッダー配列を取得
 */
export function getHeadersFromSchema(schema: SheetSchema): string[] {
  return schema.columns.map((col) => col.header);
}
