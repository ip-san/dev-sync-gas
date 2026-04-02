/**
 * 入力検証ユーティリティ
 * セキュリティ: XSS、インジェクション攻撃を防ぐための検証機能
 */

import { ErrorCode, ValidationError } from './errors';

/**
 * GitHubリポジトリオーナー名の検証
 * 許可: 英数字、ハイフン、アンダースコア（1-39文字）
 */
export function validateRepositoryOwner(owner: string): void {
  if (!owner || typeof owner !== 'string') {
    throw new ValidationError('Repository owner is required and must be a string', {
      code: ErrorCode.INVALID_REPOSITORY,
      context: { owner },
    });
  }

  if (owner.length < 1 || owner.length > 39) {
    throw new ValidationError('Repository owner must be between 1 and 39 characters', {
      code: ErrorCode.INVALID_REPOSITORY,
      context: { owner, length: owner.length },
    });
  }

  // GitHub username/organization name rules
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(owner)) {
    throw new ValidationError(
      'Repository owner must contain only alphanumeric characters or hyphens, ' +
        'cannot start or end with a hyphen, and must be 1-39 characters',
      {
        code: ErrorCode.INVALID_REPOSITORY,
        context: { owner },
      }
    );
  }
}

/**
 * GitHubリポジトリ名の検証
 * 許可: 英数字、ハイフン、アンダースコア、ピリオド（1-100文字）
 */
export function validateRepositoryName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Repository name is required and must be a string', {
      code: ErrorCode.INVALID_REPOSITORY,
      context: { name },
    });
  }

  if (name.length < 1 || name.length > 100) {
    throw new ValidationError('Repository name must be between 1 and 100 characters', {
      code: ErrorCode.INVALID_REPOSITORY,
      context: { name, length: name.length },
    });
  }

  // GitHub repository name rules
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new ValidationError(
      'Repository name must contain only alphanumeric characters, ' +
        'hyphens, underscores, or periods',
      {
        code: ErrorCode.INVALID_REPOSITORY,
        context: { name },
      }
    );
  }

  // 危険なパターンを拒否
  const dangerousPatterns = ['../', '.\\', '<', '>', '"', "'", '`'];
  for (const pattern of dangerousPatterns) {
    if (name.includes(pattern)) {
      throw new ValidationError(`Repository name contains invalid characters: ${pattern}`, {
        code: ErrorCode.INVALID_REPOSITORY,
        context: { name, invalidPattern: pattern },
      });
    }
  }
}

/**
 * プロジェクト名の検証
 * 許可: 英数字、スペース、ハイフン、アンダースコア（1-100文字）
 */
export function validateProjectName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new ValidationError('Project name is required and must be a string', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { name },
    });
  }

  if (name.length < 1 || name.length > 100) {
    throw new ValidationError('Project name must be between 1 and 100 characters', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { name, length: name.length },
    });
  }

  // プロジェクト名: 英数字、スペース、ハイフン、アンダースコアのみ
  if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
    throw new ValidationError(
      'Project name must contain only alphanumeric characters, spaces, hyphens, or underscores',
      {
        code: ErrorCode.VALIDATION_FAILED,
        context: { name },
      }
    );
  }
}

/**
 * スプレッドシートIDの検証
 * Google Spreadsheet ID format: 通常44文字の英数字、ハイフン、アンダースコア
 */
export function validateSpreadsheetId(id: string): void {
  if (!id || typeof id !== 'string') {
    throw new ValidationError('Spreadsheet ID is required and must be a string', {
      code: ErrorCode.INVALID_SPREADSHEET_ID,
      context: { id },
    });
  }

  // Google Spreadsheet IDは通常44文字（範囲: 20-100文字）
  if (id.length < 20 || id.length > 100) {
    throw new ValidationError('Spreadsheet ID format is invalid (expected 20-100 characters)', {
      code: ErrorCode.INVALID_SPREADSHEET_ID,
      context: { id, length: id.length },
    });
  }

  // 英数字、ハイフン、アンダースコアのみ
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new ValidationError(
      'Spreadsheet ID must contain only alphanumeric characters, hyphens, or underscores',
      {
        code: ErrorCode.INVALID_SPREADSHEET_ID,
        context: { id },
      }
    );
  }

  // 推奨: 44文字の標準フォーマットを警告
  if (id.length !== 44 && typeof Logger !== 'undefined') {
    Logger.log(
      `⚠️ Warning: Spreadsheet ID length is ${id.length} (expected 44). ` +
        'This may indicate a malformed ID.'
    );
  }
}

/**
 * GitHubトークンの形式検証（機密情報は検証しない）
 */
export function validateGitHubToken(token: string): void {
  if (!token || typeof token !== 'string') {
    throw new ValidationError('GitHub token is required and must be a string', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { tokenLength: token?.length },
    });
  }

  if (token.length < 10) {
    throw new ValidationError('GitHub token is too short', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { tokenLength: token.length },
    });
  }

  // トークン形式の簡易チェック（Classic PAT or Fine-grained PAT）
  const isClassicPAT = token.startsWith('ghp_');
  const isFineGrainedPAT = token.startsWith('github_pat_');

  if (!isClassicPAT && !isFineGrainedPAT) {
    // 警告のみ（古い形式のトークンも許可）
    if (typeof Logger !== 'undefined') {
      Logger.log(
        '⚠️ Warning: GitHub token does not match expected format. ' +
          "Classic PATs start with 'ghp_', Fine-grained PATs start with 'github_pat_'"
      );
    }
  }
}

/**
 * GitHub App IDの検証
 */
export function validateGitHubAppId(appId: string): void {
  if (!appId || typeof appId !== 'string') {
    throw new ValidationError('GitHub App ID is required and must be a string', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { appId },
    });
  }

  // App IDは数字のみ
  if (!/^\d+$/.test(appId)) {
    throw new ValidationError('GitHub App ID must be numeric', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { appId },
    });
  }

  if (appId.length < 1 || appId.length > 10) {
    throw new ValidationError('GitHub App ID length is invalid', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { appId, length: appId.length },
    });
  }
}

/**
 * GitHub Installation IDの検証
 */
export function validateGitHubInstallationId(installationId: string): void {
  if (!installationId || typeof installationId !== 'string') {
    throw new ValidationError('GitHub Installation ID is required and must be a string', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { installationId },
    });
  }

  // Installation IDは数字のみ
  if (!/^\d+$/.test(installationId)) {
    throw new ValidationError('GitHub Installation ID must be numeric', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { installationId },
    });
  }

  if (installationId.length < 1 || installationId.length > 12) {
    throw new ValidationError('GitHub Installation ID length is invalid', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { installationId, length: installationId.length },
    });
  }
}

/**
 * Private Keyの形式検証（内容は検証しない）
 */
export function validatePrivateKey(privateKey: string): void {
  if (!privateKey || typeof privateKey !== 'string') {
    throw new ValidationError('Private Key is required and must be a string', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { keyLength: privateKey?.length },
    });
  }

  // PEM形式のヘッダー/フッターチェック
  const hasValidHeader =
    privateKey.includes('-----BEGIN RSA PRIVATE KEY-----') ||
    privateKey.includes('-----BEGIN PRIVATE KEY-----');
  const hasValidFooter =
    privateKey.includes('-----END RSA PRIVATE KEY-----') ||
    privateKey.includes('-----END PRIVATE KEY-----');

  if (!hasValidHeader || !hasValidFooter) {
    throw new ValidationError(
      'Private Key must be in PEM format with BEGIN/END markers. ' +
        'Make sure to replace newlines with \\n when setting the key.',
      {
        code: ErrorCode.VALIDATION_FAILED,
        context: { hasValidHeader, hasValidFooter },
      }
    );
  }

  // 最小長チェック（実際のキーは数千文字）
  if (privateKey.length < 100) {
    throw new ValidationError('Private Key is too short to be valid', {
      code: ErrorCode.VALIDATION_FAILED,
      context: { keyLength: privateKey.length },
    });
  }
}
