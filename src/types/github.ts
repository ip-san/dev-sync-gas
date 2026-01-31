/**
 * GitHub関連の型定義
 *
 * GitHub APIから取得するエンティティの型定義。
 * Repository, Pull Request, Deployment, Issue等を定義。
 */

/**
 * リポジトリ情報
 */
export interface GitHubRepository {
  owner: string;
  name: string;
  fullName: string;
}

/**
 * Pull Request情報
 */
export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  author: string;
  repository: string;
  /** 追加行数 */
  additions?: number;
  /** 削除行数 */
  deletions?: number;
  /** 変更ファイル数 */
  changedFiles?: number;
  /** ベースブランチ名（マージ先） */
  baseBranch?: string;
  /** ヘッドブランチ名（マージ元） */
  headBranch?: string;
  /** マージコミットSHA */
  mergeCommitSha?: string | null;
}

/**
 * デプロイメント情報
 */
export interface GitHubDeployment {
  id: number;
  sha: string;
  environment: string;
  createdAt: string;
  updatedAt: string;
  status: "success" | "failure" | "error" | "inactive" | "in_progress" | "queued" | "pending" | null;
  repository: string;
}

/**
 * ワークフロー実行情報
 */
export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  repository: string;
}

/**
 * GitHub Issueベースのインシデント記録
 * MTTR（真の復旧時間）計測に使用
 */
export interface GitHubIncident {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
  /** インシデントに付与されたラベル一覧 */
  labels: string[];
  repository: string;
}

/**
 * GitHub Issue（サイクルタイム計測用）
 * Issue作成日を着手日として使用
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
  /** Issueに付与されたラベル一覧 */
  labels: string[];
  repository: string;
}

/**
 * PRチェーンの各アイテム
 * feature→main→staging→production の追跡に使用
 */
export interface PRChainItem {
  prNumber: number;
  baseBranch: string;
  headBranch: string;
  mergedAt: string | null;
}

/**
 * Issue→productionマージのサイクルタイムデータ
 */
export interface IssueCycleTime {
  issueNumber: number;
  issueTitle: string;
  repository: string;
  /** Issue作成日時（着手日） */
  issueCreatedAt: string;
  /** productionブランチへのマージ日時（完了日） */
  productionMergedAt: string | null;
  /** サイクルタイム（時間）- productionマージがない場合はnull */
  cycleTimeHours: number | null;
  /** 追跡されたPRチェーン */
  prChain: PRChainItem[];
}

/**
 * Issue→PR作成のコーディングタイムデータ
 * Issue作成日時からPR作成日時までの時間を計測
 */
export interface IssueCodingTime {
  issueNumber: number;
  issueTitle: string;
  repository: string;
  /** Issue作成日時（着手日） */
  issueCreatedAt: string;
  /** PR作成日時（コーディング完了日） */
  prCreatedAt: string | null;
  /** PR番号 */
  prNumber: number | null;
  /** コーディングタイム（時間）- PRがない場合はnull */
  codingTimeHours: number | null;
}
