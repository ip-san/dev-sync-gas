import { KJUR } from 'jsrsasign';
import { PRIVATE_KEY_PREVIEW_LENGTH } from '../config/apiConfig';
import { getContainer } from '../container';
import type { GitHubAppConfig } from '../types';
import { ErrorCode, GitHubAPIError } from '../utils/errors';
import { getGitHubPrivateKey } from '../utils/secretManager';

const GITHUB_API_BASE = 'https://api.github.com';

// セキュリティ改善: グローバル変数ではなくPropertiesServiceにキャッシュ
const CACHE_TOKEN_KEY = '_GITHUB_APP_CACHED_TOKEN';
const CACHE_EXPIRES_KEY = '_GITHUB_APP_CACHED_EXPIRES';

/**
 * GitHub App用のJWTを生成
 *
 * @param appId - GitHub App ID
 * @param privateKey - Private Key（PEM形式）
 * @returns JWT文字列
 */
export function generateJWT(appId: string, privateKey: string): string {
  const { logger } = getContainer();

  logger.debug('[JWT] Generating JWT...');
  logger.debug(`[JWT] App ID: ${appId}`);
  logger.debug(`[JWT] Private Key length: ${privateKey.length}`);
  logger.debug(`[JWT] Private Key starts with: ${privateKey.substring(0, 30)}...`);
  logger.debug(`[JWT] Private Key type: ${typeof privateKey}`);

  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iat: now - 60, // 発行時刻（クロックスキュー対策で60秒前）
    exp: now + 600, // 有効期限（10分後、GitHub上限）
    iss: appId, // 発行者（App ID）
  };

  const sHeader = JSON.stringify(header);
  const sPayload = JSON.stringify(payload);

  logger.debug('[JWT] About to sign with KJUR.jws.JWS.sign...');

  try {
    const jwt = KJUR.jws.JWS.sign('RS256', sHeader, sPayload, privateKey);
    logger.debug('[JWT] JWT generated successfully');
    return jwt;
  } catch (error) {
    logger.error(
      `[JWT] Failed to generate JWT: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

/**
 * Private Keyの形式を検証
 *
 * @param privateKey - PEM形式の秘密鍵
 * @throws Error Private Keyの形式が不正な場合
 */
function validatePrivateKey(privateKey: string): void {
  if (!privateKey) {
    throw new GitHubAPIError('GitHub App Private Key is empty', {
      code: ErrorCode.GITHUB_AUTH_FAILED,
      context: { reason: 'empty_private_key' },
    });
  }

  // RSA PRIVATE KEY または PRIVATE KEY のいずれかを許可
  const hasValidHeader =
    privateKey.includes('-----BEGIN RSA PRIVATE KEY-----') ||
    privateKey.includes('-----BEGIN PRIVATE KEY-----');
  const hasValidFooter =
    privateKey.includes('-----END RSA PRIVATE KEY-----') ||
    privateKey.includes('-----END PRIVATE KEY-----');

  if (!hasValidHeader || !hasValidFooter) {
    throw new GitHubAPIError(
      'Invalid Private Key format. Expected PEM format with BEGIN/END markers. ' +
        'Make sure to replace newlines with \\n when setting the key.',
      {
        code: ErrorCode.GITHUB_AUTH_FAILED,
        context: { reason: 'invalid_pem_format' },
      }
    );
  }
}

/**
 * エラーコンテンツから機密情報を除外
 * セキュリティ: エラーメッセージに含まれる可能性のあるトークンやキーを除外
 *
 * @param content - 元のエラーコンテンツ
 * @returns サニタイズされたコンテンツ
 */
function sanitizeErrorContent(content: string): string {
  // 最初の100文字のみを使用（機密情報の露出を最小化）
  let sanitized = content.substring(0, PRIVATE_KEY_PREVIEW_LENGTH);

  // トークンやキーのパターンをマスク
  const sensitivePatterns = [
    /ghp_[a-zA-Z0-9]{36}/g, // GitHub PAT
    /github_pat_[a-zA-Z0-9_]{82}/g, // Fine-grained PAT
    /ghs_[a-zA-Z0-9]{36}/g, // GitHub App installation token
    /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, // PEM keys
  ];

  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  if (content.length > 100) {
    sanitized += '... (truncated)';
  }

  return sanitized;
}

/**
 * キャッシュされたトークンを取得
 *
 * @returns キャッシュされたトークン、または null
 */
function getCachedToken(): string | null {
  const { storageClient } = getContainer();
  const now = Date.now();
  const cachedToken = storageClient.getProperty(CACHE_TOKEN_KEY);
  const cachedExpiresStr = storageClient.getProperty(CACHE_EXPIRES_KEY);

  if (cachedToken && cachedExpiresStr) {
    const cachedExpiresAt = parseInt(cachedExpiresStr, 10);
    // 5分のマージンを持たせる
    if (cachedExpiresAt > now + 5 * 60 * 1000) {
      return cachedToken;
    }
  }

  return null;
}

/**
 * Private Keyを解決
 * 優先順位: 1. appConfig.privateKey, 2. Secret Manager, 3. PropertiesService
 *
 * @param appConfig - GitHub App設定
 * @returns Private Key
 */
function resolvePrivateKey(appConfig: GitHubAppConfig): string {
  if (appConfig.privateKey && appConfig.privateKey !== '') {
    return appConfig.privateKey;
  }
  return getGitHubPrivateKey();
}

/**
 * Installation Access TokenをAPIから取得
 *
 * @param installationId - Installation ID
 * @param jwt - JWT認証トークン
 * @returns アクセストークン
 */
function fetchInstallationToken(installationId: string, jwt: string): string {
  const { httpClient, logger, storageClient } = getContainer();
  const url = `${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`;

  const response = httpClient.fetch<{
    token: string;
    expires_at: string;
  }>(url, {
    method: 'post',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'DevSyncGAS',
    },
    muteHttpExceptions: true,
  });

  if (response.statusCode >= 200 && response.statusCode < 300 && response.data) {
    const expiresAt = new Date(response.data.expires_at).getTime();

    // PropertiesServiceにキャッシュ（セキュリティ改善）
    storageClient.setProperty(CACHE_TOKEN_KEY, response.data.token);
    storageClient.setProperty(CACHE_EXPIRES_KEY, expiresAt.toString());

    logger.info('✅ GitHub App Installation Token obtained successfully');
    return response.data.token;
  }

  // エラーの場合はヒント付きでスロー
  const hint = getErrorHint(response.statusCode);
  const safeContent = sanitizeErrorContent(response.content);

  throw new Error(
    `Failed to get installation token: ${response.statusCode} - ${safeContent}${hint}`
  );
}

/**
 * HTTPステータスコードに応じたエラーヒントを取得
 *
 * @param statusCode - HTTPステータスコード
 * @returns エラーヒント文字列
 */
function getErrorHint(statusCode: number): string {
  if (statusCode === 401) {
    return ' Hint: Check if the App ID and Private Key are correct.';
  }
  if (statusCode === 404) {
    return ' Hint: Check if the Installation ID is correct and the App is installed on the repository.';
  }
  if (statusCode === 403) {
    return ' Hint: Check if the App has the required permissions (Pull requests, Actions, Metadata).';
  }
  return '';
}

/**
 * Installation Access Tokenを取得
 *
 * @param appConfig - GitHub App設定
 * @returns アクセストークン
 */
export function getInstallationToken(appConfig: GitHubAppConfig): string {
  const { logger } = getContainer();

  // キャッシュが有効な場合はそれを返す
  const cachedToken = getCachedToken();
  if (cachedToken) {
    return cachedToken;
  }

  logger.info('🔑 Fetching new GitHub App Installation Token...');

  // Private Keyを取得・検証
  const privateKey = resolvePrivateKey(appConfig);
  validatePrivateKey(privateKey);

  // JWTを生成
  const jwt = generateJWT(appConfig.appId, privateKey);

  // Installation Access Tokenを取得
  try {
    return fetchInstallationToken(appConfig.installationId, jwt);
  } catch (error) {
    throw new Error(
      `GitHub App authentication failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * キャッシュされたトークンをクリア（テスト用）
 */
export function clearTokenCache(): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty(CACHE_TOKEN_KEY);
  storageClient.deleteProperty(CACHE_EXPIRES_KEY);
}

/**
 * 認証情報からトークンを取得
 * - GitHub Apps設定がある場合: Installation Tokenを取得
 * - それ以外: PATをそのまま返す
 *
 * @param token - PAT（オプション）
 * @param appConfig - GitHub App設定（オプション）
 * @returns 使用するトークン
 */
export function resolveGitHubToken(token?: string, appConfig?: GitHubAppConfig): string {
  if (appConfig) {
    return getInstallationToken(appConfig);
  }

  if (token) {
    return token;
  }

  throw new Error(
    'GitHub authentication not configured. Set either GITHUB_TOKEN or GitHub App credentials.'
  );
}
