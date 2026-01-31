/**
 * GitHub GraphQL API クライアント
 *
 * REST APIよりも効率的なデータ取得を実現。
 * - 1リクエストで複数のデータを取得
 * - レート制限: 5,000ポイント/時間（REST: 5,000リクエスト/時間）
 * - ネストしたデータを1回のリクエストで取得可能
 */

import type { ApiResponse } from '../../../types';
import { getContainer } from '../../../container';

// =============================================================================
// 定数
// =============================================================================

/** GitHub GraphQL API エンドポイント */
export const GITHUB_GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';

/** デフォルトのページサイズ（GraphQL推奨値） */
export const DEFAULT_PAGE_SIZE = 100;

/** 最大リトライ回数 */
export const MAX_RETRIES = 3;

/** リトライ間隔（ミリ秒） */
export const RETRY_DELAY_MS = 1000;

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
    const response = httpClient.fetch<GraphQLResponse<T>>(GITHUB_GRAPHQL_ENDPOINT, {
      method: 'post',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DevSyncGAS',
      },
      payload: JSON.stringify({ query, variables }),
      muteHttpExceptions: true,
    });

    if (response.statusCode !== 200) {
      return {
        success: false,
        error: `GraphQL HTTP error: ${response.statusCode} - ${response.content}`,
      };
    }

    const result = response.data;

    if (!result) {
      return {
        success: false,
        error: 'Empty response from GraphQL API',
      };
    }

    // GraphQL エラーをチェック
    if (result.errors && result.errors.length > 0) {
      const errorMessages = result.errors.map((e) => e.message).join('; ');

      // RATE_LIMITED エラーの場合は特別処理
      const rateLimitError = result.errors.find((e) => e.type === 'RATE_LIMITED');
      if (rateLimitError) {
        return {
          success: false,
          error: `Rate limited: ${rateLimitError.message}`,
        };
      }

      // NOT_FOUND などの場合、部分的なデータが返る可能性がある
      if (result.data) {
        logger.log(`⚠️ GraphQL partial error: ${errorMessages}`);
        return { success: true, data: result.data };
      }

      return {
        success: false,
        error: `GraphQL error: ${errorMessages}`,
      };
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
      // GASではUtilities.sleepを使用
      Utilities.sleep(RETRY_DELAY_MS * attempt);
    }

    const result = executeGraphQL<T>(query, variables, token);

    if (result.success) {
      return result;
    }

    lastError = result.error ?? 'Unknown error';

    // レート制限エラーの場合は長めに待つ
    if (lastError.includes('Rate limited')) {
      logger.log('  ⏳ Rate limited, waiting longer...');
      Utilities.sleep(RETRY_DELAY_MS * 10);
    }

    // リトライ不可能なエラーの場合は即座に終了
    if (
      lastError.includes('NOT_FOUND') ||
      lastError.includes('FORBIDDEN') ||
      lastError.includes('401')
    ) {
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
