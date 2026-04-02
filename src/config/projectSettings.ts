/**
 * プロジェクト固有設定の取得
 * リポジトリから所属プロジェクトを特定し、プロジェクト固有の設定を返す
 */

import { getContainer } from '../container';
import type { ProjectGroup } from '../types';
import type { HealthThresholds } from '../types/dashboard';
import { DEFAULT_HEALTH_THRESHOLDS } from '../types/dashboard';
import { ProjectGroupsSchema, safeParseJSON } from '../utils/configSchemas';
import { CONFIG_KEYS } from './propertyKeys';

/**
 * プロジェクト設定を検索するヘルパー関数
 * @param owner リポジトリオーナー
 * @param repoName リポジトリ名
 * @returns プロジェクト設定（見つからない場合はnull）
 */
function findProjectForRepository(owner: string, repoName: string): ProjectGroup | null {
  const { storageClient, logger } = getContainer();
  const projectsJson = storageClient.getProperty(CONFIG_KEYS.SPREADSHEET.PROJECT_GROUPS);

  if (!projectsJson) {
    return null;
  }

  const projects = safeParseJSON(projectsJson, ProjectGroupsSchema, [], logger);
  const fullName = `${owner}/${repoName}`;

  return projects.find((p) => p.repositories.some((r) => r.fullName === fullName)) ?? null;
}

/**
 * 初回同期日数を取得（プロジェクト別設定）
 *
 * @param owner リポジトリオーナー
 * @param repoName リポジトリ名
 * @returns 初回同期日数（デフォルト: 30）
 *
 * @example
 * const days = getInitialSyncDaysForRepository('owner', 'repo');
 * console.log(days); // 30 or custom value
 */
export function getInitialSyncDaysForRepository(owner: string, repoName: string): number {
  const project = findProjectForRepository(owner, repoName);

  if (!project?.initialSyncDays) {
    return 30; // デフォルト値
  }

  // 値の妥当性チェック
  if (project.initialSyncDays < 1 || project.initialSyncDays > 365) {
    const { logger } = getContainer();
    logger.warn(
      `Invalid initialSyncDays value: ${project.initialSyncDays} for ${owner}/${repoName}. Using default: 30`
    );
    return 30;
  }

  return project.initialSyncDays;
}

/**
 * 健全性判定閾値を取得（プロジェクト別設定）
 *
 * @param owner リポジトリオーナー
 * @param repoName リポジトリ名
 * @returns 健全性判定閾値（デフォルト: DEFAULT_HEALTH_THRESHOLDS）
 *
 * @example
 * const thresholds = getHealthThresholdsForRepository('owner', 'repo');
 * console.log(thresholds.leadTime); // { good: 24, warning: 168 }
 */
export function getHealthThresholdsForRepository(
  owner: string,
  repoName: string
): HealthThresholds {
  const project = findProjectForRepository(owner, repoName);

  if (!project?.healthThresholds) {
    return DEFAULT_HEALTH_THRESHOLDS;
  }

  // 部分的な設定をデフォルトとマージ
  return {
    leadTime: project.healthThresholds.leadTime ?? DEFAULT_HEALTH_THRESHOLDS.leadTime,
    changeFailureRate:
      project.healthThresholds.changeFailureRate ?? DEFAULT_HEALTH_THRESHOLDS.changeFailureRate,
    cycleTime: project.healthThresholds.cycleTime ?? DEFAULT_HEALTH_THRESHOLDS.cycleTime,
    timeToFirstReview:
      project.healthThresholds.timeToFirstReview ?? DEFAULT_HEALTH_THRESHOLDS.timeToFirstReview,
  };
}

/**
 * 除外ラベルを取得（プロジェクト別設定）
 *
 * @param owner リポジトリオーナー
 * @param repoName リポジトリ名
 * @returns 除外ラベル配列（デフォルト: ['exclude-metrics']）
 *
 * @example
 * const labels = getExcludeMetricsLabelsForRepository('owner', 'repo');
 * console.log(labels); // ['exclude-metrics', 'dependencies']
 */
export function getExcludeMetricsLabelsForRepository(owner: string, repoName: string): string[] {
  const project = findProjectForRepository(owner, repoName);

  if (!project?.excludeMetricsLabels) {
    return ['exclude-metrics']; // デフォルト値
  }

  // 空配列の場合はデフォルトを返す
  return project.excludeMetricsLabels.length > 0
    ? project.excludeMetricsLabels
    : ['exclude-metrics'];
}
