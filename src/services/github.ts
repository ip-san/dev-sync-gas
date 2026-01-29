import type { GitHubPullRequest, GitHubWorkflowRun, GitHubDeployment, GitHubIncident, GitHubRepository, ApiResponse, PRReworkData, PRReviewData, PRSizeData, GitHubIssue, PRChainItem, IssueCycleTime, IssueCodingTime } from "../types";
import { getContainer } from "../container";

const GITHUB_API_BASE = "https://api.github.com";

/** ページネーションのデフォルト最大ページ数 */
const DEFAULT_MAX_PAGES = 5;

/** 1ページあたりの取得件数（GitHub API最大値） */
const PER_PAGE = 100;

/** ステータス取得時の警告閾値（この件数を超えると警告ログ） */
const STATUS_FETCH_WARNING_THRESHOLD = 50;

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
 * GitHub REST APIを呼び出すヘルパー関数
 *
 * @param endpoint - APIエンドポイント（例: "/repos/owner/repo/pulls"）
 * @param token - GitHub Personal Access Token
 * @returns APIレスポンス
 */
function fetchGitHub<T>(endpoint: string, token: string): ApiResponse<T> {
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
    return { success: false, error: `GitHub API error: ${response.statusCode} - ${response.content}` };
  } catch (error) {
    return { success: false, error: `Request failed: ${error}` };
  }
}

/**
 * リポジトリのプルリクエスト一覧を取得
 *
 * @param repo - 対象リポジトリ
 * @param token - GitHub Personal Access Token
 * @param state - 取得するPRの状態（デフォルト: "all"）
 * @param dateRange - 期間フィルタ（オプション）
 * @param maxPages - 最大取得ページ数（デフォルト: 5）
 * @returns PRの配列
 */
export function getPullRequests(
  repo: GitHubRepository,
  token: string,
  state: "open" | "closed" | "all" = "all",
  dateRange?: DateRange,
  maxPages = DEFAULT_MAX_PAGES
): ApiResponse<GitHubPullRequest[]> {
  const allPRs: GitHubPullRequest[] = [];
  let page = 1;

  while (page <= maxPages) {
    let endpoint = `/repos/${repo.fullName}/pulls?state=${state}&per_page=${PER_PAGE}&page=${page}&sort=updated&direction=desc`;

    const response = fetchGitHub<any[]>(endpoint, token);

    if (!response.success || !response.data) {
      if (page === 1) {
        return response as ApiResponse<GitHubPullRequest[]>;
      }
      break;
    }

    if (response.data.length === 0) {
      break;
    }

    for (const pr of response.data) {
      const createdAt = new Date(pr.created_at);

      // 期間フィルタリング
      if (dateRange?.until && createdAt > dateRange.until) {
        continue;
      }
      if (dateRange?.since && createdAt < dateRange.since) {
        // 古い順にソートされていないので、ここで終了しない
        continue;
      }

      allPRs.push({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
        closedAt: pr.closed_at,
        author: pr.user?.login ?? "unknown",
        repository: repo.fullName,
      });
    }

    page++;
  }

  return { success: true, data: allPRs };
}

/**
 * リポジトリのワークフロー実行履歴を取得
 *
 * @param repo - 対象リポジトリ
 * @param token - GitHub Personal Access Token
 * @param dateRange - 期間フィルタ（オプション）
 * @param maxPages - 最大取得ページ数（デフォルト: 5）
 * @returns ワークフロー実行の配列
 */
export function getWorkflowRuns(
  repo: GitHubRepository,
  token: string,
  dateRange?: DateRange,
  maxPages = DEFAULT_MAX_PAGES
): ApiResponse<GitHubWorkflowRun[]> {
  const allRuns: GitHubWorkflowRun[] = [];
  let page = 1;

  while (page <= maxPages) {
    let endpoint = `/repos/${repo.fullName}/actions/runs?per_page=${PER_PAGE}&page=${page}`;

    // GitHub Actions APIは created パラメータで日付フィルタ可能
    if (dateRange?.since) {
      const sinceStr = dateRange.since.toISOString().split("T")[0];
      endpoint += `&created=${encodeURIComponent(">=" + sinceStr)}`;
    }

    const response = fetchGitHub<{ workflow_runs: any[] }>(endpoint, token);

    if (!response.success || !response.data) {
      if (page === 1) {
        return response as ApiResponse<GitHubWorkflowRun[]>;
      }
      break;
    }

    if (!response.data.workflow_runs || response.data.workflow_runs.length === 0) {
      break;
    }

    for (const run of response.data.workflow_runs) {
      const createdAt = new Date(run.created_at);

      // 期間フィルタリング
      if (dateRange?.until && createdAt > dateRange.until) {
        continue;
      }
      if (dateRange?.since && createdAt < dateRange.since) {
        continue;
      }

      allRuns.push({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        repository: repo.fullName,
      });
    }

    page++;
  }

  return { success: true, data: allRuns };
}

/** 環境名のマッチングモード */
export type EnvironmentMatchMode = "exact" | "partial";

export interface GetDeploymentsOptions {
  /**
   * デプロイメント環境名
   * 例: "production", "prod", "staging"
   */
  environment?: string;
  /**
   * 環境名のマッチングモード
   * - "exact": 完全一致（GitHub APIのフィルタを使用、高速）
   * - "partial": 部分一致（クライアント側でフィルタ、"production_v2"等にマッチ）
   * デフォルト: "exact"
   */
  environmentMatchMode?: EnvironmentMatchMode;
  dateRange?: DateRange;
  maxPages?: number;
  /**
   * ステータス取得をスキップしてAPI呼び出しを削減
   * true: ステータスをnullのまま返す（高速）
   * false: 各デプロイメントのステータスを個別に取得（N+1クエリ）
   *
   * ⚠️ 注意: trueに設定するとすべてのdeployment.statusがnullになり、
   * DORA metricsの計算（Deployment Frequency, Change Failure Rate, MTTR）が
   * ワークフローベースのフォールバックを使用するようになります。
   * メトリクス計算が目的の場合はfalse（デフォルト）を推奨します。
   */
  skipStatusFetch?: boolean;
}

/**
 * リポジトリのデプロイメント一覧を取得
 *
 * @param repo - 対象リポジトリ
 * @param token - GitHub Personal Access Token
 * @param options - 取得オプション（環境、期間、ステータス取得有無）
 * @returns デプロイメントの配列
 */
export function getDeployments(
  repo: GitHubRepository,
  token: string,
  options: GetDeploymentsOptions = {}
): ApiResponse<GitHubDeployment[]> {
  const {
    environment,
    environmentMatchMode = "exact",
    dateRange,
    maxPages = DEFAULT_MAX_PAGES,
    skipStatusFetch = false,
  } = options;
  const allDeployments: GitHubDeployment[] = [];
  let page = 1;

  // 部分一致の場合はAPIフィルタを使用せず、クライアント側でフィルタする
  const useApiFilter = environment && environmentMatchMode === "exact";

  // Phase 1: デプロイメント一覧を取得
  while (page <= maxPages) {
    let endpoint = `/repos/${repo.fullName}/deployments?per_page=${PER_PAGE}&page=${page}`;
    if (useApiFilter) {
      endpoint += `&environment=${encodeURIComponent(environment)}`;
    }

    const response = fetchGitHub<any[]>(endpoint, token);

    if (!response.success || !response.data) {
      if (page === 1) {
        return response as ApiResponse<GitHubDeployment[]>;
      }
      break;
    }

    if (response.data.length === 0) {
      break;
    }

    for (const deployment of response.data) {
      const createdAt = new Date(deployment.created_at);

      // 期間フィルタリング
      if (dateRange?.until && createdAt > dateRange.until) {
        continue;
      }
      if (dateRange?.since && createdAt < dateRange.since) {
        continue;
      }

      // 部分一致モードの場合、クライアント側で環境名をフィルタ
      if (environment && environmentMatchMode === "partial") {
        const envLower = deployment.environment?.toLowerCase() ?? "";
        const filterLower = environment.toLowerCase();
        if (!envLower.includes(filterLower)) {
          continue;
        }
      }

      allDeployments.push({
        id: deployment.id,
        sha: deployment.sha,
        environment: deployment.environment,
        createdAt: deployment.created_at,
        updatedAt: deployment.updated_at,
        status: null, // Phase 2で取得
        repository: repo.fullName,
      });
    }

    page++;
  }

  // Phase 2: ステータスを取得（オプション）
  // 注意: GASは並行リクエストをサポートしないためN+1クエリになる
  // 大量のデプロイメントがある場合はskipStatusFetch=trueを推奨
  if (!skipStatusFetch && allDeployments.length > 0) {
    const { logger } = getContainer();
    if (allDeployments.length > STATUS_FETCH_WARNING_THRESHOLD) {
      logger.log(`  ⚠️ Fetching status for ${allDeployments.length} deployments (may be slow)`);
    }

    for (const deployment of allDeployments) {
      const statusResponse = fetchGitHub<any[]>(
        `/repos/${repo.fullName}/deployments/${deployment.id}/statuses?per_page=1`,
        token
      );
      if (statusResponse.success && statusResponse.data?.[0]) {
        deployment.status = statusResponse.data[0].state;
      }
    }
  }

  return { success: true, data: allDeployments };
}

/**
 * 複数リポジトリからデータを一括取得する際のオプション
 */
export interface GetAllRepositoriesDataOptions {
  /** 期間フィルタ */
  dateRange?: DateRange;
  /**
   * デプロイメント環境名（デフォルト: "production"）
   * 例: "production", "prod", "live", "main"
   */
  deploymentEnvironment?: string;
  /**
   * 環境名のマッチングモード（デフォルト: "exact"）
   * - "exact": 完全一致（高速）
   * - "partial": 部分一致（"production_v2"等にもマッチ）
   */
  deploymentEnvironmentMatchMode?: EnvironmentMatchMode;
}

/**
 * 複数リポジトリのGitHubデータを一括取得
 *
 * @param repositories - 対象リポジトリの配列
 * @param token - GitHub Personal Access Token
 * @param options - 取得オプション
 * @returns PR、ワークフロー実行、デプロイメントの集約データ
 */
export function getAllRepositoriesData(
  repositories: GitHubRepository[],
  token: string,
  options: GetAllRepositoriesDataOptions = {}
): { pullRequests: GitHubPullRequest[]; workflowRuns: GitHubWorkflowRun[]; deployments: GitHubDeployment[] } {
  const {
    dateRange,
    deploymentEnvironment = "production",
    deploymentEnvironmentMatchMode = "exact",
  } = options;
  const { logger } = getContainer();
  const allPRs: GitHubPullRequest[] = [];
  const allRuns: GitHubWorkflowRun[] = [];
  const allDeployments: GitHubDeployment[] = [];

  for (const repo of repositories) {
    logger.log(`📡 Fetching data for ${repo.fullName}...`);

    const prsResult = getPullRequests(repo, token, "all", dateRange);
    if (prsResult.success && prsResult.data) {
      allPRs.push(...prsResult.data);
      logger.log(`  PRs: ${prsResult.data.length}`);
    } else {
      logger.log(`  ⚠️ PR fetch failed: ${prsResult.error}`);
    }

    const runsResult = getWorkflowRuns(repo, token, dateRange);
    if (runsResult.success && runsResult.data) {
      allRuns.push(...runsResult.data);
      logger.log(`  Workflow runs: ${runsResult.data.length}`);
    } else {
      logger.log(`  ⚠️ Workflow fetch failed: ${runsResult.error}`);
    }

    // Fetch deployments
    const deploymentsResult = getDeployments(repo, token, {
      environment: deploymentEnvironment,
      environmentMatchMode: deploymentEnvironmentMatchMode,
      dateRange,
    });
    if (deploymentsResult.success && deploymentsResult.data) {
      allDeployments.push(...deploymentsResult.data);
      logger.log(`  Deployments: ${deploymentsResult.data.length}`);
    } else {
      logger.log(`  ⚠️ Deployments fetch failed: ${deploymentsResult.error}`);
    }
  }

  return { pullRequests: allPRs, workflowRuns: allRuns, deployments: allDeployments };
}

/**
 * インシデント取得オプション
 */
export interface GetIncidentsOptions {
  /**
   * インシデントとして認識するラベル
   * 指定したラベルのいずれかを持つIssueを取得
   * デフォルト: ["incident"]
   */
  labels?: string[];
  /** 期間フィルタ */
  dateRange?: DateRange;
  /** 最大取得ページ数 */
  maxPages?: number;
}

/**
 * リポジトリのインシデント（ラベル付きIssue）を取得
 *
 * GitHub IssuesをインシデントトラッキングとしてMTTR計測に使用
 *
 * @param repo - 対象リポジトリ
 * @param token - GitHub Personal Access Token
 * @param options - 取得オプション
 * @returns インシデントの配列
 */
export function getIncidents(
  repo: GitHubRepository,
  token: string,
  options: GetIncidentsOptions = {}
): ApiResponse<GitHubIncident[]> {
  const { labels = ["incident"], dateRange, maxPages = DEFAULT_MAX_PAGES } = options;
  const allIncidents: GitHubIncident[] = [];
  let page = 1;

  // ラベルをカンマ区切りで結合
  const labelsParam = labels.join(",");

  while (page <= maxPages) {
    // state=all で open/closed 両方を取得
    const endpoint = `/repos/${repo.fullName}/issues?labels=${encodeURIComponent(labelsParam)}&state=all&per_page=${PER_PAGE}&page=${page}&sort=created&direction=desc`;

    const response = fetchGitHub<any[]>(endpoint, token);

    if (!response.success || !response.data) {
      if (page === 1) {
        return response as ApiResponse<GitHubIncident[]>;
      }
      break;
    }

    if (response.data.length === 0) {
      break;
    }

    for (const issue of response.data) {
      // PRはスキップ（Issues APIはPRも返す場合がある）
      if (issue.pull_request) {
        continue;
      }

      const createdAt = new Date(issue.created_at);

      // 期間フィルタリング
      if (dateRange?.until && createdAt > dateRange.until) {
        continue;
      }
      if (dateRange?.since && createdAt < dateRange.since) {
        continue;
      }

      allIncidents.push({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        state: issue.state,
        createdAt: issue.created_at,
        closedAt: issue.closed_at,
        labels: issue.labels?.map((l: any) => l.name) ?? [],
        repository: repo.fullName,
      });
    }

    page++;
  }

  return { success: true, data: allIncidents };
}

/**
 * GitHub PR URLをパースしてowner, repo, numberを取得
 *
 * @param url - PR URL（例: "https://github.com/owner/repo/pull/123"）
 * @returns パース結果またはnull
 */
export function parsePrUrl(url: string): { owner: string; repo: string; number: number } | null {
  // https://github.com/owner/repo/pull/123 形式を想定
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2],
    number: parseInt(match[3], 10),
  };
}

/**
 * PR URLから単一のPR情報を取得
 *
 * @param prUrl - PR URL（例: "https://github.com/owner/repo/pull/123"）
 * @param token - GitHub Personal Access Token
 * @returns PR情報
 */
export function getPullRequestByUrl(
  prUrl: string,
  token: string
): ApiResponse<GitHubPullRequest> {
  const parsed = parsePrUrl(prUrl);
  if (!parsed) {
    return { success: false, error: `Invalid PR URL format: ${prUrl}` };
  }

  const endpoint = `/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`;
  const response = fetchGitHub<any>(endpoint, token);

  if (!response.success || !response.data) {
    return response as ApiResponse<GitHubPullRequest>;
  }

  const pr = response.data;
  return {
    success: true,
    data: {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      createdAt: pr.created_at,
      mergedAt: pr.merged_at,
      closedAt: pr.closed_at,
      author: pr.user?.login ?? "unknown",
      repository: `${parsed.owner}/${parsed.repo}`,
    },
  };
}

/**
 * PRのコミット一覧を取得
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param prNumber - PR番号
 * @param token - GitHub Personal Access Token
 * @returns コミットの配列（作成日時付き）
 */
export function getPRCommits(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<{ sha: string; date: string }[]> {
  const allCommits: { sha: string; date: string }[] = [];
  let page = 1;

  while (page <= DEFAULT_MAX_PAGES) {
    const endpoint = `/repos/${owner}/${repo}/pulls/${prNumber}/commits?per_page=${PER_PAGE}&page=${page}`;
    const response = fetchGitHub<any[]>(endpoint, token);

    if (!response.success || !response.data) {
      if (page === 1) {
        return response as ApiResponse<{ sha: string; date: string }[]>;
      }
      break;
    }

    if (response.data.length === 0) {
      break;
    }

    for (const commit of response.data) {
      allCommits.push({
        sha: commit.sha,
        // commit.author.dateを使用（コミット作成時刻）
        date: commit.commit?.author?.date ?? commit.commit?.committer?.date ?? "",
      });
    }

    page++;
  }

  return { success: true, data: allCommits };
}

/**
 * PRのタイムラインイベントを取得してforce push回数をカウント
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param prNumber - PR番号
 * @param token - GitHub Personal Access Token
 * @returns force push回数
 */
export function getPRForcePushCount(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<number> {
  let forcePushCount = 0;
  let page = 1;

  while (page <= DEFAULT_MAX_PAGES) {
    // Timeline APIはIssue番号を使用（PRはIssueとしても扱われる）
    const endpoint = `/repos/${owner}/${repo}/issues/${prNumber}/timeline?per_page=${PER_PAGE}&page=${page}`;
    const response = fetchGitHub<any[]>(endpoint, token);

    if (!response.success || !response.data) {
      if (page === 1) {
        return response as ApiResponse<number>;
      }
      break;
    }

    if (response.data.length === 0) {
      break;
    }

    for (const event of response.data) {
      // force pushイベントをカウント
      if (event.event === "head_ref_force_pushed") {
        forcePushCount++;
      }
    }

    page++;
  }

  return { success: true, data: forcePushCount };
}

/**
 * 複数PRの手戻りデータを一括取得
 *
 * @param pullRequests - PR情報の配列
 * @param token - GitHub Personal Access Token
 * @returns 各PRの手戻りデータ配列
 */
export function getReworkDataForPRs(
  pullRequests: GitHubPullRequest[],
  token: string
): PRReworkData[] {
  const { logger } = getContainer();
  const reworkData: PRReworkData[] = [];

  for (const pr of pullRequests) {
    const [owner, repo] = pr.repository.split("/");
    if (!owner || !repo) {
      logger.log(`  ⚠️ Invalid repository format: ${pr.repository}`);
      continue;
    }

    // PR作成日時
    const prCreatedAt = new Date(pr.createdAt);

    // コミット一覧を取得
    const commitsResult = getPRCommits(owner, repo, pr.number, token);
    let totalCommits = 0;
    let additionalCommits = 0;

    if (commitsResult.success && commitsResult.data) {
      totalCommits = commitsResult.data.length;

      // PR作成後のコミットをカウント
      for (const commit of commitsResult.data) {
        if (commit.date) {
          const commitDate = new Date(commit.date);
          if (commitDate > prCreatedAt) {
            additionalCommits++;
          }
        }
      }
    } else {
      logger.log(`  ⚠️ Failed to fetch commits for PR #${pr.number}: ${commitsResult.error}`);
    }

    // Force Push回数を取得
    const forcePushResult = getPRForcePushCount(owner, repo, pr.number, token);
    let forcePushCount = 0;

    if (forcePushResult.success && forcePushResult.data !== undefined) {
      forcePushCount = forcePushResult.data;
    } else {
      logger.log(`  ⚠️ Failed to fetch force push count for PR #${pr.number}: ${forcePushResult.error}`);
    }

    reworkData.push({
      prNumber: pr.number,
      title: pr.title,
      repository: pr.repository,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      additionalCommits,
      forcePushCount,
      totalCommits,
    });
  }

  return reworkData;
}

/**
 * GitHub Reviewの状態
 */
export type ReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "PENDING" | "DISMISSED";

/**
 * PRのレビュー一覧を取得
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param prNumber - PR番号
 * @param token - GitHub Personal Access Token
 * @returns レビューの配列
 */
export function getPRReviews(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<{ state: ReviewState; submittedAt: string; user: string }[]> {
  const allReviews: { state: ReviewState; submittedAt: string; user: string }[] = [];
  let page = 1;

  while (page <= DEFAULT_MAX_PAGES) {
    const endpoint = `/repos/${owner}/${repo}/pulls/${prNumber}/reviews?per_page=${PER_PAGE}&page=${page}`;
    const response = fetchGitHub<any[]>(endpoint, token);

    if (!response.success || !response.data) {
      if (page === 1) {
        return response as ApiResponse<{ state: ReviewState; submittedAt: string; user: string }[]>;
      }
      break;
    }

    if (response.data.length === 0) {
      break;
    }

    for (const review of response.data) {
      // PENDINGは未提出なのでスキップ
      if (review.state === "PENDING") {
        continue;
      }

      allReviews.push({
        state: review.state,
        submittedAt: review.submitted_at,
        user: review.user?.login ?? "unknown",
      });
    }

    page++;
  }

  return { success: true, data: allReviews };
}

/**
 * PRのready_for_review時刻を取得（Timeline APIから）
 * ドラフトPRがレビュー可能になった時刻を返す
 * ドラフトでないPRの場合はnullを返す（PR作成時刻を使用すべき）
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param prNumber - PR番号
 * @param token - GitHub Personal Access Token
 * @returns ready_for_review時刻（ドラフトでない場合はnull）
 */
export function getPRReadyForReviewAt(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<string | null> {
  let page = 1;

  while (page <= DEFAULT_MAX_PAGES) {
    const endpoint = `/repos/${owner}/${repo}/issues/${prNumber}/timeline?per_page=${PER_PAGE}&page=${page}`;
    const response = fetchGitHub<any[]>(endpoint, token);

    if (!response.success || !response.data) {
      if (page === 1) {
        return response as ApiResponse<string | null>;
      }
      break;
    }

    if (response.data.length === 0) {
      break;
    }

    for (const event of response.data) {
      if (event.event === "ready_for_review") {
        return { success: true, data: event.created_at };
      }
    }

    page++;
  }

  // ready_for_reviewイベントがない = 最初からドラフトでなかった
  return { success: true, data: null };
}

/**
 * 複数PRのレビュー効率データを一括取得
 *
 * @param pullRequests - PR情報の配列
 * @param token - GitHub Personal Access Token
 * @returns 各PRのレビュー効率データ配列
 */
export function getReviewEfficiencyDataForPRs(
  pullRequests: GitHubPullRequest[],
  token: string
): PRReviewData[] {
  const { logger } = getContainer();
  const reviewData: PRReviewData[] = [];

  for (const pr of pullRequests) {
    const [owner, repo] = pr.repository.split("/");
    if (!owner || !repo) {
      logger.log(`  ⚠️ Invalid repository format: ${pr.repository}`);
      continue;
    }

    // Ready for Review時刻を取得
    const readyResult = getPRReadyForReviewAt(owner, repo, pr.number, token);
    let readyForReviewAt = pr.createdAt; // デフォルトはPR作成時刻

    if (readyResult.success && readyResult.data) {
      readyForReviewAt = readyResult.data;
    } else if (!readyResult.success) {
      logger.log(`  ⚠️ Failed to fetch timeline for PR #${pr.number}: ${readyResult.error}`);
    }

    // レビュー一覧を取得
    const reviewsResult = getPRReviews(owner, repo, pr.number, token);
    let firstReviewAt: string | null = null;
    let approvedAt: string | null = null;

    if (reviewsResult.success && reviewsResult.data) {
      // 時系列でソート
      const sortedReviews = [...reviewsResult.data].sort(
        (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      );

      // 最初のレビュー
      if (sortedReviews.length > 0) {
        firstReviewAt = sortedReviews[0].submittedAt;
      }

      // 最初の承認
      const approvalReview = sortedReviews.find((r) => r.state === "APPROVED");
      if (approvalReview) {
        approvedAt = approvalReview.submittedAt;
      }
    } else {
      logger.log(`  ⚠️ Failed to fetch reviews for PR #${pr.number}: ${reviewsResult.error}`);
    }

    // 各時間を計算
    const readyAt = new Date(readyForReviewAt).getTime();
    const msToHours = 1000 * 60 * 60;

    let timeToFirstReviewHours: number | null = null;
    let reviewDurationHours: number | null = null;
    let timeToMergeHours: number | null = null;
    let totalTimeHours: number | null = null;

    // レビュー待ち時間
    if (firstReviewAt) {
      const firstReview = new Date(firstReviewAt).getTime();
      const hours = Math.round(((firstReview - readyAt) / msToHours) * 10) / 10;
      if (hours < 0) {
        logger.log(`  ⚠️ PR #${pr.number}: Negative time to first review (${hours}h) - data inconsistency`);
      }
      timeToFirstReviewHours = hours;
    }

    // レビュー時間
    if (firstReviewAt && approvedAt) {
      const firstReview = new Date(firstReviewAt).getTime();
      const approved = new Date(approvedAt).getTime();
      const hours = Math.round(((approved - firstReview) / msToHours) * 10) / 10;
      if (hours < 0) {
        logger.log(`  ⚠️ PR #${pr.number}: Negative review duration (${hours}h) - data inconsistency`);
      }
      reviewDurationHours = hours;
    }

    // マージ待ち時間
    if (approvedAt && pr.mergedAt) {
      const approved = new Date(approvedAt).getTime();
      const merged = new Date(pr.mergedAt).getTime();
      const hours = Math.round(((merged - approved) / msToHours) * 10) / 10;
      if (hours < 0) {
        logger.log(`  ⚠️ PR #${pr.number}: Negative time to merge (${hours}h) - data inconsistency`);
      }
      timeToMergeHours = hours;
    }

    // 全体時間
    if (pr.mergedAt) {
      const merged = new Date(pr.mergedAt).getTime();
      const hours = Math.round(((merged - readyAt) / msToHours) * 10) / 10;
      if (hours < 0) {
        logger.log(`  ⚠️ PR #${pr.number}: Negative total time (${hours}h) - data inconsistency`);
      }
      totalTimeHours = hours;
    }

    reviewData.push({
      prNumber: pr.number,
      title: pr.title,
      repository: pr.repository,
      createdAt: pr.createdAt,
      readyForReviewAt,
      firstReviewAt,
      approvedAt,
      mergedAt: pr.mergedAt,
      timeToFirstReviewHours,
      reviewDurationHours,
      timeToMergeHours,
      totalTimeHours,
    });
  }

  return reviewData;
}

/**
 * PRの詳細情報を取得（additions, deletions, changed_files を含む）
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param prNumber - PR番号
 * @param token - GitHub Personal Access Token
 * @returns PR詳細情報
 */
export function getPRDetails(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<{ additions: number; deletions: number; changedFiles: number }> {
  const endpoint = `/repos/${owner}/${repo}/pulls/${prNumber}`;
  const response = fetchGitHub<any>(endpoint, token);

  if (!response.success || !response.data) {
    return response as ApiResponse<{ additions: number; deletions: number; changedFiles: number }>;
  }

  return {
    success: true,
    data: {
      additions: response.data.additions ?? 0,
      deletions: response.data.deletions ?? 0,
      changedFiles: response.data.changed_files ?? 0,
    },
  };
}

/**
 * 複数PRのサイズデータを一括取得
 *
 * @param pullRequests - PR情報の配列
 * @param token - GitHub Personal Access Token
 * @returns 各PRのサイズデータ配列（API取得に失敗したPRはスキップ）
 */
export function getPRSizeDataForPRs(
  pullRequests: GitHubPullRequest[],
  token: string
): PRSizeData[] {
  const { logger } = getContainer();
  const sizeData: PRSizeData[] = [];

  // 大量PR取得時の警告
  if (pullRequests.length > STATUS_FETCH_WARNING_THRESHOLD) {
    logger.log(`  ⚠️ Fetching size data for ${pullRequests.length} PRs. This may take a while and consume API quota.`);
  }

  let skippedCount = 0;

  for (const pr of pullRequests) {
    const [owner, repo] = pr.repository.split("/");
    if (!owner || !repo) {
      logger.log(`  ⚠️ Invalid repository format: ${pr.repository}`);
      skippedCount++;
      continue;
    }

    // PR詳細を取得
    const detailsResult = getPRDetails(owner, repo, pr.number, token);

    if (!detailsResult.success || !detailsResult.data) {
      logger.log(`  ⚠️ Failed to fetch details for PR #${pr.number}: ${detailsResult.error}`);
      skippedCount++;
      continue;
    }

    const { additions, deletions, changedFiles } = detailsResult.data;

    sizeData.push({
      prNumber: pr.number,
      title: pr.title,
      repository: pr.repository,
      createdAt: pr.createdAt,
      mergedAt: pr.mergedAt,
      additions,
      deletions,
      linesOfCode: additions + deletions,
      filesChanged: changedFiles,
    });
  }

  if (skippedCount > 0) {
    logger.log(`  ⚠️ Skipped ${skippedCount} PRs due to API errors`);
  }

  return sizeData;
}

// ============================================================
// Cycle Time関連
// ============================================================

/**
 * リポジトリのIssueを取得（PRを除外）
 *
 * @param repo - GitHubリポジトリ
 * @param token - GitHub Personal Access Token
 * @param options - オプション（日付範囲、ラベルフィルタ）
 * @returns Issue配列
 */
export function getIssues(
  repo: GitHubRepository,
  token: string,
  options?: {
    dateRange?: DateRange;
    labels?: string[];
  }
): ApiResponse<GitHubIssue[]> {
  const { logger } = getContainer();
  const allIssues: GitHubIssue[] = [];
  let page = 1;
  const perPage = 100;

  // クエリパラメータを構築
  const queryParams: string[] = [
    "state=all",
    `per_page=${perPage}`,
  ];

  if (options?.labels && options.labels.length > 0) {
    queryParams.push(`labels=${options.labels.join(",")}`);
  }

  if (options?.dateRange?.start) {
    queryParams.push(`since=${options.dateRange.start}`);
  }

  logger.log(`  📋 Fetching issues from ${repo.fullName}...`);

  while (true) {
    const endpoint = `/repos/${repo.owner}/${repo.name}/issues?${queryParams.join("&")}&page=${page}`;
    const response = fetchGitHub<any[]>(endpoint, token);

    if (!response.success || !response.data) {
      return response as ApiResponse<GitHubIssue[]>;
    }

    if (response.data.length === 0) break;

    for (const item of response.data) {
      // PRはissuesエンドポイントにも含まれるので除外
      if (item.pull_request) continue;

      // 日付範囲チェック（endのみ、sinceはAPIで処理）
      if (options?.dateRange?.end) {
        const createdAt = new Date(item.created_at);
        const endDate = new Date(options.dateRange.end);
        if (createdAt > endDate) continue;
      }

      const issue: GitHubIssue = {
        id: item.id,
        number: item.number,
        title: item.title,
        state: item.state,
        createdAt: item.created_at,
        closedAt: item.closed_at,
        labels: item.labels?.map((l: any) => l.name) ?? [],
        repository: repo.fullName,
      };
      allIssues.push(issue);
    }

    if (response.data.length < perPage) break;
    page++;
  }

  logger.log(`  ✅ Found ${allIssues.length} issues`);
  return { success: true, data: allIssues };
}

/**
 * IssueにリンクされたPR番号を取得（Timeline APIを使用）
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param issueNumber - Issue番号
 * @param token - GitHub Personal Access Token
 * @returns リンクされたPR番号の配列
 */
export function getLinkedPRsForIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  token: string
): ApiResponse<number[]> {
  const prNumbers: number[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const endpoint = `/repos/${owner}/${repo}/issues/${issueNumber}/timeline?per_page=${perPage}&page=${page}`;
    const response = fetchGitHub<any[]>(endpoint, token);

    if (!response.success || !response.data) {
      return response as ApiResponse<number[]>;
    }

    if (response.data.length === 0) break;

    for (const event of response.data) {
      // cross-referencedイベントからPRを抽出
      if (event.event === "cross-referenced" && event.source?.issue?.pull_request) {
        const prNumber = event.source.issue.number;
        // 同じリポジトリのPRのみ
        const sourceRepo = event.source.issue.repository?.full_name;
        if (sourceRepo === `${owner}/${repo}` && !prNumbers.includes(prNumber)) {
          prNumbers.push(prNumber);
        }
      }
    }

    if (response.data.length < perPage) break;
    page++;
  }

  return { success: true, data: prNumbers };
}

/**
 * PR詳細を取得（ブランチ情報、マージコミットSHA含む）
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param prNumber - PR番号
 * @param token - GitHub Personal Access Token
 * @returns PR詳細
 */
export function getPullRequestWithBranches(
  owner: string,
  repo: string,
  prNumber: number,
  token: string
): ApiResponse<GitHubPullRequest> {
  const endpoint = `/repos/${owner}/${repo}/pulls/${prNumber}`;
  const response = fetchGitHub<any>(endpoint, token);

  if (!response.success || !response.data) {
    return response as ApiResponse<GitHubPullRequest>;
  }

  const pr = response.data;
  const pullRequest: GitHubPullRequest = {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    draft: pr.draft ?? false,
    createdAt: pr.created_at,
    mergedAt: pr.merged_at,
    repository: `${owner}/${repo}`,
    author: pr.user?.login ?? "unknown",
    baseBranch: pr.base?.ref,
    headBranch: pr.head?.ref,
    mergeCommitSha: pr.merge_commit_sha,
  };

  return { success: true, data: pullRequest };
}

/**
 * コミットSHAを含むPRを検索
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param commitSha - コミットSHA
 * @param token - GitHub Personal Access Token
 * @returns PRまたはnull
 */
export function findPRContainingCommit(
  owner: string,
  repo: string,
  commitSha: string,
  token: string
): ApiResponse<GitHubPullRequest | null> {
  const endpoint = `/repos/${owner}/${repo}/commits/${commitSha}/pulls`;
  const response = fetchGitHub<any[]>(endpoint, token);

  if (!response.success) {
    // 404の場合はnullを返す（コミットが見つからない）
    if (response.error?.includes("404")) {
      return { success: true, data: null };
    }
    return response as ApiResponse<GitHubPullRequest | null>;
  }

  if (!response.data || response.data.length === 0) {
    return { success: true, data: null };
  }

  // マージ済みのPRを優先
  const mergedPR = response.data.find((pr: any) => pr.merged_at !== null);
  const targetPR = mergedPR || response.data[0];

  const pullRequest: GitHubPullRequest = {
    id: targetPR.id,
    number: targetPR.number,
    title: targetPR.title,
    state: targetPR.state,
    draft: targetPR.draft ?? false,
    createdAt: targetPR.created_at,
    mergedAt: targetPR.merged_at,
    repository: `${owner}/${repo}`,
    author: targetPR.user?.login ?? "unknown",
    baseBranch: targetPR.base?.ref,
    headBranch: targetPR.head?.ref,
    mergeCommitSha: targetPR.merge_commit_sha,
  };

  return { success: true, data: pullRequest };
}

/**
 * PRチェーンを追跡してproductionブランチへのマージを検出
 *
 * @param owner - リポジトリオーナー
 * @param repo - リポジトリ名
 * @param initialPRNumber - 開始PR番号
 * @param token - GitHub Personal Access Token
 * @param productionPattern - productionブランチ名のパターン（部分一致）
 * @returns productionマージ日時とPRチェーン
 */
export function trackToProductionMerge(
  owner: string,
  repo: string,
  initialPRNumber: number,
  token: string,
  productionPattern: string = "production"
): ApiResponse<{
  productionMergedAt: string | null;
  prChain: PRChainItem[];
}> {
  const { logger } = getContainer();
  const prChain: PRChainItem[] = [];
  const maxDepth = 5;
  let currentPRNumber = initialPRNumber;
  let productionMergedAt: string | null = null;

  for (let depth = 0; depth < maxDepth; depth++) {
    const prResult = getPullRequestWithBranches(owner, repo, currentPRNumber, token);

    if (!prResult.success || !prResult.data) {
      logger.log(`    ⚠️ Failed to fetch PR #${currentPRNumber}`);
      break;
    }

    const pr = prResult.data;
    prChain.push({
      prNumber: pr.number,
      baseBranch: pr.baseBranch ?? "unknown",
      headBranch: pr.headBranch ?? "unknown",
      mergedAt: pr.mergedAt,
    });

    // productionブランチへのマージを検出
    if (pr.baseBranch && pr.baseBranch.toLowerCase().includes(productionPattern.toLowerCase())) {
      if (pr.mergedAt) {
        productionMergedAt = pr.mergedAt;
        logger.log(`    ✅ Found production merge: PR #${pr.number} → ${pr.baseBranch} at ${pr.mergedAt}`);
      }
      break;
    }

    // マージされていない場合は追跡終了
    if (!pr.mergedAt || !pr.mergeCommitSha) {
      break;
    }

    // マージコミットSHAから次のPRを検索
    const nextPRResult = findPRContainingCommit(owner, repo, pr.mergeCommitSha, token);

    if (!nextPRResult.success || !nextPRResult.data) {
      // 次のPRが見つからない場合は終了
      break;
    }

    // 同じPRの場合は無限ループを防止
    if (nextPRResult.data.number === currentPRNumber) {
      break;
    }

    currentPRNumber = nextPRResult.data.number;
  }

  return {
    success: true,
    data: { productionMergedAt, prChain },
  };
}

/**
 * 複数リポジトリからサイクルタイムデータを取得
 *
 * @param repositories - GitHubリポジトリ配列
 * @param token - GitHub Personal Access Token
 * @param options - オプション（日付範囲、productionブランチパターン、ラベルフィルタ）
 * @returns サイクルタイムデータ配列
 */
export function getCycleTimeData(
  repositories: GitHubRepository[],
  token: string,
  options: {
    dateRange?: DateRange;
    productionBranchPattern?: string;
    labels?: string[];
  } = {}
): ApiResponse<IssueCycleTime[]> {
  const { logger } = getContainer();
  const productionPattern = options.productionBranchPattern ?? "production";
  const allCycleTimeData: IssueCycleTime[] = [];

  for (const repo of repositories) {
    logger.log(`🔍 Processing ${repo.fullName}...`);

    // 1. Issueを取得
    const issuesResult = getIssues(repo, token, {
      dateRange: options.dateRange,
      labels: options.labels,
    });

    if (!issuesResult.success || !issuesResult.data) {
      logger.log(`  ⚠️ Failed to fetch issues: ${issuesResult.error}`);
      continue;
    }

    const issues = issuesResult.data;
    logger.log(`  📋 Found ${issues.length} issues to process`);

    // 2. 各IssueについてリンクPRとproductionマージを追跡
    for (const issue of issues) {
      logger.log(`  📌 Processing Issue #${issue.number}: ${issue.title}`);

      // リンクされたPRを取得
      const linkedPRsResult = getLinkedPRsForIssue(repo.owner, repo.name, issue.number, token);

      if (!linkedPRsResult.success || !linkedPRsResult.data || linkedPRsResult.data.length === 0) {
        logger.log(`    ⏭️ No linked PRs found`);
        allCycleTimeData.push({
          issueNumber: issue.number,
          issueTitle: issue.title,
          repository: repo.fullName,
          issueCreatedAt: issue.createdAt,
          productionMergedAt: null,
          cycleTimeHours: null,
          prChain: [],
        });
        continue;
      }

      logger.log(`    🔗 Found ${linkedPRsResult.data.length} linked PRs: ${linkedPRsResult.data.join(", ")}`);

      // 最初のリンクPRからproductionマージを追跡
      // 複数PRがリンクされている場合は、最初のマージ済みPRを優先
      let bestResult: { productionMergedAt: string | null; prChain: PRChainItem[] } | null = null;

      for (const prNumber of linkedPRsResult.data) {
        const trackResult = trackToProductionMerge(repo.owner, repo.name, prNumber, token, productionPattern);

        if (trackResult.success && trackResult.data) {
          if (trackResult.data.productionMergedAt) {
            // productionマージが見つかった場合は採用
            if (!bestResult || !bestResult.productionMergedAt ||
                new Date(trackResult.data.productionMergedAt) < new Date(bestResult.productionMergedAt)) {
              bestResult = trackResult.data;
            }
          } else if (!bestResult) {
            // まだ結果がない場合は未マージでも保存
            bestResult = trackResult.data;
          }
        }
      }

      const prChain = bestResult?.prChain ?? [];
      const productionMergedAt = bestResult?.productionMergedAt ?? null;

      // サイクルタイム計算
      let cycleTimeHours: number | null = null;
      if (productionMergedAt) {
        const startTime = new Date(issue.createdAt).getTime();
        const endTime = new Date(productionMergedAt).getTime();
        cycleTimeHours = Math.round((endTime - startTime) / (1000 * 60 * 60) * 10) / 10;
      }

      allCycleTimeData.push({
        issueNumber: issue.number,
        issueTitle: issue.title,
        repository: repo.fullName,
        issueCreatedAt: issue.createdAt,
        productionMergedAt,
        cycleTimeHours,
        prChain,
      });
    }
  }

  logger.log(`✅ Total: ${allCycleTimeData.length} issues processed`);
  return { success: true, data: allCycleTimeData };
}

// ============================================================
// Coding Time関連
// ============================================================

/**
 * 複数リポジトリからコーディングタイムデータを取得
 *
 * コーディングタイム = Issue作成日時 → リンクされたPR作成日時
 *
 * @param repositories - GitHubリポジトリ配列
 * @param token - GitHub Personal Access Token
 * @param options - オプション（日付範囲、ラベルフィルタ）
 * @returns コーディングタイムデータ配列
 */
export function getCodingTimeData(
  repositories: GitHubRepository[],
  token: string,
  options: {
    dateRange?: DateRange;
    labels?: string[];
  } = {}
): ApiResponse<IssueCodingTime[]> {
  const { logger } = getContainer();
  const allCodingTimeData: IssueCodingTime[] = [];

  for (const repo of repositories) {
    logger.log(`🔍 Processing ${repo.fullName} for coding time...`);

    // 1. Issueを取得
    const issuesResult = getIssues(repo, token, {
      dateRange: options.dateRange,
      labels: options.labels,
    });

    if (!issuesResult.success || !issuesResult.data) {
      logger.log(`  ⚠️ Failed to fetch issues: ${issuesResult.error}`);
      continue;
    }

    const issues = issuesResult.data;
    logger.log(`  📋 Found ${issues.length} issues to process`);

    // 2. 各IssueについてリンクPRを取得してコーディングタイムを計算
    for (const issue of issues) {
      logger.log(`  📌 Processing Issue #${issue.number}: ${issue.title}`);

      // リンクされたPRを取得
      const linkedPRsResult = getLinkedPRsForIssue(repo.owner, repo.name, issue.number, token);

      if (!linkedPRsResult.success || !linkedPRsResult.data || linkedPRsResult.data.length === 0) {
        logger.log(`    ⏭️ No linked PRs found`);
        allCodingTimeData.push({
          issueNumber: issue.number,
          issueTitle: issue.title,
          repository: repo.fullName,
          issueCreatedAt: issue.createdAt,
          prCreatedAt: null,
          prNumber: null,
          codingTimeHours: null,
        });
        continue;
      }

      logger.log(`    🔗 Found ${linkedPRsResult.data.length} linked PRs: ${linkedPRsResult.data.join(", ")}`);

      // 最初にリンクされたPRの情報を取得（最も早く作成されたPRを使用）
      let earliestPR: { prNumber: number; createdAt: string } | null = null;

      for (const prNumber of linkedPRsResult.data) {
        const prResult = getPullRequestWithBranches(repo.owner, repo.name, prNumber, token);

        if (prResult.success && prResult.data) {
          const pr = prResult.data;
          if (!earliestPR || new Date(pr.createdAt) < new Date(earliestPR.createdAt)) {
            earliestPR = {
              prNumber: pr.number,
              createdAt: pr.createdAt,
            };
          }
        }
      }

      if (!earliestPR) {
        logger.log(`    ⚠️ Could not fetch any linked PR details`);
        allCodingTimeData.push({
          issueNumber: issue.number,
          issueTitle: issue.title,
          repository: repo.fullName,
          issueCreatedAt: issue.createdAt,
          prCreatedAt: null,
          prNumber: null,
          codingTimeHours: null,
        });
        continue;
      }

      // コーディングタイム計算
      const issueCreatedTime = new Date(issue.createdAt).getTime();
      const prCreatedTime = new Date(earliestPR.createdAt).getTime();
      const codingTimeHours = Math.round((prCreatedTime - issueCreatedTime) / (1000 * 60 * 60) * 10) / 10;

      logger.log(`    ✅ Coding time: ${codingTimeHours}h (Issue → PR #${earliestPR.prNumber})`);

      allCodingTimeData.push({
        issueNumber: issue.number,
        issueTitle: issue.title,
        repository: repo.fullName,
        issueCreatedAt: issue.createdAt,
        prCreatedAt: earliestPR.createdAt,
        prNumber: earliestPR.prNumber,
        codingTimeHours,
      });
    }
  }

  logger.log(`✅ Total: ${allCodingTimeData.length} issues processed for coding time`);
  return { success: true, data: allCodingTimeData };
}
