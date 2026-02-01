/**
 * カスタムエラークラス
 *
 * アプリケーション全体で統一されたエラーハンドリングを提供します。
 */

/**
 * エラーコード定義
 */
export const ErrorCode = {
  // GitHub API関連 (1000番台)
  GITHUB_AUTH_FAILED: 'GITHUB_AUTH_FAILED',
  GITHUB_RATE_LIMIT: 'GITHUB_RATE_LIMIT',
  GITHUB_NOT_FOUND: 'GITHUB_NOT_FOUND',
  GITHUB_FORBIDDEN: 'GITHUB_FORBIDDEN',
  GITHUB_SERVER_ERROR: 'GITHUB_SERVER_ERROR',
  GITHUB_INVALID_RESPONSE: 'GITHUB_INVALID_RESPONSE',

  // 検証エラー (2000番台)
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_REPOSITORY: 'INVALID_REPOSITORY',
  INVALID_SPREADSHEET_ID: 'INVALID_SPREADSHEET_ID',
  INVALID_CONFIG: 'INVALID_CONFIG',

  // 設定エラー (3000番台)
  CONFIG_NOT_INITIALIZED: 'CONFIG_NOT_INITIALIZED',
  CONFIG_MISSING_TOKEN: 'CONFIG_MISSING_TOKEN',
  CONFIG_MISSING_SPREADSHEET: 'CONFIG_MISSING_SPREADSHEET',
  CONFIG_INVALID_PROJECT: 'CONFIG_INVALID_PROJECT',

  // Secret Manager関連 (4000番台)
  SECRET_MANAGER_NOT_CONFIGURED: 'SECRET_MANAGER_NOT_CONFIGURED',
  SECRET_MANAGER_ACCESS_FAILED: 'SECRET_MANAGER_ACCESS_FAILED',
  SECRET_NOT_FOUND: 'SECRET_NOT_FOUND',
  SECRET_MANAGER_INVALID_VALUE: 'SECRET_MANAGER_INVALID_VALUE',

  // スプレッドシート関連 (5000番台)
  SPREADSHEET_ACCESS_DENIED: 'SPREADSHEET_ACCESS_DENIED',
  SPREADSHEET_NOT_FOUND: 'SPREADSHEET_NOT_FOUND',
  SHEET_NOT_FOUND: 'SHEET_NOT_FOUND',
  SHEET_CREATION_FAILED: 'SHEET_CREATION_FAILED',
  SPREADSHEET_WRITE_FAILED: 'SPREADSHEET_WRITE_FAILED',
  SPREADSHEET_READ_FAILED: 'SPREADSHEET_READ_FAILED',
  SPREADSHEET_FORMAT_ERROR: 'SPREADSHEET_FORMAT_ERROR',

  // その他 (9000番台)
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  CONTAINER_NOT_INITIALIZED: 'CONTAINER_NOT_INITIALIZED',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * エラーの基底クラス
 */
export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly isRetryable: boolean;
  public readonly statusCode?: number;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCodeType,
    options?: {
      isRetryable?: boolean;
      statusCode?: number;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.isRetryable = options?.isRetryable ?? false;
    this.statusCode = options?.statusCode;
    this.context = options?.context;

    // Error.captureStackTrace を使用してスタックトレースを適切に設定
    // Node.js環境でのみ利用可能
    const ErrorConstructor = Error as {
      captureStackTrace?: (target: object, constructor: object) => void;
    };
    if (typeof ErrorConstructor.captureStackTrace === 'function') {
      ErrorConstructor.captureStackTrace(this, this.constructor);
    }

    // causeがある場合は保存（ES2022のError.cause互換）
    if (options?.cause) {
      (this as unknown as { cause: Error }).cause = options.cause;
    }
  }
}

/**
 * GitHub API関連のエラー
 */
export class GitHubAPIError extends AppError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCodeType;
      statusCode?: number;
      isRetryable?: boolean;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    const code = options?.code ?? ErrorCode.GITHUB_SERVER_ERROR;
    const isRetryable = options?.isRetryable ?? isRetryableStatusCode(options?.statusCode);

    super(message, code, {
      ...options,
      isRetryable,
    });
  }

  /**
   * HTTPステータスコードからGitHubAPIErrorを生成
   */
  static fromStatusCode(
    statusCode: number,
    message?: string,
    context?: Record<string, unknown>
  ): GitHubAPIError {
    const errorInfo = getErrorInfoFromStatusCode(statusCode);

    return new GitHubAPIError(message ?? errorInfo.message, {
      code: errorInfo.code,
      statusCode,
      isRetryable: errorInfo.isRetryable,
      context,
    });
  }
}

/**
 * 検証エラー
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCodeType;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, options?.code ?? ErrorCode.VALIDATION_FAILED, {
      ...options,
      isRetryable: false, // 検証エラーは基本的にリトライ不可
    });
  }
}

/**
 * 設定エラー
 */
export class ConfigurationError extends AppError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCodeType;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, options?.code ?? ErrorCode.CONFIG_NOT_INITIALIZED, {
      ...options,
      isRetryable: false, // 設定エラーは基本的にリトライ不可
    });
  }
}

/**
 * Secret Manager関連のエラー
 */
export class SecretManagerError extends AppError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCodeType;
      isRetryable?: boolean;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, options?.code ?? ErrorCode.SECRET_MANAGER_ACCESS_FAILED, {
      ...options,
      isRetryable: options?.isRetryable ?? false,
    });
  }
}

/**
 * スプレッドシート関連のエラー
 */
export class SpreadsheetError extends AppError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCodeType;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, options?.code ?? ErrorCode.SPREADSHEET_ACCESS_DENIED, {
      ...options,
      isRetryable: false, // スプレッドシートエラーは基本的にリトライ不可
    });
  }
}

/**
 * HTTPステータスコードがリトライ可能かチェック
 */
function isRetryableStatusCode(statusCode?: number): boolean {
  if (!statusCode) {
    return false;
  }

  // 429 (Rate Limit), 500番台はリトライ可能
  return statusCode === 429 || (statusCode >= 500 && statusCode < 600);
}

/**
 * HTTPステータスコードからエラー情報を取得
 */
function getErrorInfoFromStatusCode(statusCode: number): {
  code: ErrorCodeType;
  message: string;
  isRetryable: boolean;
} {
  switch (statusCode) {
    case 401:
      return {
        code: ErrorCode.GITHUB_AUTH_FAILED,
        message: 'GitHub authentication failed',
        isRetryable: false,
      };
    case 403:
      return {
        code: ErrorCode.GITHUB_FORBIDDEN,
        message: 'GitHub API access forbidden (rate limit or permissions)',
        isRetryable: false,
      };
    case 404:
      return {
        code: ErrorCode.GITHUB_NOT_FOUND,
        message: 'GitHub resource not found',
        isRetryable: false,
      };
    case 429:
      return {
        code: ErrorCode.GITHUB_RATE_LIMIT,
        message: 'GitHub API rate limit exceeded',
        isRetryable: true,
      };
    case 500:
    case 502:
    case 503:
    case 504:
      return {
        code: ErrorCode.GITHUB_SERVER_ERROR,
        message: 'GitHub server error',
        isRetryable: true,
      };
    default:
      return {
        code: ErrorCode.GITHUB_INVALID_RESPONSE,
        message: `Unexpected GitHub API response: ${statusCode}`,
        isRetryable: false,
      };
  }
}

/**
 * エラーがリトライ可能かチェック
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isRetryable;
  }
  return false;
}

/**
 * エラーコンテキストを含む安全なエラーメッセージを生成
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    let message = `[${error.code}] ${error.message}`;
    if (error.statusCode) {
      message += ` (HTTP ${error.statusCode})`;
    }
    return message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
