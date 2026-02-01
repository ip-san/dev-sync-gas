import type { Config } from '../types';
import { getContainer } from '../container';
import { resolveGitHubToken } from '../services/githubAuth';
import { auditLog } from '../utils/auditLog';
import { CONFIG_KEYS } from './propertyKeys';
import { getConfig } from './core';

/**
 * GitHub Apps設定をクリア（PAT認証に戻す際に使用）
 * セキュリティ: 機密情報の削除を監査ログに記録
 */
export function clearGitHubAppConfig(): void {
  const { storageClient, logger } = getContainer();

  // 削除前の確認メッセージ
  logger.warn('⚠️ Clearing GitHub App configuration...');
  logger.warn('   This will remove App ID, Private Key, and Installation ID');
  logger.warn('   Make sure to revoke the GitHub App access if no longer needed');

  try {
    storageClient.deleteProperty(CONFIG_KEYS.GITHUB_AUTH.APP_ID);
    storageClient.deleteProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY);
    storageClient.deleteProperty(CONFIG_KEYS.GITHUB_AUTH.APP_INSTALLATION_ID);

    // 監査ログ（成功）
    auditLog('config.github_app.clear', {
      message: 'GitHub App configuration cleared successfully',
    });

    logger.info('✅ GitHub App configuration cleared');
  } catch (error) {
    // 監査ログ（失敗）
    auditLog(
      'config.github_app.clear',
      { message: 'Failed to clear GitHub App configuration' },
      'failure',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

/**
 * 設定からGitHubトークンを取得
 * - GitHub Apps設定がある場合: Installation Tokenを取得して返す
 * - PAT設定の場合: PATをそのまま返す
 *
 * @returns GitHub APIで使用するトークン
 */
export function getGitHubToken(): string {
  const config: Config = getConfig();
  return resolveGitHubToken(config.github.token, config.github.appConfig);
}
