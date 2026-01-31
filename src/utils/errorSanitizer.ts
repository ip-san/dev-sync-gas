/**
 * エラーレスポンスのサニタイズ
 *
 * APIエラーレスポンスから機密情報を除去し、安全なエラーメッセージを生成する。
 */

// =============================================================================
// 定数
// =============================================================================

/** サニタイズする機密情報のパターン */
const SENSITIVE_PATTERNS = [
  /ghp_[a-zA-Z0-9]{36}/g, // GitHub Personal Access Token
  /ghs_[a-zA-Z0-9]{36}/g, // GitHub OAuth Secret
  /github_pat_[a-zA-Z0-9_]{82}/g, // GitHub Fine-grained PAT
  /gho_[a-zA-Z0-9]{36}/g, // GitHub OAuth Token
  /ghu_[a-zA-Z0-9]{36}/g, // GitHub User Token
  /Bearer\s+[a-zA-Z0-9_\-.]+/gi, // Bearer トークン
  /Authorization:\s*[^\s]+/gi, // Authorization ヘッダー
  /"token":\s*"[^"]+"/gi, // JSON内のトークン
  /"password":\s*"[^"]+"/gi, // JSON内のパスワード
  /"secret":\s*"[^"]+"/gi, // JSON内のシークレット
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi, // 秘密鍵
];

/** HTTPステータスコードに対する安全なエラーメッセージ */
const SAFE_ERROR_MESSAGES: Record<number, string> = {
  400: 'Bad Request - Invalid parameters',
  401: 'Unauthorized - Authentication failed',
  403: 'Forbidden - Access denied or rate limit exceeded',
  404: 'Not Found - Resource does not exist',
  422: 'Unprocessable Entity - Validation failed',
  429: 'Rate Limit Exceeded - Too many requests',
  500: 'Internal Server Error - GitHub API error',
  502: 'Bad Gateway - GitHub API temporarily unavailable',
  503: 'Service Unavailable - GitHub API temporarily unavailable',
  504: 'Gateway Timeout - GitHub API request timed out',
};

// =============================================================================
// エラーサニタイズ関数
// =============================================================================

/**
 * 文字列から機密情報を除去する
 *
 * @param content - サニタイズ対象の文字列
 * @returns 機密情報を除去した文字列
 */
export function sanitizeSensitiveData(content: string): string {
  let sanitized = content;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  return sanitized;
}

/**
 * HTTPステータスコードから安全なエラーメッセージを生成
 *
 * @param statusCode - HTTPステータスコード
 * @param rawError - 元のエラーメッセージ（オプション、デバッグ用）
 * @returns 安全なエラーメッセージ
 */
export function sanitizeHttpError(statusCode: number, rawError?: string): string {
  const safeMessage = SAFE_ERROR_MESSAGES[statusCode] || `HTTP ${statusCode} - Request failed`;

  // デバッグ情報があれば、サニタイズして詳細ログに記録（本番では返さない）
  // Note: GASログはユーザーに見えるため、詳細情報は返さない
  // ログ出力が必要な場合は呼び出し側でLoggerを使用すること
  // rawError は将来のデバッグ用に保持するが、現在は使用しない
  void rawError;

  return safeMessage;
}

/**
 * エラーオブジェクトから安全なエラーメッセージを抽出
 *
 * @param error - Errorオブジェクトまたは任意の値
 * @returns 安全なエラーメッセージ
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeSensitiveData(error.message);
  }

  if (typeof error === 'string') {
    return sanitizeSensitiveData(error);
  }

  return 'Unknown error occurred';
}

/**
 * GitHub API エラーレスポンスをサニタイズ
 *
 * @param statusCode - HTTPステータスコード
 * @param responseBody - レスポンスボディ（JSON文字列またはオブジェクト）
 * @returns 安全なエラーメッセージ
 */
export function sanitizeGitHubError(statusCode: number, responseBody?: unknown): string {
  const baseMessage = sanitizeHttpError(statusCode);

  // レスポンスボディがある場合、GitHub APIエラーの詳細を抽出（サニタイズ済み）
  if (responseBody && typeof responseBody === 'object') {
    const body = responseBody as Record<string, unknown>;

    // GitHub APIは "message" フィールドにエラー詳細を含むことがある
    if (body.message && typeof body.message === 'string') {
      const sanitizedMessage = sanitizeSensitiveData(body.message);
      // 機密情報が含まれていない一般的なエラーメッセージのみ追加
      if (!sanitizedMessage.includes('[REDACTED]')) {
        return `${baseMessage}: ${sanitizedMessage}`;
      }
    }
  }

  return baseMessage;
}
