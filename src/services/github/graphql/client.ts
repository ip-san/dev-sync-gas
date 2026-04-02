/**
 * GitHub GraphQL API クライアント
 *
 * REST APIよりも効率的なデータ取得を実現。
 * - 1リクエストで複数のデータを取得
 * - レート制限: 5,000ポイント/時間（REST: 5,000リクエスト/時間）
 * - ネストしたデータを1回のリクエストで取得可能
 */

import { DEFAULT_PAGE_SIZE, MAX_RETRIES, RETRY_DELAY_MS } from '../../../config/apiConfig';
import { getContainer } from '../../../container';
import type { HttpRequestOptions } from '../../../interfaces';
import type { ApiResponse } from '../../../types';

// =============================================================================
// 定数
// =============================================================================

/** GitHub GraphQL API エンドポイント */
export const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';

// ページサイズ・リトライ設定は apiConfig.ts からインポート
export { DEFAULT_PAGE_SIZE, MAX_RETRIES, RETRY_DELAY_MS };

// =============================================================================
// 型定義
// =============================================================================

/**
 * GraphQL エラー型
 */
export interface GraphQLError {
  message: string;
  type?: string;
  path?: string[];
  locations?: { line: number; column: number }[];
}

/**
 * GraphQL レスポンス型
 */
export interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: GraphQLError[];
}

/**
 * ページネーション情報
 */
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

/**
 * レート制限情報
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string;
  cost: number;
}

// =============================================================================
// GraphQL クライアント
// =============================================================================

/**
 * GraphQLリクエストオプションを構築
 */
function buildGraphQLRequestOptions(
  query: string,
  variables: Record<string, unknown>,
  token: string
): HttpRequestOptions {
  return {
    method: 'post',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DevSyncGAS',
    },
    payload: JSON.stringify({ query, variables }),
    muteHttpExceptions: true,
  };
}

/**
 * GraphQLエラーを処理
 */
function handleGraphQLErrors<T>(
  errors: GraphQLError[],
  data: T | null | undefined,
  logger: { log: (msg: string) => void }
): ApiResponse<T> {
  const errorMessages = errors.map((e) => e.message).join('; ');

  const rateLimitError = errors.find((e) => e.type === 'RATE_LIMITED');
  if (rateLimitError) {
    return {
      success: false,
      error: `Rate limited: ${rateLimitError.message}`,
    };
  }

  if (data) {
    logger.log(`⚠️ GraphQL partial error: ${errorMessages}`);
    return { success: true, data };
  }

  return {
    success: false,
    error: `GraphQL error: ${errorMessages}`,
  };
}

/**
 * GraphQL クエリを実行
 *
 * @param query - GraphQL クエリ文字列
 * @param variables - クエリ変数
 * @param token - GitHub Personal Access Token または Installation Token
 * @returns APIレスポンス
 */
export function executeGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string
): ApiResponse<T> {
  const { httpClient, logger } = getContainer();

  try {
    const options = buildGraphQLRequestOptions(query, variables, token);
    const response = httpClient.fetch<GraphQLResponse<T>>(GITHUB_GRAPHQL_ENDPOINT, options);

    if (response.statusCode !== 200) {
      return {
        success: false,
        error: `GraphQL HTTP error: ${response.statusCode}`,
      };
    }

    const result = response.data;

    if (!result) {
      return {
        success: false,
        error: 'Empty response from GraphQL API',
      };
    }

    if (result.errors && result.errors.length > 0) {
      return handleGraphQLErrors(result.errors, result.data, logger);
    }

    if (!result.data) {
      return {
        success: false,
        error: 'No data in GraphQL response',
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return {
      success: false,
      error: `GraphQL request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * リトライ付きでGraphQLクエリを実行
 *
 * @param query - GraphQL クエリ文字列
 * @param variables - クエリ変数
 * @param token - GitHub Token
 * @param maxRetries - 最大リトライ回数
 * @returns APIレスポンス
 */
function isNonRetryableError(error: string): boolean {
  return error.includes('NOT_FOUND') || error.includes('FORBIDDEN') || error.includes('401');
}

export function executeGraphQLWithRetry<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  maxRetries: number = MAX_RETRIES
): ApiResponse<T> {
  const { logger } = getContainer();
  let lastError = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      logger.log(`  🔄 Retry attempt ${attempt}/${maxRetries}...`);
      Utilities.sleep(RETRY_DELAY_MS * attempt);
    }

    const result = executeGraphQL<T>(query, variables, token);
    if (result.success) {
      return result;
    }

    lastError = result.error ?? 'Unknown error';

    if (lastError.includes('Rate limited')) {
      logger.log('  ⏳ Rate limited, waiting longer...');
      Utilities.sleep(RETRY_DELAY_MS * 10);
    }

    if (isNonRetryableError(lastError)) {
      return result;
    }
  }

  return {
    success: false,
    error: `Failed after ${maxRetries} retries: ${lastError}`,
  };
}

/**
 * レート制限情報を取得
 */
export function getRateLimitInfo(token: string): ApiResponse<RateLimitInfo> {
  const query = `
    query {
      rateLimit {
        limit
        remaining
        resetAt
        cost
      }
    }
  `;

  const result = executeGraphQL<{ rateLimit: RateLimitInfo }>(query, {}, token);

  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  return { success: true, data: result.data.rateLimit };
}
