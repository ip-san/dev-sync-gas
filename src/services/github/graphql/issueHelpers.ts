/**
 * GraphQL Issue/PR処理のヘルパー関数
 *
 * ネスト深度削減のため、繰り返し処理やフィルタリングロジックを分離
 */

/**
 * 日付範囲オプション（Issue用 - string形式）
 */
export interface IssueDateRangeOption {
  start?: string;
  end?: string;
}

/**
 * 日付範囲オプション（PR用）
 */
export interface PRDateRange {
  since?: Date;
  until?: Date;
}

/**
 * Issueが日付範囲内かチェック
 * @returns true: 範囲内, false: 範囲外
 */
export function isWithinDateRange(createdAt: Date, dateRange?: IssueDateRangeOption): boolean {
  if (dateRange?.start) {
    const startDate = new Date(dateRange.start);
    if (createdAt < startDate) {
      return false;
    }
  }
  if (dateRange?.end) {
    const endDate = new Date(dateRange.end);
    if (createdAt > endDate) {
      return false;
    }
  }
  return true;
}

/**
 * PRが日付範囲内かチェック
 * @returns true: 範囲内, false: 範囲外
 */
export function isWithinPRDateRange(createdAt: Date, dateRange?: PRDateRange): boolean {
  if (dateRange?.until && createdAt > dateRange.until) {
    return false;
  }
  if (dateRange?.since && createdAt < dateRange.since) {
    return false;
  }
  return true;
}
