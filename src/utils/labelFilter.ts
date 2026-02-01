/**
 * ラベルフィルタリングユーティリティ
 *
 * Issue/PRのラベルに基づいて、計測から除外するかどうかを判定する。
 */

/**
 * ラベルに除外対象が含まれているかチェック
 *
 * @param itemLabels - Issue/PRのラベル配列
 * @param excludeLabels - 除外対象ラベル配列
 * @returns true: 除外すべき, false: 除外しない
 *
 * @example
 * shouldExcludeByLabels(['bug', 'exclude-metrics'], ['exclude-metrics']) // => true
 * shouldExcludeByLabels(['bug', 'feature'], ['exclude-metrics']) // => false
 * shouldExcludeByLabels(['exclude-metrics'], []) // => false (除外設定なし)
 */
export function shouldExcludeByLabels(itemLabels: string[], excludeLabels: string[]): boolean {
  if (excludeLabels.length === 0) {
    return false;
  }
  return itemLabels.some((label) => excludeLabels.includes(label));
}
