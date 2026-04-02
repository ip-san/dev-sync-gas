/**
 * スプレッドシートのスキーマ定義 - エントリーポイント
 *
 * 各シートの列構造を定義し、マイグレーション機能で使用する。
 * すべてのスキーマを再エクスポートし、後方互換性を維持する。
 */

// =============================================================================
// 型定義のエクスポート
// =============================================================================
export type { ColumnDefinition, MigrationPreview, MigrationResult, SheetSchema } from './types';

// =============================================================================
// 各スキーマのエクスポート
// =============================================================================

// コーディング時間
export { CODING_TIME_DETAIL_SCHEMA, CODING_TIME_SCHEMA } from './codingTime';

// サイクルタイム
export { CYCLE_TIME_DETAIL_SCHEMA, CYCLE_TIME_SCHEMA } from './cycleTime';
// Dashboard
export { DASHBOARD_SCHEMA, DASHBOARD_TREND_SCHEMA } from './dashboard';
// DevOps Metrics
export { DEVOPS_METRICS_SCHEMA } from './devops';
// PRサイズ
export { PR_SIZE_DETAIL_SCHEMA, PR_SIZE_SCHEMA } from './prSize';
// リポジトリ別
export { REPOSITORY_DEVOPS_SCHEMA } from './repository';
// レビュー効率
export { REVIEW_EFFICIENCY_DETAIL_SCHEMA, REVIEW_EFFICIENCY_SCHEMA } from './reviewEfficiency';
// 手戻り率
export { REWORK_RATE_DETAIL_SCHEMA, REWORK_RATE_SCHEMA } from './reworkRate';

// =============================================================================
// 全スキーマ一覧
// =============================================================================

import { CODING_TIME_DETAIL_SCHEMA, CODING_TIME_SCHEMA } from './codingTime';
import { CYCLE_TIME_DETAIL_SCHEMA, CYCLE_TIME_SCHEMA } from './cycleTime';
import { DASHBOARD_SCHEMA, DASHBOARD_TREND_SCHEMA } from './dashboard';
import { DEVOPS_METRICS_SCHEMA } from './devops';
import { PR_SIZE_DETAIL_SCHEMA, PR_SIZE_SCHEMA } from './prSize';
import { REPOSITORY_DEVOPS_SCHEMA } from './repository';
import { REVIEW_EFFICIENCY_DETAIL_SCHEMA, REVIEW_EFFICIENCY_SCHEMA } from './reviewEfficiency';
import { REWORK_RATE_DETAIL_SCHEMA, REWORK_RATE_SCHEMA } from './reworkRate';
import type { SheetSchema } from './types';

export const ALL_SCHEMAS: SheetSchema[] = [
  DASHBOARD_SCHEMA,
  DASHBOARD_TREND_SCHEMA,
  REPOSITORY_DEVOPS_SCHEMA,
  DEVOPS_METRICS_SCHEMA,
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
