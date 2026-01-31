/**
 * Secret Manager関連のGASエントリーポイント関数
 */

import {
  setSecretManagerProjectId as setProjectId,
  getSecretManagerProjectId,
  isSecretManagerEnabled,
  storeSecretInSecretManager,
  getSecretFromSecretManager,
  deleteSecretFromSecretManager,
  migratePrivateKeyToSecretManager,
} from '../utils/secretManager';
import { ensureContainerInitialized } from './helpers';
import { getContainer } from '../container';

/**
 * Secret ManagerのGCPプロジェクトIDを設定
 *
 * 使い方:
 * ```javascript
 * // 1. Secret Managerを有効化
 * enableSecretManager('your-gcp-project-id');
 *
 * // 2. GitHub Apps認証をセットアップ（Private KeyがSecret Managerに保存される）
 * setupWithGitHubApp(appId, privateKey, installationId, spreadsheetId);
 * ```
 *
 * 注意:
 * - GCPプロジェクトでSecret Manager APIを有効化する必要があります
 * - GASのマニフェストファイル(appsscript.json)にOAuth2スコープを追加:
 *   "https://www.googleapis.com/auth/cloud-platform"
 */
export function enableSecretManager(gcpProjectId: string): void {
  ensureContainerInitialized();
  setProjectId(gcpProjectId);
  Logger.log('✅ Secret Manager enabled');
  Logger.log(`   GCP Project: ${gcpProjectId}`);
  Logger.log('');
  Logger.log('Next steps:');
  Logger.log('1. Enable Secret Manager API in GCP Console');
  Logger.log('2. Add OAuth scope to appsscript.json:');
  Logger.log('   "https://www.googleapis.com/auth/cloud-platform"');
  Logger.log('3. Use setupWithGitHubApp() - Private Key will be stored in Secret Manager');
}

/**
 * Secret Managerを無効化
 */
export function disableSecretManager(): void {
  ensureContainerInitialized();
  const { storageClient } = getContainer();
  storageClient.deleteProperty('SECRET_MANAGER_PROJECT_ID');
  Logger.log('✅ Secret Manager disabled');
}

/**
 * Secret Managerの状態を表示
 */
export function showSecretManagerStatus(): void {
  ensureContainerInitialized();

  const enabled = isSecretManagerEnabled();
  const projectId = getSecretManagerProjectId();

  if (enabled && projectId) {
    Logger.log('📦 Secret Manager: ✅ Enabled');
    Logger.log(`   GCP Project: ${projectId}`);
  } else {
    Logger.log('📦 Secret Manager: ❌ Disabled');
    Logger.log('');
    Logger.log('To enable:');
    Logger.log('  enableSecretManager("your-gcp-project-id")');
  }
}

/**
 * シークレットをSecret Managerに保存
 *
 * 使い方:
 * ```javascript
 * // カスタムシークレットを保存
 * storeSecret('api-key', 'sk-xxxxx', { app: 'my-app' });
 * ```
 */
export function storeSecret(
  secretId: string,
  secretValue: string,
  labels?: Record<string, string>
): void {
  ensureContainerInitialized();
  storeSecretInSecretManager(secretId, secretValue, labels);
}

/**
 * Secret Managerからシークレットを取得
 *
 * 使い方:
 * ```javascript
 * const apiKey = getSecret('api-key');
 * ```
 */
export function getSecret(secretId: string, version = 'latest'): string {
  ensureContainerInitialized();
  return getSecretFromSecretManager(secretId, version);
}

/**
 * Secret Managerからシークレットを削除
 *
 * 使い方:
 * ```javascript
 * deleteSecret('old-api-key');
 * ```
 */
export function deleteSecret(secretId: string): void {
  ensureContainerInitialized();
  deleteSecretFromSecretManager(secretId);
}

/**
 * GitHub Private KeyをPropertiesServiceからSecret Managerに移行
 *
 * 使い方:
 * ```javascript
 * // 1. Secret Managerを有効化
 * enableSecretManager('your-gcp-project-id');
 *
 * // 2. Private Keyを移行
 * migratePrivateKey();
 *
 * // 3. 動作確認後、PropertiesServiceから削除
 * clearGitHubAppConfig();
 * ```
 */
export function migratePrivateKey(): void {
  ensureContainerInitialized();
  migratePrivateKeyToSecretManager();
}
