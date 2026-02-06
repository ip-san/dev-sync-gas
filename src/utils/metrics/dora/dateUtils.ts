/**
 * 日付ユーティリティ
 */

/**
 * 日付範囲の配列を生成
 */
export function generateDateRange(since: Date, until: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(since);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(until);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * 日付が指定日と同じか判定（UTC基準）
 */
export function isOnDate(target: Date, date: Date): boolean {
  const targetStr = target.toISOString().split('T')[0];
  const dateStr = date.toISOString().split('T')[0];
  return targetStr === dateStr;
}
