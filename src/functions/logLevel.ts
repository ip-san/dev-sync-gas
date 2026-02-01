/**
 * ログレベル設定のGASエントリーポイント関数
 */

import { getLogLevel, setLogLevel, resetLogLevel } from '../utils/logLevel';
import type { LogLevel } from '../interfaces';

/**
 * 現在のログレベルを表示
 *
 * @example
 * showLogLevel();
 * // 出力例: 📊 Current log level: INFO
 */
export function showLogLevel(): void {
  const level = getLogLevel();
  Logger.log(`📊 Current log level: ${level}`);
  Logger.log('');
  Logger.log('Available levels (in order of verbosity):');
  Logger.log('  DEBUG - All logs including detailed debugging info');
  Logger.log('  INFO  - Informational messages (default)');
  Logger.log('  WARN  - Warning messages');
  Logger.log('  ERROR - Error messages only');
}

/**
 * ログレベルを設定
 *
 * @param level - 設定するログレベル ('DEBUG' | 'INFO' | 'WARN' | 'ERROR')
 *
 * @example
 * // 開発環境：すべてのログを表示
 * configureLogLevel('DEBUG');
 *
 * // 本番環境：情報レベル以上のみ表示（デフォルト）
 * configureLogLevel('INFO');
 *
 * // 本番環境（厳格）：警告とエラーのみ表示
 * configureLogLevel('WARN');
 *
 * // 本番環境（最小）：エラーのみ表示
 * configureLogLevel('ERROR');
 */
export function configureLogLevel(level: LogLevel): void {
  try {
    setLogLevel(level);
    Logger.log(`✅ Log level set to: ${level}`);
    Logger.log('');
    Logger.log('Next steps:');
    Logger.log('  - Run your sync functions to see the effect');
    Logger.log('  - Use showLogLevel() to verify the setting');
  } catch (error) {
    Logger.log(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    Logger.log('');
    Logger.log('Valid log levels: DEBUG, INFO, WARN, ERROR');
  }
}

/**
 * ログレベルをデフォルト（INFO）にリセット
 *
 * @example
 * resetLogLevelConfig();
 */
export function resetLogLevelConfig(): void {
  resetLogLevel();
  Logger.log('✅ Log level reset to default (INFO)');
}
