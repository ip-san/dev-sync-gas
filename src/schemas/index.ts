/**
 * スプレッドシートのスキーマ定義 - エントリーポイント
 *
 * 各シートの列構造を定義し、マイグレーション機能で使用する。
 * すべてのスキーマを再エクスポートし、後方互換性を維持する。
 */

// =============================================================================
// 型定義のエクスポート
// =============================================================================
export type { ColumnDefinition, SheetSchema, MigrationResult, MigrationPreview } from './types';

// =============================================================================
// 各スキーマのエクスポート
// =============================================================================

// DevOps Metrics
export { DEVOPS_METRICS_SCHEMA, DEVOPS_SUMMARY_SCHEMA } from './devops';

// サイクルタイム
export { CYCLE_TIME_SCHEMA, CYCLE_TIME_DETAIL_SCHEMA } from './cycleTime';

// コーディング時間
export { CODING_TIME_SCHEMA, CODING_TIME_DETAIL_SCHEMA } from './codingTime';

// 手戻り率
export { REWORK_RATE_SCHEMA, REWORK_RATE_DETAIL_SCHEMA } from './reworkRate';

// レビュー効率
export { REVIEW_EFFICIENCY_SCHEMA, REVIEW_EFFICIENCY_DETAIL_SCHEMA } from './reviewEfficiency';

// PRサイズ
export { PR_SIZE_SCHEMA, PR_SIZE_DETAIL_SCHEMA } from './prSize';

// Dashboard
export { DASHBOARD_SCHEMA, DASHBOARD_TREND_SCHEMA } from './dashboard';

// リポジトリ別
export { REPOSITORY_DEVOPS_SCHEMA } from './repository';

// =============================================================================
// 全スキーマ一覧
// =============================================================================

import type { SheetSchema } from './types';
import { DASHBOARD_SCHEMA, DASHBOARD_TREND_SCHEMA } from './dashboard';
import { REPOSITORY_DEVOPS_SCHEMA } from './repository';
import { DEVOPS_METRICS_SCHEMA, DEVOPS_SUMMARY_SCHEMA } from './devops';
import { CYCLE_TIME_SCHEMA, CYCLE_TIME_DETAIL_SCHEMA } from './cycleTime';
import { CODING_TIME_SCHEMA, CODING_TIME_DETAIL_SCHEMA } from './codingTime';
import { REWORK_RATE_SCHEMA, REWORK_RATE_DETAIL_SCHEMA } from './reworkRate';
import { REVIEW_EFFICIENCY_SCHEMA, REVIEW_EFFICIENCY_DETAIL_SCHEMA } from './reviewEfficiency';
import { PR_SIZE_SCHEMA, PR_SIZE_DETAIL_SCHEMA } from './prSize';

export const ALL_SCHEMAS: SheetSchema[] = [
  DASHBOARD_SCHEMA,
  DASHBOARD_TREND_SCHEMA,
  REPOSITORY_DEVOPS_SCHEMA,
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

// =============================================================================
// ユーティリティ関数
// =============================================================================

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
