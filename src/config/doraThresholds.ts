/**
 * DORA Metrics パフォーマンスレベル閾値設定
 *
 * これらの閾値はDORAの年次調査に基づいて更新されます。
 * 最新の閾値は https://dora.dev/ を参照してください。
 *
 * 現在の設定: 2024年 State of DevOps Report 基準
 */

/**
 * パフォーマンスレベル
 */
export type PerformanceLevel = "elite" | "high" | "medium" | "low";

/**
 * Deployment Frequency の閾値（1日あたりのデプロイ数）
 *
 * DORA公式定義:
 * - Elite: オンデマンド（1日複数回）
 * - High: 1日1回〜週1回
 * - Medium: 週1回〜月1回
 * - Low: 月1回〜6ヶ月に1回
 *
 * 本実装では1日1回以上をElite（daily）として扱います。
 * 厳密に「複数回/日」を判定するには閾値を調整してください。
 */
export const DEPLOYMENT_FREQUENCY_THRESHOLDS = {
  /** Elite: 1日1回以上 */
  elite: 1,
  /** High: 週1回以上（≒0.143/日） */
  high: 1 / 7,
  /** Medium: 月1回以上（≒0.033/日） */
  medium: 1 / 30,
  // Low: medium未満
} as const;

/**
 * Lead Time for Changes の閾値（時間）
 *
 * DORA公式定義:
 * - Elite: 1時間未満
 * - High: 1日〜1週間
 * - Medium: 1週間〜1ヶ月
 * - Low: 1ヶ月以上
 *
 * 本実装（連続的な分類）:
 * - Elite: 1時間未満
 * - High: 1時間〜1日未満（公式定義の隙間を埋める）
 * - Medium: 1日〜1週間未満
 * - Low: 1週間以上
 *
 * 注意: 公式定義では1時間〜1日の間が未定義のため、
 * 本実装ではHighとして扱っています。
 */
export const LEAD_TIME_THRESHOLDS = {
  /** Elite: 1時間未満 */
  elite: 1,
  /** High: 1時間以上24時間（1日）未満 */
  high: 24,
  /** Medium: 1日以上168時間（1週間）未満 */
  medium: 24 * 7,
  // Low: 1週間以上
} as const;

/**
 * Change Failure Rate の閾値（%）
 *
 * - Elite: 0-15%
 * - High: 0-15%（Eliteと同じ）
 * - Medium: 16-30%
 * - Low: 30%超
 *
 * 注意: EliteとHighは同じ閾値。総合評価で区別されます。
 */
export const CHANGE_FAILURE_RATE_THRESHOLDS = {
  /** Elite/High: 15%以下 */
  eliteHigh: 15,
  /** Medium: 30%以下 */
  medium: 30,
  // Low: 30%超
} as const;

/**
 * Mean Time to Recovery の閾値（時間）
 *
 * - Elite: 1時間未満
 * - High: 1日未満
 * - Medium: 1週間未満
 * - Low: 1週間以上
 */
export const MTTR_THRESHOLDS = {
  /** Elite: 1時間未満 */
  elite: 1,
  /** High: 24時間（1日）未満 */
  high: 24,
  /** Medium: 168時間（1週間）未満 */
  medium: 24 * 7,
  // Low: 1週間以上
} as const;

/**
 * Deployment Frequency からパフォーマンスレベルを判定
 */
export function getDeploymentFrequencyLevel(deploysPerDay: number): PerformanceLevel {
  if (deploysPerDay >= DEPLOYMENT_FREQUENCY_THRESHOLDS.elite) return "elite";
  if (deploysPerDay >= DEPLOYMENT_FREQUENCY_THRESHOLDS.high) return "high";
  if (deploysPerDay >= DEPLOYMENT_FREQUENCY_THRESHOLDS.medium) return "medium";
  return "low";
}

/**
 * Lead Time からパフォーマンスレベルを判定
 */
export function getLeadTimeLevel(hours: number): PerformanceLevel {
  if (hours < LEAD_TIME_THRESHOLDS.elite) return "elite";
  if (hours < LEAD_TIME_THRESHOLDS.high) return "high";
  if (hours < LEAD_TIME_THRESHOLDS.medium) return "medium";
  return "low";
}

/**
 * Change Failure Rate からパフォーマンスレベルを判定
 *
 * 注意: EliteとHighは同じ閾値のため、この関数では区別できません。
 * 他の指標と合わせて総合的に判断してください。
 */
export function getChangeFailureRateLevel(rate: number): PerformanceLevel {
  if (rate <= CHANGE_FAILURE_RATE_THRESHOLDS.eliteHigh) return "high"; // elite/highは区別不可
  if (rate <= CHANGE_FAILURE_RATE_THRESHOLDS.medium) return "medium";
  return "low";
}

/**
 * MTTR からパフォーマンスレベルを判定
 */
export function getMTTRLevel(hours: number): PerformanceLevel {
  if (hours < MTTR_THRESHOLDS.elite) return "elite";
  if (hours < MTTR_THRESHOLDS.high) return "high";
  if (hours < MTTR_THRESHOLDS.medium) return "medium";
  return "low";
}

/**
 * 頻度カテゴリ（daily/weekly/monthly/yearly）
 * これはパフォーマンスレベルとは別の分類です
 */
export type FrequencyCategory = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Deployment Frequency から頻度カテゴリを判定
 */
export function getFrequencyCategory(deploysPerDay: number): FrequencyCategory {
  if (deploysPerDay >= DEPLOYMENT_FREQUENCY_THRESHOLDS.elite) return "daily";
  if (deploysPerDay >= DEPLOYMENT_FREQUENCY_THRESHOLDS.high) return "weekly";
  if (deploysPerDay >= DEPLOYMENT_FREQUENCY_THRESHOLDS.medium) return "monthly";
  return "yearly";
}
