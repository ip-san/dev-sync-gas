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

/**
 * スプレッドシート行データの日時文字列を自動的にフォーマット
 *
 * ISO 8601形式の文字列を検出して、読みやすい形式に変換します。
 * 他のデータ型（数値、null、undefined等）はそのまま返されます。
 *
 * @param value - セルの値（任意の型）
 * @returns フォーマット済みの値
 *
 * @example
 * ```typescript
 * formatCellValue("2026-01-09T00:42:33Z") // => "2026-01-09 09:42:33"
 * formatCellValue(123) // => 123
 * formatCellValue(null) // => null
 * ```
 */
export function formatCellValue(value: unknown): unknown {
  // 文字列かつISO 8601形式（YYYY-MM-DDTHH:mm:ss...）の場合のみフォーマット
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return formatDateTimeForDisplay(value);
  }
  return value;
}

/**
 * スプレッドシート行データの配列を一括フォーマット
 *
 * 各セルの値を検査し、ISO 8601形式の日時文字列を自動的に
 * 読みやすい形式に変換します。
 *
 * @param rows - スプレッドシート行データの配列
 * @returns フォーマット済みの行データ
 *
 * @example
 * ```typescript
 * const rows = [
 *   [123, "Title", "2026-01-09T00:42:33Z", 456],
 *   [789, "Title2", "2026-01-10T01:23:45Z", 789],
 * ];
 * formatRowsForSheet(rows);
 * // => [
 * //   [123, "Title", "2026-01-09 09:42:33", 456],
 * //   [789, "Title2", "2026-01-10 10:23:45", 789],
 * // ]
 * ```
 */
export function formatRowsForSheet(rows: unknown[][]): unknown[][] {
  return rows.map((row) => row.map(formatCellValue));
}
