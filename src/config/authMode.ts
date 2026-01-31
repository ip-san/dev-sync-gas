/**
 * GitHub認証モード判定
 *
 * Personal Access Token (PAT) / GitHub Apps 認証の判定
 */

import { getContainer } from '../container';
import { CONFIG_KEYS } from './propertyKeys';

/**
 * GitHub認証モードを判定
 * @returns "app" | "pat" | "none"
 */
export function getGitHubAuthMode(): 'app' | 'pat' | 'none' {
  const { storageClient } = getContainer();

  const appId = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_ID);
  const privateKey = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY);
  const installationId = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_INSTALLATION_ID);

  if (appId && privateKey && installationId) {
    return 'app';
  }

  const token = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.TOKEN);
  if (token) {
    return 'pat';
  }

  return 'none';
}

/**
 * GitHub Apps認証の部分的設定をチェック
 * @returns 部分的に設定されている場合、不足している項目のリスト
 */
export function checkPartialGitHubAppConfig(): string[] | null {
  const { storageClient } = getContainer();

  const appId = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_ID);
  const privateKey = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY);
  const installationId = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_INSTALLATION_ID);

  const hasPartialConfig = appId !== null || privateKey !== null || installationId !== null;
  if (!hasPartialConfig) {
    return null;
  }

  // 完全な設定ならnullを返す
  if (appId && privateKey && installationId) {
    return null;
  }

  // 不足している項目をリストアップ
  const missing: string[] = [];
  if (!appId) {
    missing.push('App ID');
  }
  if (!privateKey) {
    missing.push('Private Key');
  }
  if (!installationId) {
    missing.push('Installation ID');
  }

  return missing;
}
