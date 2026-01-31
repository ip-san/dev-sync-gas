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
  /** 部分的な成功時の警告メッセージ（データは返すが完全ではない） */
  warning?: string;
  /** 部分的な成功時のメタデータ */
  metadata?: {
    /** 取得できたページ数 */
    pagesRetrieved?: number;
    /** 取得できなかったページ数 */
    pagesFailed?: number;
    /** 取得できたアイテム数 */
    itemsRetrieved?: number;
  };
}
