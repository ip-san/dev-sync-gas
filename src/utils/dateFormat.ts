/**
 * 日時フォーマットユーティリティ
 *
 * スプレッドシート表示用の日時フォーマット機能を提供
 */

/**
 * ISO形式の日時文字列を読みやすい形式に変換
 *
 * @param isoString - ISO 8601形式の日時文字列（例: "2026-01-09T00:42:33Z"）
 * @returns YYYY-MM-DD HH:mm:ss形式の文字列（例: "2026-01-09 09:42:33"）
 *
 * @example
 * ```typescript
 * formatDateTimeForDisplay("2026-01-09T00:42:33Z")
 * // => "2026-01-09 09:42:33"
 * ```
 */
export function formatDateTimeForDisplay(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return isoString; // 無効な日付の場合は元の文字列を返す
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return isoString;
  }
}

/**
 * Date オブジェクトを読みやすい形式に変換
 *
 * @param date - Date オブジェクト
 * @returns YYYY-MM-DD HH:mm:ss形式の文字列
 */
export function formatDateForDisplay(date: Date): string {
  return formatDateTimeForDisplay(date.toISOString());
}
