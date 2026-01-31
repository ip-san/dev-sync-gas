/**
 * API関連の型定義
 *
 * API呼び出しのレスポンス型を定義。
 */

/**
 * APIレスポンスの共通型
 * 成功時はdata、失敗時はerrorを含む
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
