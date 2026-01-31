/**
 * GitHub REST API 基盤モジュール
 *
 * GitHub APIへのHTTPリクエストを行う低レベル関数を提供。
 * 認証ヘッダーの付与、エラーハンドリング、ページネーションの基盤となる。
 */

import type { ApiResponse } from "../../types";
import { getContainer } from "../../container";

// =============================================================================
// 定数
// =============================================================================

/** GitHub API のベースURL */
export const GITHUB_API_BASE = "https://api.github.com";

/** ページネーションのデフォルト最大ページ数 */
export const DEFAULT_MAX_PAGES = 5;

/** 1ページあたりの取得件数（GitHub API最大値） */
export const PER_PAGE = 100;

/** ステータス取得時の警告閾値（この件数を超えると警告ログ） */
export const STATUS_FETCH_WARNING_THRESHOLD = 50;

// =============================================================================
// 型定義
// =============================================================================

/**
 * 期間フィルタ
 */
export interface DateRange {
  /** 開始日（この日以降を取得） */
  since?: Date;
  /** 終了日（この日以前を取得） */
  until?: Date;
}

/**
 * Issue取得用の日付範囲（文字列形式）
 */
export interface IssueDateRange {
  /** 開始日（YYYY-MM-DD形式） */
  start?: string;
  /** 終了日（YYYY-MM-DD形式） */
  end?: string;
}

// =============================================================================
// API呼び出し基盤
// =============================================================================

/**
 * GitHub REST APIを呼び出すヘルパー関数
 *
 * @param endpoint - APIエンドポイント（例: "/repos/owner/repo/pulls"）
 * @param token - GitHub Personal Access Token
 * @returns APIレスポンス
 */
export function fetchGitHub<T>(endpoint: string, token: string): ApiResponse<T> {
  const { httpClient } = getContainer();
  const url = `${GITHUB_API_BASE}${endpoint}`;

  try {
    const response = httpClient.fetch<T>(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "DevSyncGAS",
      },
      muteHttpExceptions: true,
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return { success: true, data: response.data };
    }
    return {
      success: false,
      error: `GitHub API error: ${response.statusCode} - ${response.content}`,
    };
  } catch (error) {
    return { success: false, error: `Request failed: ${error}` };
  }
}
