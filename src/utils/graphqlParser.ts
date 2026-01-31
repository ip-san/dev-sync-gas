/**
 * GraphQL レスポンスのパース・変換ユーティリティ
 *
 * GraphQL APIから返される特殊な形式のデータを安全にパースする。
 */

import type { ApiResponse } from '../types';

// =============================================================================
// GraphQL ID パース
// =============================================================================

/**
 * GraphQL の Global Node ID から数値IDを抽出
 *
 * GitHub GraphQL APIは "MDExOlB1bGxSZXF1ZXN0MTIzNDU2Nzg5" のような
 * Base64エンコードされたGlobal IDを返す。
 * これを数値IDに変換する。
 *
 * @param graphqlId - GraphQL Global Node ID
 * @returns 数値ID（抽出できない場合はnull）
 *
 * @example
 * ```typescript
 * const id = parseGraphQLNodeId("MDExOlB1bGxSZXF1ZXN0MTIzNDU2Nzg5");
 * // 結果: 123456789 または null
 * ```
 */
export function parseGraphQLNodeId(graphqlId: string | null | undefined): number | null {
  if (!graphqlId || typeof graphqlId !== 'string') {
    return null;
  }

  // 数字のみを抽出
  const digits = graphqlId.replace(/\D/g, '');

  if (digits.length === 0) {
    return null;
  }

  const parsed = parseInt(digits, 10);

  // 有効な数値かチェック
  if (isNaN(parsed) || !isFinite(parsed)) {
    return null;
  }

  return parsed;
}

/**
 * GraphQL Node ID を安全にパース（エラー時はApiResponseで返す）
 *
 * @param graphqlId - GraphQL Global Node ID
 * @param fieldName - フィールド名（エラーメッセージ用）
 * @returns パース結果
 */
export function parseGraphQLNodeIdSafe(
  graphqlId: string | null | undefined,
  fieldName = 'id'
): ApiResponse<number> {
  const result = parseGraphQLNodeId(graphqlId);

  if (result === null) {
    return {
      success: false,
      error: `Failed to parse GraphQL ${fieldName}: "${graphqlId}"`,
    };
  }

  return {
    success: true,
    data: result,
  };
}

/**
 * GraphQL Node ID を安全にパース（0にフォールバック）
 *
 * 後方互換性のため、パースできない場合は0を返す。
 * 新しいコードでは parseGraphQLNodeIdSafe() の使用を推奨。
 *
 * @param graphqlId - GraphQL Global Node ID
 * @returns 数値ID（パースできない場合は0）
 */
export function parseGraphQLNodeIdOrZero(graphqlId: string | null | undefined): number {
  return parseGraphQLNodeId(graphqlId) ?? 0;
}

// =============================================================================
// GraphQL 型変換
// =============================================================================

/**
 * GraphQL の DateTime 文字列を Date オブジェクトに変換
 *
 * @param dateTimeString - ISO 8601形式の日時文字列
 * @returns Date オブジェクト（無効な場合はnull）
 */
export function parseGraphQLDateTime(dateTimeString: string | null | undefined): Date | null {
  if (!dateTimeString || typeof dateTimeString !== 'string') {
    return null;
  }

  const date = new Date(dateTimeString);

  // 有効な日付かチェック
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * GraphQL の Boolean を安全に変換
 *
 * @param value - GraphQL Boolean値
 * @param defaultValue - デフォルト値
 * @returns Boolean値
 */
export function parseGraphQLBoolean(
  value: boolean | null | undefined,
  defaultValue = false
): boolean {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  return Boolean(value);
}

/**
 * GraphQL の Int を安全に変換
 *
 * @param value - GraphQL Int値
 * @param defaultValue - デフォルト値
 * @returns 数値
 */
export function parseGraphQLInt(value: number | null | undefined, defaultValue = 0): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return defaultValue;
  }

  return Math.floor(value);
}

/**
 * GraphQL の String を安全に変換
 *
 * @param value - GraphQL String値
 * @param defaultValue - デフォルト値
 * @returns 文字列
 */
export function parseGraphQLString(value: string | null | undefined, defaultValue = ''): string {
  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value !== 'string') {
    return defaultValue;
  }

  return value;
}
