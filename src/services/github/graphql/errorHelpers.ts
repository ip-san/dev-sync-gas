/**
 * GraphQLエラーハンドリングのヘルパー関数
 *
 * GraphQLクエリの結果を検証し、エラーハンドリングを統一化
 */

import type { ApiResponse } from '../../../types/index.js';

/**
 * ページネーション中のGraphQLレスポンスを検証
 *
 * @param result - GraphQL実行結果
 * @param page - 現在のページ番号（0始まり）
 * @param dataPath - データへのパス（例: 'repository.issues'）
 * @returns エラーレスポンス（成功時はnull）
 */
export function validatePaginatedResponse(
  result: ApiResponse<unknown>,
  page: number,
  dataPath: string
): { success: false; error: string } | null {
  // 初回ページでエラーの場合は即座にエラーを返す
  if (!result.success) {
    if (page === 0) {
      return { success: false, error: result.error ?? 'Unknown error' };
    }
    return null; // 2ページ目以降はループ終了のシグナル
  }

  // データが存在するか確認
  const data = getNestedProperty(result.data, dataPath);
  if (!data) {
    if (page === 0) {
      return { success: false, error: `No data found at path: ${dataPath}` };
    }
    return null; // 2ページ目以降はループ終了のシグナル
  }

  return null; // 成功
}

/**
 * 初回GraphQLレスポンスを検証
 *
 * @param result - GraphQL実行結果
 * @param dataPath - データへのパス（例: 'repository.pullRequest'）
 * @returns エラーレスポンス（成功時はnull）
 */
export function validateSingleResponse(
  result: ApiResponse<unknown>,
  dataPath: string
): { success: false; error: string } | null {
  if (!result.success) {
    return { success: false, error: result.error ?? 'Unknown error' };
  }

  const data = getNestedProperty(result.data, dataPath);
  if (!data) {
    return { success: false, error: `No data found at path: ${dataPath}` };
  }

  return null; // 成功
}

/**
 * ネストしたプロパティを取得
 *
 * @param obj - オブジェクト
 * @param path - ドット区切りのパス（例: 'repository.issues'）
 * @returns プロパティ値（存在しない場合はundefined）
 */
function getNestedProperty(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * GraphQLページネーション結果の型ガード
 */
export interface PaginatedResult<T> {
  nodes: T[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

/**
 * ページネーション結果が空かチェック
 */
export function isPaginatedResultEmpty<T>(result: PaginatedResult<T>): boolean {
  return !result.nodes || result.nodes.length === 0;
}
