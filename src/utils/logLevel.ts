/**
 * ログレベル制御ユーティリティ
 *
 * 環境に応じてログの出力レベルを制御し、
 * 本番環境での機密情報露出リスクを低減します。
 */

import type { LogLevel } from '../interfaces';
import { getContainer } from '../container';

/**
 * ログレベルの設定キー
 */
const LOG_LEVEL_KEY = 'LOG_LEVEL';

/**
 * ログレベルの優先順位
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * デフォルトのログレベル（本番環境想定）
 */
export const DEFAULT_LOG_LEVEL: LogLevel = 'INFO';

/**
 * 現在のログレベルを取得
 *
 * @returns 現在設定されているログレベル
 */
export function getLogLevel(): LogLevel {
  const container = getContainer();
  const storageClient = container.storageClient;

  const level = storageClient.getProperty(LOG_LEVEL_KEY);
  if (level && isValidLogLevel(level)) {
    return level as LogLevel;
  }

  return DEFAULT_LOG_LEVEL;
}

/**
 * ログレベルを設定
 *
 * @param level - 設定するログレベル
 */
export function setLogLevel(level: LogLevel): void {
  if (!isValidLogLevel(level)) {
    throw new Error(`Invalid log level: ${level}. Must be one of: DEBUG, INFO, WARN, ERROR`);
  }

  const container = getContainer();
  const storageClient = container.storageClient;
  storageClient.setProperty(LOG_LEVEL_KEY, level);
}

/**
 * ログレベルをリセット（デフォルトに戻す）
 */
export function resetLogLevel(): void {
  const container = getContainer();
  const storageClient = container.storageClient;
  storageClient.deleteProperty(LOG_LEVEL_KEY);
}

/**
 * 指定されたログレベルが有効な値かチェック
 *
 * @param level - チェックするログレベル
 * @returns 有効な場合true
 */
function isValidLogLevel(level: string): boolean {
  return ['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(level);
}

/**
 * 指定されたメッセージレベルが現在のログレベルで出力されるかチェック
 *
 * @param messageLevel - メッセージのログレベル
 * @returns 出力される場合true
 */
export function shouldLog(messageLevel: LogLevel): boolean {
  const currentLevel = getLogLevel();
  return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[currentLevel];
}
