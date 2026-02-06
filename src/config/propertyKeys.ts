/**
 * Google Apps Script プロパティストアで使用する設定キー定数
 *
 * このファイルで全ての設定キーを一元管理することで:
 * - タイポによるバグを防止
 * - 型安全性を確保
 * - リファクタリングを容易化
 * - IDEの補完機能を活用
 */

/**
 * GitHub認証関連の設定キー
 */
export const GITHUB_AUTH_KEYS = {
  /** GitHub Personal Access Token */
  TOKEN: 'GITHUB_TOKEN',
  /** GitHub App ID */
  APP_ID: 'GITHUB_APP_ID',
  /** GitHub App Private Key */
  APP_PRIVATE_KEY: 'GITHUB_APP_PRIVATE_KEY',
  /** GitHub App Installation ID */
  APP_INSTALLATION_ID: 'GITHUB_APP_INSTALLATION_ID',
  /** 認証モード（'pat' | 'app'） */
  AUTH_MODE: 'GITHUB_AUTH_MODE',
} as const;

/**
 * GitHub API設定キー
 */
export const GITHUB_API_KEYS = {
  /** APIモード（'rest' | 'graphql'） */
  API_MODE: 'GITHUB_API_MODE',
  /** 監視対象リポジトリ一覧（JSON配列） */
  REPOSITORIES: 'GITHUB_REPOSITORIES',
} as const;

/**
 * Google Spreadsheet設定キー
 */
export const SPREADSHEET_KEYS = {
  /** デフォルトスプレッドシートID */
  ID: 'SPREADSHEET_ID',
  /** プロジェクトグループ設定（JSON配列） */
  PROJECT_GROUPS: 'PROJECT_GROUPS',
} as const;

/**
 * Production判定設定キー
 */
export const PRODUCTION_KEYS = {
  /** Productionブランチパターン（正規表現文字列） */
  BRANCH_PATTERN: 'PRODUCTION_BRANCH_PATTERN',
} as const;

/**
 * ラベル設定キー
 */
export const LABEL_KEYS = {
  /** サイクルタイム計測対象のIssueラベル（JSON配列） */
  CYCLE_TIME: 'CYCLE_TIME_ISSUE_LABELS',
  /** コーディングタイム計測対象のIssueラベル（JSON配列） */
  CODING_TIME: 'CODING_TIME_ISSUE_LABELS',
  /** 計測から除外するラベル（JSON配列） */
  EXCLUDE_METRICS: 'EXCLUDE_METRICS_LABELS',
  /** インシデント判定ラベル（JSON配列） */
  INCIDENT: 'INCIDENT_LABELS',
} as const;

/**
 * サイクルタイム計測設定キー
 */
export const CYCLE_TIME_KEYS = {
  /** 開始トリガーイベント（カンマ区切り） */
  START_EVENTS: 'CYCLE_TIME_START_EVENTS',
  /** 終了トリガーイベント（カンマ区切り） */
  END_EVENTS: 'CYCLE_TIME_END_EVENTS',
} as const;

/**
 * コーディング時間計測設定キー
 */
export const CODING_TIME_KEYS = {
  /** 開始トリガーイベント（カンマ区切り） */
  START_EVENTS: 'CODING_TIME_START_EVENTS',
  /** 終了トリガーイベント（カンマ区切り） */
  END_EVENTS: 'CODING_TIME_END_EVENTS',
} as const;

/**
 * Slack通知設定キー
 */
export const SLACK_KEYS = {
  /** Slack Incoming Webhook URL */
  WEBHOOK_URL: 'SLACK_WEBHOOK_URL',
} as const;

/**
 * PRサイズ設定キー
 */
export const PR_SIZE_KEYS = {
  /** PRサイズ計算から除外するbaseブランチ（JSON配列） */
  EXCLUDE_BASE_BRANCHES: 'PR_SIZE_EXCLUDE_BASE_BRANCHES',
} as const;

/**
 * レビュー効率設定キー
 */
export const REVIEW_EFFICIENCY_KEYS = {
  /** レビュー効率計算から除外するbaseブランチ（JSON配列） */
  EXCLUDE_BASE_BRANCHES: 'REVIEW_EFFICIENCY_EXCLUDE_BASE_BRANCHES',
} as const;

/**
 * サイクルタイム除外設定キー
 */
export const CYCLE_TIME_EXCLUDE_KEYS = {
  /** サイクルタイム計算から除外するbaseブランチ（JSON配列） */
  EXCLUDE_BASE_BRANCHES: 'CYCLE_TIME_EXCLUDE_BASE_BRANCHES',
} as const;

/**
 * コーディング時間除外設定キー
 */
export const CODING_TIME_EXCLUDE_KEYS = {
  /** コーディング時間計算から除外するbaseブランチ（JSON配列） */
  EXCLUDE_BASE_BRANCHES: 'CODING_TIME_EXCLUDE_BASE_BRANCHES',
} as const;

/**
 * 手戻り率除外設定キー
 */
export const REWORK_RATE_EXCLUDE_KEYS = {
  /** 手戻り率計算から除外するbaseブランチ（JSON配列） */
  EXCLUDE_BASE_BRANCHES: 'REWORK_RATE_EXCLUDE_BASE_BRANCHES',
} as const;

/**
 * 全ての設定キーを統合したオブジェクト
 */
export const CONFIG_KEYS = {
  GITHUB_AUTH: GITHUB_AUTH_KEYS,
  GITHUB_API: GITHUB_API_KEYS,
  SPREADSHEET: SPREADSHEET_KEYS,
  PRODUCTION: PRODUCTION_KEYS,
  LABEL: LABEL_KEYS,
  CYCLE_TIME: CYCLE_TIME_KEYS,
  CODING_TIME: CODING_TIME_KEYS,
  SLACK: SLACK_KEYS,
  PR_SIZE: PR_SIZE_KEYS,
  REVIEW_EFFICIENCY: REVIEW_EFFICIENCY_KEYS,
  CYCLE_TIME_EXCLUDE: CYCLE_TIME_EXCLUDE_KEYS,
  CODING_TIME_EXCLUDE: CODING_TIME_EXCLUDE_KEYS,
  REWORK_RATE_EXCLUDE: REWORK_RATE_EXCLUDE_KEYS,
} as const;

/**
 * 全ての設定キーの型（値の型を取得）
 */
export type ConfigKey = typeof CONFIG_KEYS;
export type ConfigKeyValue =
  | (typeof GITHUB_AUTH_KEYS)[keyof typeof GITHUB_AUTH_KEYS]
  | (typeof GITHUB_API_KEYS)[keyof typeof GITHUB_API_KEYS]
  | (typeof SPREADSHEET_KEYS)[keyof typeof SPREADSHEET_KEYS]
  | (typeof PRODUCTION_KEYS)[keyof typeof PRODUCTION_KEYS]
  | (typeof LABEL_KEYS)[keyof typeof LABEL_KEYS]
  | (typeof CYCLE_TIME_KEYS)[keyof typeof CYCLE_TIME_KEYS]
  | (typeof CODING_TIME_KEYS)[keyof typeof CODING_TIME_KEYS]
  | (typeof SLACK_KEYS)[keyof typeof SLACK_KEYS]
  | (typeof PR_SIZE_KEYS)[keyof typeof PR_SIZE_KEYS]
  | (typeof REVIEW_EFFICIENCY_KEYS)[keyof typeof REVIEW_EFFICIENCY_KEYS]
  | (typeof CYCLE_TIME_EXCLUDE_KEYS)[keyof typeof CYCLE_TIME_EXCLUDE_KEYS]
  | (typeof CODING_TIME_EXCLUDE_KEYS)[keyof typeof CODING_TIME_EXCLUDE_KEYS]
  | (typeof REWORK_RATE_EXCLUDE_KEYS)[keyof typeof REWORK_RATE_EXCLUDE_KEYS];
