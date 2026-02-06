import { getContainer } from '../container';
import { PRODUCTION_KEYS, LABEL_KEYS, PR_SIZE_KEYS } from './propertyKeys';

// ============================================================
// サイクルタイム設定
// ============================================================

/** デフォルトのproductionブランチパターン */
const DEFAULT_PRODUCTION_BRANCH_PATTERN = 'production';

/**
 * productionブランチパターンを取得
 * このパターンを含むブランチへのマージをproductionリリースとみなす
 *
 * @returns productionブランチパターン（デフォルト: "production"）
 */
export function getProductionBranchPattern(): string {
  const { storageClient } = getContainer();
  return (
    storageClient.getProperty(PRODUCTION_KEYS.BRANCH_PATTERN) ?? DEFAULT_PRODUCTION_BRANCH_PATTERN
  );
}

/**
 * productionブランチパターンを設定
 *
 * @example
 * // "xxx_production" にマッチ
 * setProductionBranchPattern("production");
 *
 * // "release" ブランチにマッチ
 * setProductionBranchPattern("release");
 */
export function setProductionBranchPattern(pattern: string): void {
  const { storageClient } = getContainer();
  storageClient.setProperty(PRODUCTION_KEYS.BRANCH_PATTERN, pattern);
}

/**
 * productionブランチパターン設定をリセット
 */
export function resetProductionBranchPattern(): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty(PRODUCTION_KEYS.BRANCH_PATTERN);
}

/**
 * プロパティから文字列配列を取得する汎用ヘルパー関数
 * @param key プロパティキー
 * @returns パースされた文字列配列（失敗時は空配列）
 */
function getPropertyAsStringArray(key: string): string[] {
  const { storageClient, logger } = getContainer();
  const json = storageClient.getProperty(key);
  if (!json) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed;
    }
    logger.warn(`⚠️ Property ${key} is not a valid string array`);
  } catch (error) {
    logger.warn(
      `⚠️ Failed to parse ${key}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return [];
}

/**
 * プロパティに文字列配列を設定する汎用ヘルパー関数
 * @param key プロパティキー
 * @param values 設定する文字列配列
 */
function setPropertyAsStringArray(key: string, values: string[]): void {
  const { storageClient } = getContainer();
  storageClient.setProperty(key, JSON.stringify(values));
}

/**
 * プロパティを削除する汎用ヘルパー関数
 * @param key プロパティキー
 */
function deleteProperty(key: string): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty(key);
}

/**
 * サイクルタイム計測対象のIssueラベルを取得
 * 空配列の場合は全Issueが対象
 *
 * @returns ラベル配列（デフォルト: []）
 */
export function getCycleTimeIssueLabels(): string[] {
  return getPropertyAsStringArray(LABEL_KEYS.CYCLE_TIME);
}

/**
 * サイクルタイム計測対象のIssueラベルを設定
 *
 * @example
 * // "feature" と "enhancement" ラベルを持つIssueのみ計測
 * setCycleTimeIssueLabels(["feature", "enhancement"]);
 *
 * // 全Issueを対象にする
 * setCycleTimeIssueLabels([]);
 */
export function setCycleTimeIssueLabels(labels: string[]): void {
  setPropertyAsStringArray(LABEL_KEYS.CYCLE_TIME, labels);
}

/**
 * サイクルタイムIssueラベル設定をリセット（全Issue対象に戻す）
 */
export function resetCycleTimeIssueLabels(): void {
  deleteProperty(LABEL_KEYS.CYCLE_TIME);
}

// ============================================================
// コーディングタイム設定
// ============================================================

/**
 * コーディングタイム計測対象のIssueラベルを取得
 * 空配列の場合は全Issueが対象
 *
 * @returns ラベル配列（デフォルト: []）
 */
export function getCodingTimeIssueLabels(): string[] {
  return getPropertyAsStringArray(LABEL_KEYS.CODING_TIME);
}

/**
 * コーディングタイム計測対象のIssueラベルを設定
 *
 * @example
 * // "feature" と "enhancement" ラベルを持つIssueのみ計測
 * setCodingTimeIssueLabels(["feature", "enhancement"]);
 *
 * // 全Issueを対象にする
 * setCodingTimeIssueLabels([]);
 */
export function setCodingTimeIssueLabels(labels: string[]): void {
  setPropertyAsStringArray(LABEL_KEYS.CODING_TIME, labels);
}

/**
 * コーディングタイムIssueラベル設定をリセット（全Issue対象に戻す）
 */
export function resetCodingTimeIssueLabels(): void {
  deleteProperty(LABEL_KEYS.CODING_TIME);
}

// ============================================================
// 除外ラベル設定
// ============================================================

/**
 * 計測から除外するIssue/PRラベルを取得
 *
 * @returns ラベル配列（デフォルト: ['exclude-metrics']）
 */
export function getExcludeMetricsLabels(): string[] {
  const labels = getPropertyAsStringArray(LABEL_KEYS.EXCLUDE_METRICS);
  return labels.length > 0 ? labels : ['exclude-metrics'];
}

/**
 * 計測から除外するIssue/PRラベルを設定
 *
 * @example
 * // 特定ラベルを除外
 * setExcludeMetricsLabels(['exclude-metrics', 'dependencies', 'bot']);
 *
 * // 除外しない（空配列）
 * setExcludeMetricsLabels([]);
 */
export function setExcludeMetricsLabels(labels: string[]): void {
  setPropertyAsStringArray(LABEL_KEYS.EXCLUDE_METRICS, labels);
}

/**
 * 除外ラベル設定をリセット（デフォルトに戻す）
 */
export function resetExcludeMetricsLabels(): void {
  deleteProperty(LABEL_KEYS.EXCLUDE_METRICS);
}

// ============================================================
// インシデントラベル設定
// ============================================================

/**
 * インシデント判定に使用するラベルを取得
 *
 * @returns ラベル配列（デフォルト: ['incident']）
 */
export function getIncidentLabels(): string[] {
  const labels = getPropertyAsStringArray(LABEL_KEYS.INCIDENT);
  return labels.length > 0 ? labels : ['incident'];
}

/**
 * インシデント判定に使用するラベルを設定
 *
 * @example
 * // カスタムラベルを設定
 * setIncidentLabels(['incident', 'bug', 'p0']);
 *
 * // デフォルトに戻す（空配列を設定するとデフォルトの 'incident' が使われる）
 * setIncidentLabels([]);
 */
export function setIncidentLabels(labels: string[]): void {
  setPropertyAsStringArray(LABEL_KEYS.INCIDENT, labels);
}

/**
 * インシデントラベル設定をリセット（デフォルトに戻す）
 */
export function resetIncidentLabels(): void {
  deleteProperty(LABEL_KEYS.INCIDENT);
}

// ============================================================
// PRサイズ設定
// ============================================================

/**
 * PRサイズ計算から除外するbaseブランチを取得
 * これらのブランチへのマージはPRサイズ計算から除外される（部分一致）
 *
 * @returns ブランチ名配列（デフォルト: []）
 * @example
 * // 設定が ["production", "staging"] の場合:
 * // - "production" → 除外
 * // - "production-hotfix" → 除外（部分一致）
 * // - "staging-test" → 除外（部分一致）
 * // - "main" → 含める
 */
export function getExcludePRSizeBaseBranches(): string[] {
  return getPropertyAsStringArray(PR_SIZE_KEYS.EXCLUDE_BASE_BRANCHES);
}

/**
 * PRサイズ計算から除外するbaseブランチを設定
 * ブランチ名は部分一致で判定される
 *
 * @param branches 除外するbaseブランチ名の配列
 * @example
 * // デプロイ用PRを除外（部分一致）
 * setExcludePRSizeBaseBranches(["production", "staging"]);
 *
 * // 除外しない
 * setExcludePRSizeBaseBranches([]);
 */
export function setExcludePRSizeBaseBranches(branches: string[]): void {
  setPropertyAsStringArray(PR_SIZE_KEYS.EXCLUDE_BASE_BRANCHES, branches);
}

/**
 * PRサイズ除外ブランチ設定をリセット（全PR対象に戻す）
 */
export function resetExcludePRSizeBaseBranches(): void {
  deleteProperty(PR_SIZE_KEYS.EXCLUDE_BASE_BRANCHES);
}
