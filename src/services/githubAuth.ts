import { KJUR } from 'jsrsasign';
import type { GitHubAppConfig } from '../types';
import { getContainer } from '../container';

const GITHUB_API_BASE = 'https://api.github.com';

/** Installation Access Tokenのキャッシュ（有効期限付き） */
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * GitHub App用のJWTを生成
 *
 * @param appId - GitHub App ID
 * @param privateKey - Private Key（PEM形式）
 * @returns JWT文字列
 */
export function generateJWT(appId: string, privateKey: string): string {
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

  const jwt = KJUR.jws.JWS.sign('RS256', sHeader, sPayload, privateKey);
  return jwt;
}

/**
 * Private Keyの形式を検証
 *
 * @param privateKey - PEM形式の秘密鍵
 * @throws Error Private Keyの形式が不正な場合
 */
function validatePrivateKey(privateKey: string): void {
  if (!privateKey) {
    throw new Error('GitHub App Private Key is empty');
  }

  // RSA PRIVATE KEY または PRIVATE KEY のいずれかを許可
  const hasValidHeader =
    privateKey.includes('-----BEGIN RSA PRIVATE KEY-----') ||
    privateKey.includes('-----BEGIN PRIVATE KEY-----');
  const hasValidFooter =
    privateKey.includes('-----END RSA PRIVATE KEY-----') ||
    privateKey.includes('-----END PRIVATE KEY-----');

  if (!hasValidHeader || !hasValidFooter) {
    throw new Error(
      'Invalid Private Key format. Expected PEM format with BEGIN/END markers. ' +
        'Make sure to replace newlines with \\n when setting the key.'
    );
  }
}

/**
 * Installation Access Tokenを取得
 *
 * @param appConfig - GitHub App設定
 * @returns アクセストークン
 */
export function getInstallationToken(appConfig: GitHubAppConfig): string {
  const { httpClient, logger } = getContainer();

  // キャッシュが有効な場合はそれを返す（5分のマージンを持たせる）
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  logger.log('🔑 Fetching new GitHub App Installation Token...');

  // Private Keyの形式を検証
  validatePrivateKey(appConfig.privateKey);

  // JWTを生成
  const jwt = generateJWT(appConfig.appId, appConfig.privateKey);

  // Installation Access Tokenを取得
  const url = `${GITHUB_API_BASE}/app/installations/${appConfig.installationId}/access_tokens`;

  try {
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
      cachedToken = {
        token: response.data.token,
        expiresAt,
      };
      logger.log('✅ GitHub App Installation Token obtained successfully');
      return response.data.token;
    }

    // よくあるエラーの原因をヒントとして追加
    let hint = '';
    if (response.statusCode === 401) {
      hint = ' Hint: Check if the App ID and Private Key are correct.';
    } else if (response.statusCode === 404) {
      hint =
        ' Hint: Check if the Installation ID is correct and the App is installed on the repository.';
    } else if (response.statusCode === 403) {
      hint =
        ' Hint: Check if the App has the required permissions (Pull requests, Actions, Metadata).';
    }
    throw new Error(
      `Failed to get installation token: ${response.statusCode} - ${response.content}${hint}`
    );
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
  cachedToken = null;
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
