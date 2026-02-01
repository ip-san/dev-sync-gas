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
import { CONFIG_KEYS } from '../config/propertyKeys';
import { SecretManagerError, ValidationError, ErrorCode } from './errors';

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
    throw new ValidationError('GCP Project ID is required and must be a string', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { projectId },
    });
  }

  // プロジェクトID形式の検証
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new ValidationError(
      'Invalid GCP Project ID format. Must be 6-30 characters, ' +
        'lowercase letters, digits, or hyphens, start with a letter, end with letter or digit.',
      {
        code: ErrorCode.VALIDATION_FAILED,
        context: { projectId },
      }
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
    throw new SecretManagerError(
      'Secret Manager is not configured. ' +
        'Run setSecretManagerProjectId("your-project-id") first.',
      {
        code: ErrorCode.SECRET_MANAGER_NOT_CONFIGURED,
      }
    );
  }

  // Secret IDの検証
  if (!/^[a-zA-Z0-9_-]+$/.test(secretId)) {
    throw new ValidationError(
      'Secret ID must contain only letters, numbers, hyphens, or underscores',
      {
        code: ErrorCode.VALIDATION_FAILED,
        context: { secretId },
      }
    );
  }

  const { logger } = getContainer();

  try {
    // 1. シークレットが存在するか確認
    const secretExists = checkSecretExists(projectId, secretId);

    if (!secretExists) {
      // シークレットを作成
      createSecret(projectId, secretId, labels);
      logger.info(`✅ Created secret: ${secretId}`);
    }

    // 2. 新しいバージョンを追加
    addSecretVersion(projectId, secretId, secretValue);
    logger.info(`✅ Stored secret version: ${secretId}`);
  } catch (error) {
    throw new SecretManagerError('Failed to store secret in Secret Manager', {
      code: ErrorCode.SECRET_MANAGER_ACCESS_FAILED,
      context: { secretId, projectId },
      cause: error as Error,
    });
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
    throw new SecretManagerError(
      'Secret Manager is not configured. ' +
        'Run setSecretManagerProjectId("your-project-id") first.',
      {
        code: ErrorCode.SECRET_MANAGER_NOT_CONFIGURED,
      }
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
      const statusCode = response.getResponseCode();
      const errorCode =
        statusCode === 404 ? ErrorCode.SECRET_NOT_FOUND : ErrorCode.SECRET_MANAGER_ACCESS_FAILED;

      throw new SecretManagerError(`Failed to access secret: ${statusCode}`, {
        code: errorCode,
        context: { secretId, version, statusCode, response: response.getContentText() },
      });
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
    if (error instanceof SecretManagerError) {
      throw error;
    }
    throw new SecretManagerError('Failed to get secret from Secret Manager', {
      code: ErrorCode.SECRET_MANAGER_ACCESS_FAILED,
      context: { secretId, version },
      cause: error as Error,
    });
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
    const statusCode = response.getResponseCode();
    throw new SecretManagerError(`Failed to create secret: ${statusCode}`, {
      code: ErrorCode.SECRET_MANAGER_ACCESS_FAILED,
      context: { secretId, projectId, statusCode, response: response.getContentText() },
    });
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
    const statusCode = response.getResponseCode();
    throw new SecretManagerError(`Failed to add secret version: ${statusCode}`, {
      code: ErrorCode.SECRET_MANAGER_ACCESS_FAILED,
      context: { secretId, projectId, statusCode, response: response.getContentText() },
    });
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
    throw new SecretManagerError('Secret Manager is not configured', {
      code: ErrorCode.SECRET_MANAGER_NOT_CONFIGURED,
    });
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
      const statusCode = response.getResponseCode();
      throw new SecretManagerError(`Failed to delete secret: ${statusCode}`, {
        code: ErrorCode.SECRET_MANAGER_ACCESS_FAILED,
        context: { secretId, projectId, statusCode, response: response.getContentText() },
      });
    }

    logger.info(`✅ Deleted secret: ${secretId}`);
  } catch (error) {
    if (error instanceof SecretManagerError) {
      throw error;
    }
    throw new SecretManagerError('Failed to delete secret from Secret Manager', {
      code: ErrorCode.SECRET_MANAGER_ACCESS_FAILED,
      context: { secretId },
      cause: error as Error,
    });
  }
}

/**
 * GitHub Private KeyをSecret Managerに移行
 * PropertiesServiceからSecret Managerへ移行するヘルパー関数
 */
export function migratePrivateKeyToSecretManager(): void {
  const { storageClient, logger } = getContainer();

  // PropertiesServiceからPrivate Keyを取得
  const privateKey = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY);
  if (!privateKey) {
    throw new ValidationError('No GitHub App Private Key found in PropertiesService', {
      code: ErrorCode.SECRET_NOT_FOUND,
      context: { key: CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY },
    });
  }

  // Secret Managerに保存
  storeSecretInSecretManager('github-app-private-key', privateKey, {
    app: 'dev-sync-gas',
    type: 'github-private-key',
  });

  logger.info('✅ Migrated Private Key to Secret Manager');
  logger.warn('⚠️ Original key is still in PropertiesService');
  logger.warn('   Run clearGitHubAppConfig() to remove it after verifying the migration');
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
      const fallbackKey = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY);
      if (fallbackKey) {
        return fallbackKey;
      }
      throw error;
    }
  }

  // Secret Managerが無効な場合はPropertiesServiceから取得
  const privateKey = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY);
  if (!privateKey) {
    throw new ValidationError('GitHub App Private Key not found', {
      code: ErrorCode.SECRET_NOT_FOUND,
      context: { key: CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY },
    });
  }

  return privateKey;
}
