/**
 * 統計計算ヘルパー関数
 *
 * 各種メトリクス計算で使用される統計関数を提供。
 */

/**
 * 配列の統計値（平均、中央値、最小値、最大値）を計算
 */
export function calculateStats(values: number[]): {
  avg: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
} {
  if (values.length === 0) {
    return { avg: null, median: null, min: null, max: null };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const avg = Math.round((sum / values.length) * 10) / 10;

  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? Math.round(sorted[mid] * 10) / 10
      : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;

  const min = Math.round(sorted[0] * 10) / 10;
  const max = Math.round(sorted[sorted.length - 1] * 10) / 10;

  return { avg, median, min, max };
}
