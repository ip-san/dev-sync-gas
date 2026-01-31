/**
 * Google Secret Manager統合
 * セキュリティ: Private Keyなどの機密情報を安全に保存・取得
 *
 * セットアップ手順:
 * 1. GCPプロジェクトでSecret Manager APIを有効化
 * 2. GASにOAuth2スコープを追加: https://www.googleapis.com/auth/cloud-platform
 * 3. setSecretManagerProjectId() でGCPプロジェクトIDを設定
 * 4. storeSecretInSecretManager() で秘密情報を保存
 */

import { getContainer } from '../container';

const SECRET_MANAGER_API_BASE = 'https://secretmanager.googleapis.com/v1';
const SECRET_MANAGER_PROJECT_ID_KEY = 'SECRET_MANAGER_PROJECT_ID';

/**
 * Secret ManagerのGCPプロジェクトIDを設定
 *
 * @param projectId - GCPプロジェクトID
 */
export function setSecretManagerProjectId(projectId: string): void {
  const { storageClient } = getContainer();

  if (!projectId || typeof projectId !== 'string') {
    throw new Error('GCP Project ID is required and must be a string');
  }

  // プロジェクトID形式の検証
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error(
      'Invalid GCP Project ID format. Must be 6-30 characters, ' +
        'lowercase letters, digits, or hyphens, start with a letter, end with letter or digit.'
    );
  }

  storageClient.setProperty(SECRET_MANAGER_PROJECT_ID_KEY, projectId);
}

/**
 * Secret ManagerのGCPプロジェクトIDを取得
 *
 * @returns GCPプロジェクトID
 */
export function getSecretManagerProjectId(): string | null {
  const { storageClient } = getContainer();
  return storageClient.getProperty(SECRET_MANAGER_PROJECT_ID_KEY);
}

/**
 * Secret Managerが有効かチェック
 *
 * @returns Secret Managerが設定されている場合true
 */
export function isSecretManagerEnabled(): boolean {
  return getSecretManagerProjectId() !== null;
}

/**
 * Secret Managerにシークレットを保存
 *
 * @param secretId - シークレットID（例: "github-private-key"）
 * @param secretValue - シークレットの値
 * @param labels - オプションのラベル
 */
export function storeSecretInSecretManager(
  secretId: string,
  secretValue: string,
  labels?: Record<string, string>
): void {
  const projectId = getSecretManagerProjectId();
  if (!projectId) {
    throw new Error(
      'Secret Manager is not configured. ' +
        'Run setSecretManagerProjectId("your-project-id") first.'
    );
  }

  // Secret IDの検証
  if (!/^[a-zA-Z0-9_-]+$/.test(secretId)) {
    throw new Error('Secret ID must contain only letters, numbers, hyphens, or underscores');
  }

  const { logger } = getContainer();

  try {
    // 1. シークレットが存在するか確認
    const secretExists = checkSecretExists(projectId, secretId);

    if (!secretExists) {
      // シークレットを作成
      createSecret(projectId, secretId, labels);
      logger.log(`✅ Created secret: ${secretId}`);
    }

    // 2. 新しいバージョンを追加
    addSecretVersion(projectId, secretId, secretValue);
    logger.log(`✅ Stored secret version: ${secretId}`);
  } catch (error) {
    throw new Error(
      `Failed to store secret in Secret Manager: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Secret Managerからシークレットを取得
 *
 * @param secretId - シークレットID
 * @param version - バージョン（デフォルト: "latest"）
 * @returns シークレットの値
 */
export function getSecretFromSecretManager(secretId: string, version = 'latest'): string {
  const projectId = getSecretManagerProjectId();
  if (!projectId) {
    throw new Error(
      'Secret Manager is not configured. ' +
        'Run setSecretManagerProjectId("your-project-id") first.'
    );
  }

  try {
    const url = `${SECRET_MANAGER_API_BASE}/projects/${projectId}/secrets/${secretId}/versions/${version}:access`;

    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
        'Content-Type': 'application/json',
      },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(
        `Failed to access secret: ${response.getResponseCode()} - ${response.getContentText()}`
      );
    }

    const data = JSON.parse(response.getContentText()) as {
      payload: { data: string };
    };

    // Base64デコード
    const secretValue = Utilities.newBlob(
      Utilities.base64Decode(data.payload.data)
    ).getDataAsString();

    return secretValue;
  } catch (error) {
    throw new Error(
      `Failed to get secret from Secret Manager: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * シークレットが存在するかチェック
 *
 * @param projectId - GCPプロジェクトID
 * @param secretId - シークレットID
 * @returns 存在する場合true
 */
function checkSecretExists(projectId: string, secretId: string): boolean {
  const url = `${SECRET_MANAGER_API_BASE}/projects/${projectId}/secrets/${secretId}`;

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
    },
    muteHttpExceptions: true,
  });

  return response.getResponseCode() === 200;
}

/**
 * シークレットを作成
 *
 * @param projectId - GCPプロジェクトID
 * @param secretId - シークレットID
 * @param labels - オプションのラベル
 */
function createSecret(projectId: string, secretId: string, labels?: Record<string, string>): void {
  const url = `${SECRET_MANAGER_API_BASE}/projects/${projectId}/secrets?secretId=${secretId}`;

  const payload = {
    replication: {
      automatic: {},
    },
    labels: labels ?? {},
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(
      `Failed to create secret: ${response.getResponseCode()} - ${response.getContentText()}`
    );
  }
}

/**
 * シークレットのバージョンを追加
 *
 * @param projectId - GCPプロジェクトID
 * @param secretId - シークレットID
 * @param secretValue - シークレットの値
 */
function addSecretVersion(projectId: string, secretId: string, secretValue: string): void {
  const url = `${SECRET_MANAGER_API_BASE}/projects/${projectId}/secrets/${secretId}:addVersion`;

  // Base64エンコード
  const encodedValue = Utilities.base64Encode(secretValue);

  const payload = {
    payload: {
      data: encodedValue,
    },
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(
      `Failed to add secret version: ${response.getResponseCode()} - ${response.getContentText()}`
    );
  }
}

/**
 * シークレットを削除
 *
 * @param secretId - シークレットID
 */
export function deleteSecretFromSecretManager(secretId: string): void {
  const projectId = getSecretManagerProjectId();
  if (!projectId) {
    throw new Error('Secret Manager is not configured');
  }

  const { logger } = getContainer();

  try {
    const url = `${SECRET_MANAGER_API_BASE}/projects/${projectId}/secrets/${secretId}`;

    const response = UrlFetchApp.fetch(url, {
      method: 'delete',
      headers: {
        Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
      },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(
        `Failed to delete secret: ${response.getResponseCode()} - ${response.getContentText()}`
      );
    }

    logger.log(`✅ Deleted secret: ${secretId}`);
  } catch (error) {
    throw new Error(
      `Failed to delete secret from Secret Manager: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * GitHub Private KeyをSecret Managerに移行
 * PropertiesServiceからSecret Managerへ移行するヘルパー関数
 */
export function migratePrivateKeyToSecretManager(): void {
  const { storageClient, logger } = getContainer();

  // PropertiesServiceからPrivate Keyを取得
  const privateKey = storageClient.getProperty('GITHUB_APP_PRIVATE_KEY');
  if (!privateKey) {
    throw new Error('No GitHub App Private Key found in PropertiesService');
  }

  // Secret Managerに保存
  storeSecretInSecretManager('github-app-private-key', privateKey, {
    app: 'dev-sync-gas',
    type: 'github-private-key',
  });

  logger.log('✅ Migrated Private Key to Secret Manager');
  logger.log('⚠️ Original key is still in PropertiesService');
  logger.log('   Run clearGitHubAppConfig() to remove it after verifying the migration');
}

/**
 * Secret ManagerからGitHub Private Keyを取得
 * 従来のPropertiesServiceとの互換性を保つラッパー関数
 *
 * @returns Private Key
 */
export function getGitHubPrivateKey(): string {
  const { storageClient } = getContainer();

  // Secret Managerが有効な場合はそちらから取得
  if (isSecretManagerEnabled()) {
    try {
      return getSecretFromSecretManager('github-app-private-key');
    } catch (error) {
      // Secret Managerでの取得に失敗した場合はPropertiesServiceにフォールバック
      const fallbackKey = storageClient.getProperty('GITHUB_APP_PRIVATE_KEY');
      if (fallbackKey) {
        return fallbackKey;
      }
      throw error;
    }
  }

  // Secret Managerが無効な場合はPropertiesServiceから取得
  const privateKey = storageClient.getProperty('GITHUB_APP_PRIVATE_KEY');
  if (!privateKey) {
    throw new Error('GitHub App Private Key not found');
  }

  return privateKey;
}
