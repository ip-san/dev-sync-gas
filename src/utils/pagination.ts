import type { ApiResponse } from '../types';

/**
 * ページネーション設定
 */
export interface PaginationConfig {
  /** 最大ページ数 */
  maxPages: number;
  /** ページごとの取得件数 */
  perPage?: number;
}

/**
 * ページネーション処理のオプション
 */
export interface PaginationOptions<T, R> {
  /** APIエンドポイント取得関数（ページ番号を受け取る） */
  getEndpoint: (page: number) => string;
  /** API呼び出し関数 */
  fetchFn: (endpoint: string) => ApiResponse<T[]>;
  /** レスポンスを結果型に変換する関数 */
  transform: (item: T) => R;
  /** 結果をフィルタリングする関数（オプション） */
  filter?: (item: R) => boolean;
  /** ページネーション設定 */
  config: PaginationConfig;
}

/**
 * GitHubのページネーションAPIを処理する汎用関数
 *
 * @template T - APIレスポンスの型
 * @template R - 変換後の結果の型
 * @param options - ページネーション処理のオプション
 * @returns 全ページの結果を集約したレスポンス
 *
 * @example
 * ```typescript
 * const result = paginateAPI({
 *   getEndpoint: (page) => `/repos/owner/repo/pulls?page=${page}`,
 *   fetchFn: (endpoint) => fetchGitHub(endpoint, token),
 *   transform: (pr) => ({ id: pr.id, number: pr.number }),
 *   config: { maxPages: 5, perPage: 100 }
 * });
 * ```
 */
export function paginateAPI<T, R>(options: PaginationOptions<T, R>): ApiResponse<R[]> {
  const { getEndpoint, fetchFn, transform, filter, config } = options;
  const results: R[] = [];
  let page = 1;
  let pagesRetrieved = 0;
  let pagesFailed = 0;
  let partialFailureError: string | undefined;

  while (page <= config.maxPages) {
    const endpoint = getEndpoint(page);
    const response = fetchFn(endpoint);

    // エラーハンドリング: 1ページ目の失敗はエラーを返す
    if (!response.success || !response.data) {
      if (page === 1) {
        return { success: false, error: response.error };
      }
      // 2ページ目以降の失敗は現在までの結果を返す（警告付き）
      pagesFailed++;
      partialFailureError = response.error;
      break;
    }

    // 空レスポンスは終了
    if (response.data.length === 0) {
      break;
    }

    // データを変換して結果に追加
    for (const item of response.data) {
      const transformed = transform(item);
      if (!filter || filter(transformed)) {
        results.push(transformed);
      }
    }

    pagesRetrieved++;
    page++;
  }

  // 部分的な失敗があった場合は警告を含める
  if (pagesFailed > 0) {
    return {
      success: true,
      data: results,
      warning: `Partial failure: Retrieved ${pagesRetrieved} page(s), but ${pagesFailed} page(s) failed. Last error: ${partialFailureError}`,
      metadata: {
        pagesRetrieved,
        pagesFailed,
        itemsRetrieved: results.length,
      },
    };
  }

  return {
    success: true,
    data: results,
    metadata: {
      pagesRetrieved,
      pagesFailed: 0,
      itemsRetrieved: results.length,
    },
  };
}

/**
 * 単純な集計処理（カウント、合計など）を行うページネーション
 *
 * @template T - APIレスポンスの型
 * @param options - ページネーション処理のオプション
 * @param reducer - 各アイテムを集計値に変換する関数
 * @param initialValue - 集計の初期値
 * @returns 集計結果
 *
 * @example
 * ```typescript
 * // Force push回数をカウント
 * const result = paginateAndReduce(
 *   {
 *     getEndpoint: (page) => `/repos/owner/repo/issues/123/timeline?page=${page}`,
 *     fetchFn: (endpoint) => fetchGitHub(endpoint, token),
 *     transform: (event) => event,
 *     config: { maxPages: 5 }
 *   },
 *   (count, event) => event.event === 'head_ref_force_pushed' ? count + 1 : count,
 *   0
 * );
 * ```
 */
export function paginateAndReduce<T, R, A>(
  options: Omit<PaginationOptions<T, R>, 'filter'>,
  reducer: (accumulator: A, item: R) => A,
  initialValue: A
): ApiResponse<A> {
  const { getEndpoint, fetchFn, transform, config } = options;
  let accumulator = initialValue;
  let page = 1;
  let pagesRetrieved = 0;
  let pagesFailed = 0;
  let partialFailureError: string | undefined;

  while (page <= config.maxPages) {
    const endpoint = getEndpoint(page);
    const response = fetchFn(endpoint);

    if (!response.success || !response.data) {
      if (page === 1) {
        return { success: false, error: response.error };
      }
      // 2ページ目以降の失敗は現在までの結果を返す（警告付き）
      pagesFailed++;
      partialFailureError = response.error;
      break;
    }

    if (response.data.length === 0) {
      break;
    }

    for (const item of response.data) {
      const transformed = transform(item);
      accumulator = reducer(accumulator, transformed);
    }

    pagesRetrieved++;
    page++;
  }

  // 部分的な失敗があった場合は警告を含める
  if (pagesFailed > 0) {
    return {
      success: true,
      data: accumulator,
      warning: `Partial failure: Retrieved ${pagesRetrieved} page(s), but ${pagesFailed} page(s) failed. Last error: ${partialFailureError}`,
      metadata: {
        pagesRetrieved,
        pagesFailed,
      },
    };
  }

  return {
    success: true,
    data: accumulator,
    metadata: {
      pagesRetrieved,
      pagesFailed: 0,
    },
  };
}
