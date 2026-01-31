/**
 * 設定関連の型定義
 *
 * GitHub認証設定、プロジェクトグループ、アプリケーション設定の型定義。
 */

import type { GitHubRepository } from "./github";

// =============================================================================
// GitHub Apps認証
// =============================================================================

/**
 * GitHub Apps設定
 */
export interface GitHubAppConfig {
  /** GitHub App ID */
  appId: string;
  /** GitHub App Private Key（PEM形式） */
  privateKey: string;
  /** Installation ID */
  installationId: string;
}

/**
 * GitHub認証設定
 * - PAT認証: tokenのみ設定
 * - GitHub Apps認証: appConfigを設定（tokenは自動取得される）
 */
export interface GitHubAuthConfig {
  /** Personal Access Token（PAT認証時に使用） */
  token?: string;
  /** GitHub Apps設定（Apps認証時に使用） */
  appConfig?: GitHubAppConfig;
  /** リポジトリ一覧（後方互換性のため維持、projectsが優先される） */
  repositories: GitHubRepository[];
}

// =============================================================================
// プロジェクトグループ
// =============================================================================

/**
 * プロジェクトグループ
 * スプレッドシートとリポジトリ群をグループ化
 */
export interface ProjectGroup {
  /** グループ名（識別用） */
  name: string;
  /** 出力先スプレッドシートID */
  spreadsheetId: string;
  /** シート名（デフォルト: "DevOps Metrics"） */
  sheetName: string;
  /** このグループに属するリポジトリ一覧 */
  repositories: GitHubRepository[];
}

// =============================================================================
// アプリケーション設定
// =============================================================================

/**
 * アプリケーション設定
 */
export interface Config {
  github: GitHubAuthConfig;
  /** 単一スプレッドシート設定（後方互換性のため維持） */
  spreadsheet: {
    id: string;
    sheetName: string;
  };
  /** プロジェクトグループ一覧（複数スプレッドシート対応） */
  projects?: ProjectGroup[];
}
