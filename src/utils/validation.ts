/**
 * 入力検証ユーティリティ
 * セキュリティ: XSS、インジェクション攻撃を防ぐための検証機能
 */

/**
 * GitHubリポジトリオーナー名の検証
 * 許可: 英数字、ハイフン、アンダースコア（1-39文字）
 */
export function validateRepositoryOwner(owner: string): void {
  if (!owner || typeof owner !== 'string') {
    throw new Error('Repository owner is required and must be a string');
  }

  if (owner.length < 1 || owner.length > 39) {
    throw new Error('Repository owner must be between 1 and 39 characters');
  }

  // GitHub username/organization name rules
  if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(owner)) {
    throw new Error(
      'Repository owner must contain only alphanumeric characters or hyphens, ' +
        'cannot start or end with a hyphen, and must be 1-39 characters'
    );
  }
}

/**
 * GitHubリポジトリ名の検証
 * 許可: 英数字、ハイフン、アンダースコア、ピリオド（1-100文字）
 */
export function validateRepositoryName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Repository name is required and must be a string');
  }

  if (name.length < 1 || name.length > 100) {
    throw new Error('Repository name must be between 1 and 100 characters');
  }

  // GitHub repository name rules
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error(
      'Repository name must contain only alphanumeric characters, ' +
        'hyphens, underscores, or periods'
    );
  }

  // 危険なパターンを拒否
  const dangerousPatterns = ['../', '.\\', '<', '>', '"', "'", '`'];
  for (const pattern of dangerousPatterns) {
    if (name.includes(pattern)) {
      throw new Error(`Repository name contains invalid characters: ${pattern}`);
    }
  }
}

/**
 * プロジェクト名の検証
 * 許可: 英数字、スペース、ハイフン、アンダースコア（1-100文字）
 */
export function validateProjectName(name: string): void {
  if (!name || typeof name !== 'string') {
    throw new Error('Project name is required and must be a string');
  }

  if (name.length < 1 || name.length > 100) {
    throw new Error('Project name must be between 1 and 100 characters');
  }

  // プロジェクト名: 英数字、スペース、ハイフン、アンダースコアのみ
  if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
    throw new Error(
      'Project name must contain only alphanumeric characters, spaces, hyphens, or underscores'
    );
  }
}

/**
 * スプレッドシートIDの検証
 * Google Spreadsheet ID format: 44文字の英数字、ハイフン、アンダースコア
 */
export function validateSpreadsheetId(id: string): void {
  if (!id || typeof id !== 'string') {
    throw new Error('Spreadsheet ID is required and must be a string');
  }

  // Google Spreadsheet IDは通常44文字
  if (id.length < 20 || id.length > 100) {
    throw new Error('Spreadsheet ID format is invalid (expected 20-100 characters)');
  }

  // 英数字、ハイフン、アンダースコアのみ
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error(
      'Spreadsheet ID must contain only alphanumeric characters, hyphens, or underscores'
    );
  }
}

/**
 * GitHubトークンの形式検証（機密情報は検証しない）
 */
export function validateGitHubToken(token: string): void {
  if (!token || typeof token !== 'string') {
    throw new Error('GitHub token is required and must be a string');
  }

  if (token.length < 10) {
    throw new Error('GitHub token is too short');
  }

  // トークン形式の簡易チェック（Classic PAT or Fine-grained PAT）
  const isClassicPAT = token.startsWith('ghp_');
  const isFineGrainedPAT = token.startsWith('github_pat_');

  if (!isClassicPAT && !isFineGrainedPAT) {
    // 警告のみ（古い形式のトークンも許可）
    // Logger.log は GAS環境でのみ利用可能
    if (typeof Logger !== 'undefined') {
      Logger.log(
        'Warning: GitHub token does not match expected format. ' +
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
    throw new Error('GitHub App ID is required and must be a string');
  }

  // App IDは数字のみ
  if (!/^\d+$/.test(appId)) {
    throw new Error('GitHub App ID must be numeric');
  }

  if (appId.length < 1 || appId.length > 10) {
    throw new Error('GitHub App ID length is invalid');
  }
}

/**
 * GitHub Installation IDの検証
 */
export function validateGitHubInstallationId(installationId: string): void {
  if (!installationId || typeof installationId !== 'string') {
    throw new Error('GitHub Installation ID is required and must be a string');
  }

  // Installation IDは数字のみ
  if (!/^\d+$/.test(installationId)) {
    throw new Error('GitHub Installation ID must be numeric');
  }

  if (installationId.length < 1 || installationId.length > 12) {
    throw new Error('GitHub Installation ID length is invalid');
  }
}

/**
 * Private Keyの形式検証（内容は検証しない）
 */
export function validatePrivateKey(privateKey: string): void {
  if (!privateKey || typeof privateKey !== 'string') {
    throw new Error('Private Key is required and must be a string');
  }

  // PEM形式のヘッダー/フッターチェック
  const hasValidHeader =
    privateKey.includes('-----BEGIN RSA PRIVATE KEY-----') ||
    privateKey.includes('-----BEGIN PRIVATE KEY-----');
  const hasValidFooter =
    privateKey.includes('-----END RSA PRIVATE KEY-----') ||
    privateKey.includes('-----END PRIVATE KEY-----');

  if (!hasValidHeader || !hasValidFooter) {
    throw new Error(
      'Private Key must be in PEM format with BEGIN/END markers. ' +
        'Make sure to replace newlines with \\n when setting the key.'
    );
  }

  // 最小長チェック（実際のキーは数千文字）
  if (privateKey.length < 100) {
    throw new Error('Private Key is too short to be valid');
  }
}
