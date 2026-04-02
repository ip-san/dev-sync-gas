/**
 * 表示設定管理
 * シート名などのUI表示に関する設定
 */

import { getContainer } from '../container';
import { SHEET_NAMES as DEFAULT_SHEET_NAMES } from './apiConfig';
import { DISPLAY_KEYS } from './propertyKeys';

/**
 * シート名設定の型
 */
export interface SheetNamesConfig {
  cycleTime: string;
  codingTime: string;
  reworkRate: string;
  reviewEfficiency: string;
  prSize: string;
  dashboard: string;
  dashboardTrend: string;
  devopsSummary: string;
}

/**
 * シート名設定を取得（デフォルト値付き）
 */
export function getSheetNames(): SheetNamesConfig {
  const { storageClient } = getContainer();
  const stored = storageClient.getProperty(DISPLAY_KEYS.SHEET_NAMES);

  const defaults: SheetNamesConfig = {
    cycleTime: DEFAULT_SHEET_NAMES.CYCLE_TIME,
    codingTime: DEFAULT_SHEET_NAMES.CODING_TIME,
    reworkRate: DEFAULT_SHEET_NAMES.REWORK_RATE,
    reviewEfficiency: DEFAULT_SHEET_NAMES.REVIEW_EFFICIENCY,
    prSize: DEFAULT_SHEET_NAMES.PR_SIZE,
    dashboard: DEFAULT_SHEET_NAMES.DASHBOARD,
    dashboardTrend: DEFAULT_SHEET_NAMES.DASHBOARD_TREND,
    devopsSummary: DEFAULT_SHEET_NAMES.DEVOPS_SUMMARY,
  };

  if (!stored) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<SheetNamesConfig>;
    // スプレッドオペレーターでデフォルト値とマージ（複雑度を下げる）
    return { ...defaults, ...parsed };
  } catch (error) {
    const { logger } = getContainer();
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to parse SHEET_NAMES config, using defaults: ${errorMessage}`);
    return defaults;
  }
}

/**
 * シート名設定を保存
 */
export function setSheetNames(config: Partial<SheetNamesConfig>): void {
  const { storageClient } = getContainer();
  const current = getSheetNames();
  const merged = { ...current, ...config };

  storageClient.setProperty(DISPLAY_KEYS.SHEET_NAMES, JSON.stringify(merged));
}

/**
 * 監査ログシート名を取得
 */
export function getAuditLogSheetName(): string {
  const { storageClient } = getContainer();
  return storageClient.getProperty(DISPLAY_KEYS.AUDIT_LOG_SHEET_NAME) ?? 'Audit Log';
}

/**
 * 監査ログシート名を設定
 */
export function setAuditLogSheetName(name: string): void {
  const { storageClient } = getContainer();

  if (!name || name.length === 0) {
    throw new Error('Audit log sheet name cannot be empty');
  }

  if (name.length > 100) {
    throw new Error('Audit log sheet name cannot exceed 100 characters');
  }

  storageClient.setProperty(DISPLAY_KEYS.AUDIT_LOG_SHEET_NAME, name);
}
