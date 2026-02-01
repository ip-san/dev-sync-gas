/**
 * PRサイズ計算モジュール
 *
 * PRの変更行数と変更ファイル数を測定する。
 */

import type { PRSizeMetrics, PRSizeData } from '../../types';
import { calculateStats } from './statsHelpers.js';

/**
 * PRサイズ（PR Size）を計算
 *
 * 定義: PRの変更行数と変更ファイル数を測定
 */
export function calculatePRSize(sizeData: PRSizeData[], period: string): PRSizeMetrics {
  if (sizeData.length === 0) {
    return {
      period,
      prCount: 0,
      linesOfCode: { total: 0, avg: null, median: null, min: null, max: null },
      filesChanged: { total: 0, avg: null, median: null, min: null, max: null },
      prDetails: [],
    };
  }

  // 変更行数の統計
  const locValues = sizeData.map((pr) => pr.linesOfCode);
  const locStats = calculateStats(locValues);
  const locTotal = locValues.reduce((sum, val) => sum + val, 0);

  // 変更ファイル数の統計
  const filesValues = sizeData.map((pr) => pr.filesChanged);
  const filesStats = calculateStats(filesValues);
  const filesTotal = filesValues.reduce((sum, val) => sum + val, 0);

  return {
    period,
    prCount: sizeData.length,
    linesOfCode: {
      total: locTotal,
      avg: locStats.avg,
      median: locStats.median,
      min: locStats.min,
      max: locStats.max,
    },
    filesChanged: {
      total: filesTotal,
      avg: filesStats.avg,
      median: filesStats.median,
      min: filesStats.min,
      max: filesStats.max,
    },
    prDetails: sizeData,
  };
}
