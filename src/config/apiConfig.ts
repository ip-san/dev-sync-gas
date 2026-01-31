/**
 * API関連の設定定数
 *
 * GitHub API呼び出しに関する設定値を集約。
 * これらの値は環境や要件に応じて調整可能。
 */

// =============================================================================
// ページネーション設定
// =============================================================================

/**
 * ページネーションのデフォルト最大ページ数
 *
 * 理由: GitHub APIは1リクエストで最大100件まで取得可能。
 * 5ページで500件取得できるため、ほとんどのリポジトリで十分。
 * 大規模リポジトリでは関数呼び出し時に個別に指定可能。
 */
export const DEFAULT_MAX_PAGES = 5;

/**
 * 1ページあたりの取得件数（GitHub API最大値）
 *
 * GitHub APIの最大値は100件。
 * これ以上に設定しても無視されるため、常に100を使用。
 */
export const PER_PAGE = 100;

/**
 * GraphQL API のデフォルトページサイズ
 *
 * GraphQL でも REST と同じく100件が推奨値。
 */
export const DEFAULT_PAGE_SIZE = 100;

/**
 * GraphQL バッチ処理のデフォルトサイズ
 *
 * 理由: 10件ずつまとめることでレート制限を効率的に使用。
 * GitHub GraphQL API の複雑度制限を考慮した安全な値。
 * より多くのPRを一度に取得したい場合は20まで増やせるが、
 * エラー時のリトライコストとのバランスを取って10を推奨。
 */
export const DEFAULT_BATCH_SIZE = 10;

/**
 * PR チェーン追跡の最大深度
 *
 * 理由: feature → staging → main のような3段階が一般的。
 * 5段階まで許容することで複雑なブランチ戦略にも対応。
 * これ以上深いチェーンは稀であり、無限ループ防止のため制限。
 */
export const MAX_PR_CHAIN_DEPTH = 5;

// =============================================================================
// リトライ設定
// =============================================================================

/**
 * API リトライの最大回数
 *
 * 理由: 一時的なネットワークエラーや GitHub API の瞬間的な障害に対応。
 * 3回リトライすれば、ほとんどの一時的な問題は解決する。
 * それ以上は時間の無駄になる可能性が高い。
 */
export const MAX_RETRIES = 3;

/**
 * リトライ時の初期遅延（ミリ秒）
 *
 * 理由: 1秒待つことで、GitHub API の一時的な負荷が解消される可能性が高い。
 * Exponential backoff により、2回目は2秒、3回目は4秒となる。
 */
export const RETRY_DELAY_MS = 1000;

/**
 * Exponential backoff の初期遅延（ミリ秒）
 *
 * HTTPクライアントのリトライで使用。
 */
export const INITIAL_BACKOFF_MS = 1000;

// =============================================================================
// 警告・しきい値設定
// =============================================================================

/**
 * ステータス取得時の警告閾値
 *
 * 理由: GitHub API の `statuses` エンドポイントは、
 * コミットに対するステータスチェックが多数ある場合に大量のデータを返す。
 * 50件を超える場合はログに警告を出力し、パフォーマンス問題を可視化。
 */
export const STATUS_FETCH_WARNING_THRESHOLD = 50;

/**
 * Lead Time とデプロイメントのマッチング許容時間（時間）
 *
 * 理由: PR のマージ時刻とデプロイメント時刻は完全に一致しないことが多い。
 * CI/CDパイプラインの実行時間を考慮し、24時間以内のデプロイメントを
 * 同じリリースとみなす。
 *
 * 調整ガイド:
 * - 高頻度デプロイ（1日複数回）: 6〜12時間
 * - 通常のデプロイ（1日1回）: 24時間（デフォルト）
 * - 低頻度デプロイ（週1回以下）: 48〜72時間
 */
export const LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS = 24;

// =============================================================================
// 拡張指標シート名
// =============================================================================

/**
 * 拡張指標のシート名
 *
 * これらはスプレッドシートのシート名として使用される。
 * 日本語名を使用しているが、必要に応じて英語名に変更可能。
 */
export const SHEET_NAMES = {
  CYCLE_TIME: 'サイクルタイム',
  CODING_TIME: 'コーディング時間',
  REWORK_RATE: '手戻り率',
  REVIEW_EFFICIENCY: 'レビュー効率',
  PR_SIZE: 'PRサイズ',
  DASHBOARD: 'Dashboard',
  DASHBOARD_TREND: 'Dashboard - Trend',
  DEVOPS_SUMMARY: 'DevOps Summary',
} as const;

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * カスタム設定値を取得（環境変数や Properties から読み取る想定）
 *
 * 将来的には PropertiesService から設定を読み取る機能を追加可能。
 * 現在はデフォルト値を返すのみ。
 */
export function getApiConfig(): {
  maxPages: number;
  perPage: number;
  pageSize: number;
  batchSize: number;
  maxPRChainDepth: number;
  maxRetries: number;
  retryDelayMs: number;
  leadTimeMatchThresholdHours: number;
} {
  return {
    maxPages: DEFAULT_MAX_PAGES,
    perPage: PER_PAGE,
    pageSize: DEFAULT_PAGE_SIZE,
    batchSize: DEFAULT_BATCH_SIZE,
    maxPRChainDepth: MAX_PR_CHAIN_DEPTH,
    maxRetries: MAX_RETRIES,
    retryDelayMs: RETRY_DELAY_MS,
    leadTimeMatchThresholdHours: LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS,
  };
}
