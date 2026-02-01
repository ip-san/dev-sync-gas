import { getContainer } from '../container';

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
    storageClient.getProperty('PRODUCTION_BRANCH_PATTERN') ?? DEFAULT_PRODUCTION_BRANCH_PATTERN
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
  storageClient.setProperty('PRODUCTION_BRANCH_PATTERN', pattern);
}

/**
 * productionブランチパターン設定をリセット
 */
export function resetProductionBranchPattern(): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty('PRODUCTION_BRANCH_PATTERN');
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
    logger.log(`⚠️ Property ${key} is not a valid string array`);
  } catch (error) {
    logger.log(
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
  return getPropertyAsStringArray('CYCLE_TIME_ISSUE_LABELS');
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
  setPropertyAsStringArray('CYCLE_TIME_ISSUE_LABELS', labels);
}

/**
 * サイクルタイムIssueラベル設定をリセット（全Issue対象に戻す）
 */
export function resetCycleTimeIssueLabels(): void {
  deleteProperty('CYCLE_TIME_ISSUE_LABELS');
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
  return getPropertyAsStringArray('CODING_TIME_ISSUE_LABELS');
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
  setPropertyAsStringArray('CODING_TIME_ISSUE_LABELS', labels);
}

/**
 * コーディングタイムIssueラベル設定をリセット（全Issue対象に戻す）
 */
export function resetCodingTimeIssueLabels(): void {
  deleteProperty('CODING_TIME_ISSUE_LABELS');
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
  const labels = getPropertyAsStringArray('EXCLUDE_METRICS_LABELS');
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
  setPropertyAsStringArray('EXCLUDE_METRICS_LABELS', labels);
}

/**
 * 除外ラベル設定をリセット（デフォルトに戻す）
 */
export function resetExcludeMetricsLabels(): void {
  deleteProperty('EXCLUDE_METRICS_LABELS');
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
  const labels = getPropertyAsStringArray('INCIDENT_LABELS');
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
  setPropertyAsStringArray('INCIDENT_LABELS', labels);
}

/**
 * インシデントラベル設定をリセット（デフォルトに戻す）
 */
export function resetIncidentLabels(): void {
  deleteProperty('INCIDENT_LABELS');
}
