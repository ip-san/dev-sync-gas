/**
 * Secret Manager のユニットテスト
 *
 * プロジェクトID設定、シークレット保存・取得・削除のテスト
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { initializeContainer, resetContainer } from '../../src/container';
import { createMockContainer } from '../mocks';
import {
  setSecretManagerProjectId,
  getSecretManagerProjectId,
  isSecretManagerEnabled,
  storeSecretInSecretManager,
  getSecretFromSecretManager,
  deleteSecretFromSecretManager,
  migratePrivateKeyToSecretManager,
  getGitHubPrivateKey,
} from '../../src/utils/secretManager';
import { SecretManagerError, ValidationError } from '../../src/utils/errors';
import { CONFIG_KEYS } from '../../src/config/propertyKeys';

// GASグローバルのモック
const mockUrlFetchApp = {
  fetch: mock(() => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({ payload: { data: 'dGVzdC1zZWNyZXQ=' } }), // "test-secret" in base64
  })),
};

const mockScriptApp = {
  getOAuthToken: mock(() => 'mock-oauth-token'),
};

const mockUtilities = {
  base64Encode: mock((value: string) => Buffer.from(value).toString('base64')),
  base64Decode: mock((value: string) => Uint8Array.from(Buffer.from(value, 'base64'))),
  newBlob: mock((data: Uint8Array) => ({
    getDataAsString: () => Buffer.from(data).toString('utf-8'),
  })),
};

(
  globalThis as typeof globalThis & {
    UrlFetchApp: typeof mockUrlFetchApp;
    ScriptApp: typeof mockScriptApp;
    Utilities: typeof mockUtilities;
  }
).UrlFetchApp = mockUrlFetchApp;
(
  globalThis as typeof globalThis & {
    UrlFetchApp: typeof mockUrlFetchApp;
    ScriptApp: typeof mockScriptApp;
    Utilities: typeof mockUtilities;
  }
).ScriptApp = mockScriptApp;
(
  globalThis as typeof globalThis & {
    UrlFetchApp: typeof mockUrlFetchApp;
    ScriptApp: typeof mockScriptApp;
    Utilities: typeof mockUtilities;
  }
).Utilities = mockUtilities;

describe('Secret Manager', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    initializeContainer(mockContainer);
    // モックのリセット
    mockUrlFetchApp.fetch.mockClear();
    mockScriptApp.getOAuthToken.mockClear();
  });

  afterEach(() => {
    resetContainer();
  });

  describe('setSecretManagerProjectId', () => {
    it('should set valid project ID', () => {
      const projectId = 'my-gcp-project';
      setSecretManagerProjectId(projectId);

      const storedId = mockContainer.storageClient.getProperty('SECRET_MANAGER_PROJECT_ID');
      expect(storedId).toBe(projectId);
    });

    it('should reject invalid project ID (empty)', () => {
      expect(() => setSecretManagerProjectId('')).toThrow(ValidationError);
    });

    it('should reject invalid project ID (invalid format)', () => {
      expect(() => setSecretManagerProjectId('INVALID_PROJECT')).toThrow(ValidationError);
      expect(() => setSecretManagerProjectId('ab')).toThrow(ValidationError); // too short
      expect(() => setSecretManagerProjectId('project@invalid')).toThrow(ValidationError);
    });

    it('should accept valid project ID formats', () => {
      const validIds = ['my-project-123', 'project-1', 'a-b-c-d-e-f'];

      for (const id of validIds) {
        expect(() => setSecretManagerProjectId(id)).not.toThrow();
      }
    });
  });

  describe('getSecretManagerProjectId', () => {
    it('should return null when not configured', () => {
      const projectId = getSecretManagerProjectId();
      expect(projectId).toBeNull();
    });

    it('should return configured project ID', () => {
      mockContainer.storageClient.setProperty('SECRET_MANAGER_PROJECT_ID', 'my-project');

      const projectId = getSecretManagerProjectId();
      expect(projectId).toBe('my-project');
    });
  });

  describe('isSecretManagerEnabled', () => {
    it('should return false when not configured', () => {
      expect(isSecretManagerEnabled()).toBe(false);
    });

    it('should return true when configured', () => {
      mockContainer.storageClient.setProperty('SECRET_MANAGER_PROJECT_ID', 'my-project');

      expect(isSecretManagerEnabled()).toBe(true);
    });
  });

  describe('storeSecretInSecretManager', () => {
    beforeEach(() => {
      mockContainer.storageClient.setProperty('SECRET_MANAGER_PROJECT_ID', 'test-project');
    });

    it('should throw error if Secret Manager is not configured', () => {
      mockContainer.storageClient.setProperty('SECRET_MANAGER_PROJECT_ID', null);

      expect(() => storeSecretInSecretManager('test-secret', 'value')).toThrow(SecretManagerError);
    });

    it('should reject invalid secret ID', () => {
      expect(() => storeSecretInSecretManager('invalid@id', 'value')).toThrow(ValidationError);
      expect(() => storeSecretInSecretManager('invalid id', 'value')).toThrow(ValidationError);
    });

    it('should create new secret if not exists', () => {
      // Mock: Secret does not exist
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 404,
        getContentText: () => 'Not found',
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      // Mock: Create secret success
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ name: 'projects/test-project/secrets/new-secret' }),
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      // Mock: Add version success
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({ name: 'projects/test-project/secrets/new-secret/versions/1' }),
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      storeSecretInSecretManager('new-secret', 'test-value');

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(3);
    });

    it('should add version if secret exists', () => {
      // Mock: Secret exists
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({ name: 'projects/test-project/secrets/existing-secret' }),
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      // Mock: Add version success
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({ name: 'projects/test-project/secrets/existing-secret/versions/2' }),
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      storeSecretInSecretManager('existing-secret', 'test-value');

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSecretFromSecretManager', () => {
    beforeEach(() => {
      mockContainer.storageClient.setProperty('SECRET_MANAGER_PROJECT_ID', 'test-project');
    });

    it('should throw error if Secret Manager is not configured', () => {
      mockContainer.storageClient.setProperty('SECRET_MANAGER_PROJECT_ID', null);

      expect(() => getSecretFromSecretManager('test-secret')).toThrow(SecretManagerError);
    });

    it('should retrieve secret successfully', () => {
      // Mock: Access secret success
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ payload: { data: 'dGVzdC12YWx1ZQ==' } }), // "test-value" in base64
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      const secret = getSecretFromSecretManager('test-secret');

      expect(secret).toBe('test-value');
      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle 404 not found error', () => {
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 404,
        getContentText: () => 'Not found',
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      expect(() => getSecretFromSecretManager('nonexistent')).toThrow(SecretManagerError);
    });

    it('should handle other API errors', () => {
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 403,
        getContentText: () => 'Permission denied',
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      expect(() => getSecretFromSecretManager('test-secret')).toThrow(SecretManagerError);
    });
  });

  describe('deleteSecretFromSecretManager', () => {
    beforeEach(() => {
      mockContainer.storageClient.setProperty('SECRET_MANAGER_PROJECT_ID', 'test-project');
    });

    it('should throw error if Secret Manager is not configured', () => {
      mockContainer.storageClient.setProperty('SECRET_MANAGER_PROJECT_ID', null);

      expect(() => deleteSecretFromSecretManager('test-secret')).toThrow(SecretManagerError);
    });

    it('should delete secret successfully', () => {
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 200,
        getContentText: () => JSON.stringify({}),
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      deleteSecretFromSecretManager('test-secret');

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle delete failure', () => {
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 404,
        getContentText: () => 'Not found',
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      expect(() => deleteSecretFromSecretManager('nonexistent')).toThrow(SecretManagerError);
    });
  });

  describe('migratePrivateKeyToSecretManager', () => {
    beforeEach(() => {
      mockContainer.storageClient.setProperty('SECRET_MANAGER_PROJECT_ID', 'test-project');
    });

    it('should migrate private key from PropertiesService', () => {
      // Set up private key in PropertiesService
      const privateKey = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY, privateKey);

      // Mock: Secret does not exist
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 404,
        getContentText: () => 'Not found',
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      // Mock: Create secret success
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({ name: 'projects/test-project/secrets/github-app-private-key' }),
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      // Mock: Add version success
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({
            name: 'projects/test-project/secrets/github-app-private-key/versions/1',
          }),
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      migratePrivateKeyToSecretManager();

      expect(mockUrlFetchApp.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw error if no private key in PropertiesService', () => {
      expect(() => migratePrivateKeyToSecretManager()).toThrow(ValidationError);
    });
  });

  describe('getGitHubPrivateKey', () => {
    it('should return key from PropertiesService when Secret Manager is disabled', () => {
      const privateKey = '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY, privateKey);

      const key = getGitHubPrivateKey();
      expect(key).toBe(privateKey);
    });

    it('should return key from Secret Manager when enabled', () => {
      mockContainer.storageClient.setProperty('SECRET_MANAGER_PROJECT_ID', 'test-project');

      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 200,
        getContentText: () =>
          JSON.stringify({
            payload: {
              data: 'LS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tCnRlc3Qta2V5Ci0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0=',
            }, // base64 encoded private key
          }),
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      const key = getGitHubPrivateKey();
      expect(key).toContain('PRIVATE KEY');
    });

    it('should fallback to PropertiesService if Secret Manager fails', () => {
      mockContainer.storageClient.setProperty('SECRET_MANAGER_PROJECT_ID', 'test-project');

      const fallbackKey = '-----BEGIN PRIVATE KEY-----\nfallback-key\n-----END PRIVATE KEY-----';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY, fallbackKey);

      // Mock: Secret Manager access fails
      mockUrlFetchApp.fetch.mockReturnValueOnce({
        getResponseCode: () => 404,
        getContentText: () => 'Not found',
      } as GoogleAppsScript.URL_Fetch.HTTPResponse);

      const key = getGitHubPrivateKey();
      expect(key).toBe(fallbackKey);
    });

    it('should throw error if key not found anywhere', () => {
      expect(() => getGitHubPrivateKey()).toThrow(ValidationError);
    });
  });
});
