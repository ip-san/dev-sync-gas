import type { GitHubPullRequest, GitHubWorkflowRun, GitHubDeployment, GitHubIncident, DevOpsMetrics, NotionTask, CycleTimeMetrics, IssueCycleTimeDetail, CodingTimeMetrics, TaskCodingTime, ReworkRateMetrics, PRReworkData, ReviewEfficiencyMetrics, PRReviewData, PRSizeMetrics, PRSizeData, DeveloperSatisfactionMetrics, TaskSatisfactionData, GitHubIssueCycleTime } from "../types";
import { getFrequencyCategory } from "../config/doraThresholds";

/** ミリ秒から時間への変換定数 */
const MS_TO_HOURS = 1000 * 60 * 60;

/** Lead Time計算時のマージ→デプロイ関連付け最大時間（時間） */
const LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS = 24;

/**
 * Lead Time計算結果
 */
export interface LeadTimeResult {
  /** 平均リードタイム（時間） */
  hours: number;
  /** マージ→デプロイで計測されたPR数 */
  mergeToDeployCount: number;
  /** PR作成→マージで計測されたPR数（フォールバック） */
  createToMergeCount: number;
}

/**
 * DORA Metrics: Lead Time for Changes
 *
 * 定義: コードがコミットされてから本番環境にデプロイされるまでの時間
 *
 * 計算方法:
 * 1. マージされたPRを取得
 * 2. マージ後24時間以内の成功デプロイメントを探す（時間ベースのマッチング）
 * 3. 見つかった場合: マージ→デプロイ時間を計算
 * 4. 見つからない場合: PR作成→マージ時間を計算（フォールバック）
 *
 * 注意: 理想的にはSHAベースでマッチングすべきだが、
 * GitHub Deployments APIの制約により時間ベースで近似している
 *
 * フォールバック: デプロイメントデータがない場合はPRのマージまでの時間を使用
 */
export function calculateLeadTime(
  prs: GitHubPullRequest[],
  deployments: GitHubDeployment[] = []
): number {
  return calculateLeadTimeDetailed(prs, deployments).hours;
}

/**
 * Lead Timeの詳細計算（測定方法の内訳を含む）
 */
export function calculateLeadTimeDetailed(
  prs: GitHubPullRequest[],
  deployments: GitHubDeployment[] = []
): LeadTimeResult {
  const mergedPRs = prs.filter((pr) => pr.mergedAt !== null);
  if (mergedPRs.length === 0) {
    return { hours: 0, mergeToDeployCount: 0, createToMergeCount: 0 };
  }

  const successfulDeployments = deployments
    .filter((d) => d.status === "success")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const leadTimes: number[] = [];
  let mergeToDeployCount = 0;
  let createToMergeCount = 0;

  for (const pr of mergedPRs) {
    const mergedAt = new Date(pr.mergedAt!).getTime();

    // デプロイメントデータがある場合: マージ後の最初のデプロイを探す
    if (successfulDeployments.length > 0) {
      const deploymentAfterMerge = successfulDeployments.find(
        (d) => new Date(d.createdAt).getTime() >= mergedAt
      );

      if (deploymentAfterMerge) {
        const deployedAt = new Date(deploymentAfterMerge.createdAt).getTime();
        const diffHours = (deployedAt - mergedAt) / MS_TO_HOURS;
        // マージ後一定時間以内のデプロイのみを関連付ける
        if (diffHours <= LEAD_TIME_DEPLOY_MATCH_THRESHOLD_HOURS) {
          leadTimes.push(diffHours);
          mergeToDeployCount++;
          continue;
        }
      }
    }

    // フォールバック: PR作成からマージまでの時間
    const created = new Date(pr.createdAt).getTime();
    const diffHours = (mergedAt - created) / MS_TO_HOURS;
    leadTimes.push(diffHours);
    createToMergeCount++;
  }

  if (leadTimes.length === 0) {
    return { hours: 0, mergeToDeployCount: 0, createToMergeCount: 0 };
  }

  const totalHours = leadTimes.reduce((sum, hours) => sum + hours, 0);
  const hours = Math.round((totalHours / leadTimes.length) * 10) / 10;

  return { hours, mergeToDeployCount, createToMergeCount };
}

/**
 * DORA Metrics: Deployment Frequency
 *
 * 定義: 本番環境へのデプロイ頻度
 *
 * 計算方法:
 * 1. GitHub Deployments API から成功デプロイをカウント
 *    （環境フィルタはAPI呼び出し時に適用済み）
 * 2. フォールバック: "deploy" を含むワークフローの成功数を使用
 *
 * 分類基準 (DORA):
 * - Elite: 1日1回以上 (daily)
 * - High: 週1回以上 (weekly)
 * - Medium: 月1回以上 (monthly)
 * - Low: 月1回未満 (yearly)
 */
export function calculateDeploymentFrequency(
  deployments: GitHubDeployment[],
  runs: GitHubWorkflowRun[],
  periodDays: number
): { count: number; frequency: DevOpsMetrics["deploymentFrequency"] } {
  // 優先: GitHub Deployments API のデータ（成功のみ）
  // 注意: 環境フィルタはgetDeployments()で適用済み
  const successfulDeploymentCount = deployments.filter(
    (d) => d.status === "success"
  ).length;

  // フォールバック: ワークフロー実行（"deploy"を含む成功したもの）
  let count: number;
  if (successfulDeploymentCount > 0) {
    count = successfulDeploymentCount;
  } else {
    count = runs.filter(
      (run) => run.conclusion === "success" && run.name.toLowerCase().includes("deploy")
    ).length;
  }

  const avgPerDay = count / periodDays;
  const frequency = getFrequencyCategory(avgPerDay);

  return { count, frequency };
}

/**
 * DORA Metrics: Change Failure Rate
 *
 * 定義: 本番環境でインシデントを引き起こしたデプロイの割合
 *
 * 注意: 真のDORA定義ではインシデント管理システムとの連携が必要
 * 現在の実装はCI/CDパイプラインの失敗率を測定（近似値）
 *
 * 計算方法:
 * 1. GitHub Deployments: 失敗ステータスのデプロイ / 全デプロイ
 *    （環境フィルタはAPI呼び出し時に適用済み、ステータスが取得できている場合のみ）
 * 2. フォールバック: ワークフロー失敗数 / 全ワークフロー実行数
 *
 * 分類基準 (DORA 2024):
 * - Elite: 0-15%
 * - High: 0-15%（Eliteと同じ）
 * - Medium: 16-30%
 * - Low: 30%超
 */
export function calculateChangeFailureRate(
  deployments: GitHubDeployment[],
  runs: GitHubWorkflowRun[]
): {
  total: number;
  failed: number;
  rate: number;
} {
  // 優先: GitHub Deployments API
  // 注意: 環境フィルタはgetDeployments()で適用済み
  // ステータスが取得できているデプロイメントのみを対象とする
  const deploymentsWithStatus = deployments.filter((d) => d.status !== null);

  if (deploymentsWithStatus.length > 0) {
    const total = deploymentsWithStatus.length;
    const failed = deploymentsWithStatus.filter(
      (d) => d.status === "failure" || d.status === "error"
    ).length;
    const rate = total > 0 ? Math.round((failed / total) * 100 * 10) / 10 : 0;
    return { total, failed, rate };
  }

  // フォールバック: ワークフロー実行
  const deploymentRuns = runs.filter((run) =>
    run.name.toLowerCase().includes("deploy")
  );

  const total = deploymentRuns.length;
  const failed = deploymentRuns.filter((run) => run.conclusion === "failure").length;
  const rate = total > 0 ? Math.round((failed / total) * 100 * 10) / 10 : 0;

  return { total, failed, rate };
}

/**
 * DORA Metrics: Mean Time to Recovery (MTTR) / Failed Deployment Recovery Time
 *
 * 定義: 本番環境の障害から復旧するまでの時間
 *
 * 注意: 真のDORA定義ではインシデント管理システムとの連携が必要
 * 現在の実装はデプロイ失敗から次の成功デプロイまでの時間を測定（近似値）
 *
 * 計算方法:
 * 1. 失敗したデプロイメントを時系列で追跡
 *    （環境フィルタはAPI呼び出し時に適用済み、ステータスが取得できている場合のみ）
 * 2. 次の成功デプロイメントまでの時間を計算
 * 3. 平均値を算出
 *
 * 分類基準 (DORA):
 * - Elite: < 1時間
 * - High: 1-24時間
 * - Medium: 1-7日
 * - Low: > 7日
 */
export function calculateMTTR(
  deployments: GitHubDeployment[],
  runs: GitHubWorkflowRun[]
): number | null {
  // 優先: GitHub Deployments API
  // 注意: 環境フィルタはgetDeployments()で適用済み
  // ステータスが取得できているデプロイメントのみを対象とする
  const deploymentsWithStatus = deployments.filter((d) => d.status !== null);

  if (deploymentsWithStatus.length > 0) {
    const sortedDeployments = [...deploymentsWithStatus].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return calculateRecoveryTime(
      sortedDeployments.map((d) => ({
        createdAt: d.createdAt,
        isFailure: d.status === "failure" || d.status === "error",
        isSuccess: d.status === "success",
      }))
    );
  }

  // フォールバック: ワークフロー実行
  const deploymentRuns = runs
    .filter((run) => run.name.toLowerCase().includes("deploy"))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return calculateRecoveryTime(
    deploymentRuns.map((run) => ({
      createdAt: run.createdAt,
      isFailure: run.conclusion === "failure",
      isSuccess: run.conclusion === "success",
    }))
  );
}

/**
 * イベントの時系列から復旧時間を計算するヘルパー関数
 *
 * @param events - 時系列順にソートされたイベント配列
 * @returns 平均復旧時間（時間）、障害がない場合はnull
 *
 * 計算ロジック:
 * 1. 失敗イベントを検出して記録
 * 2. その後の成功イベントまでの時間差を計算
 * 3. 全復旧時間の平均を返す
 */
function calculateRecoveryTime(
  events: Array<{ createdAt: string; isFailure: boolean; isSuccess: boolean }>
): number | null {
  const recoveryTimes: number[] = [];
  let lastFailure: { createdAt: string } | null = null;

  for (const event of events) {
    if (event.isFailure) {
      lastFailure = event;
    } else if (event.isSuccess && lastFailure) {
      const failureTime = new Date(lastFailure.createdAt).getTime();
      const recoveryTime = new Date(event.createdAt).getTime();
      const diffHours = (recoveryTime - failureTime) / MS_TO_HOURS;
      recoveryTimes.push(diffHours);
      lastFailure = null;
    }
  }

  if (recoveryTimes.length === 0) return null;

  const avgMTTR = recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length;
  return Math.round(avgMTTR * 10) / 10;
}

/**
 * インシデントメトリクス計算結果
 */
export interface IncidentMetricsResult {
  /** 期間内のインシデント総数 */
  incidentCount: number;
  /** 未解決のインシデント数 */
  openIncidents: number;
  /** 平均復旧時間（時間）、解決済みインシデントがない場合はnull */
  mttrHours: number | null;
}

/**
 * インシデント（GitHub Issues）ベースのMTTRを計算
 *
 * 真のDORA定義に近いMTTR: Issue作成（障害検知）からIssue close（復旧確認）までの時間
 *
 * @param incidents - インシデントの配列
 * @returns インシデントメトリクス
 */
export function calculateIncidentMetrics(incidents: GitHubIncident[]): IncidentMetricsResult {
  const closedIncidents = incidents.filter((i) => i.closedAt !== null);
  const openIncidents = incidents.filter((i) => i.state === "open");

  if (closedIncidents.length === 0) {
    return {
      incidentCount: incidents.length,
      openIncidents: openIncidents.length,
      mttrHours: null,
    };
  }

  const recoveryTimes = closedIncidents.map((incident) => {
    const created = new Date(incident.createdAt).getTime();
    const closed = new Date(incident.closedAt!).getTime();
    return (closed - created) / MS_TO_HOURS;
  });

  const totalHours = recoveryTimes.reduce((sum, hours) => sum + hours, 0);
  const mttrHours = Math.round((totalHours / recoveryTimes.length) * 10) / 10;

  return {
    incidentCount: incidents.length,
    openIncidents: openIncidents.length,
    mttrHours,
  };
}

/**
 * リポジトリ単位でDORA metricsを計算する
 *
 * @param repository - リポジトリ名
 * @param prs - プルリクエストの配列
 * @param runs - ワークフロー実行の配列
 * @param deployments - デプロイメントの配列
 * @param periodDays - 計測期間（日数）
 * @param incidents - インシデントの配列（オプション、真のMTTR計測用）
 */
export function calculateMetricsForRepository(
  repository: string,
  prs: GitHubPullRequest[],
  runs: GitHubWorkflowRun[],
  deployments: GitHubDeployment[] = [],
  periodDays = 30,
  incidents: GitHubIncident[] = []
): DevOpsMetrics {
  const repoPRs = prs.filter((pr) => pr.repository === repository);
  const repoRuns = runs.filter((run) => run.repository === repository);
  const repoDeployments = deployments.filter((d) => d.repository === repository);
  const repoIncidents = incidents.filter((i) => i.repository === repository);

  const { count, frequency } = calculateDeploymentFrequency(repoDeployments, repoRuns, periodDays);
  const { total, failed, rate } = calculateChangeFailureRate(repoDeployments, repoRuns);
  const leadTimeResult = calculateLeadTimeDetailed(repoPRs, repoDeployments);

  const metrics: DevOpsMetrics = {
    date: new Date().toISOString().split("T")[0],
    repository,
    deploymentCount: count,
    deploymentFrequency: frequency,
    leadTimeForChangesHours: leadTimeResult.hours,
    leadTimeMeasurement: {
      mergeToDeployCount: leadTimeResult.mergeToDeployCount,
      createToMergeCount: leadTimeResult.createToMergeCount,
    },
    totalDeployments: total,
    failedDeployments: failed,
    changeFailureRate: rate,
    meanTimeToRecoveryHours: calculateMTTR(repoDeployments, repoRuns),
  };

  // インシデントデータがある場合は真のMTTRを追加
  if (repoIncidents.length > 0) {
    const incidentMetrics = calculateIncidentMetrics(repoIncidents);
    metrics.incidentMetrics = incidentMetrics;
  }

  return metrics;
}

/**
 * サイクルタイム（Cycle Time）を計算
 *
 * 定義: Issue作成（着手）から productionブランチへのPRマージ（完了）までの時間
 * 仕様理解から本番リリースまでの効率を測定する指標
 *
 * 計算方法:
 * 1. GitHub Issue作成日時を着手日とする
 * 2. productionブランチへのPRマージ日時を完了日とする
 * 3. 平均値、中央値、最小値、最大値を算出
 *
 * @param cycleTimeData - サイクルタイムデータの配列
 * @param period - 計測期間の表示文字列（例: "2024-01"）
 */
export function calculateCycleTime(
  cycleTimeData: GitHubIssueCycleTime[],
  period: string
): CycleTimeMetrics {
  // productionマージが完了しているIssueのみ対象
  const validIssues = cycleTimeData.filter(
    (issue) => issue.productionMergedAt !== null && issue.cycleTimeHours !== null
  );

  if (validIssues.length === 0) {
    return {
      period,
      completedTaskCount: 0,
      avgCycleTimeHours: null,
      medianCycleTimeHours: null,
      minCycleTimeHours: null,
      maxCycleTimeHours: null,
      issueDetails: [],
    };
  }

  const issueDetails: IssueCycleTimeDetail[] = validIssues.map((issue) => {
    // PRチェーンをサマリー文字列に変換（例: "#1→#2→#3"）
    const prChainSummary = issue.prChain
      .map((pr) => `#${pr.prNumber}`)
      .join("→");

    return {
      issueNumber: issue.issueNumber,
      title: issue.issueTitle,
      repository: issue.repository,
      issueCreatedAt: issue.issueCreatedAt,
      productionMergedAt: issue.productionMergedAt!,
      cycleTimeHours: issue.cycleTimeHours!,
      prChainSummary,
    };
  });

  const cycleTimes = issueDetails.map((t) => t.cycleTimeHours);
  const sortedCycleTimes = [...cycleTimes].sort((a, b) => a - b);

  const sum = cycleTimes.reduce((acc, val) => acc + val, 0);
  const avg = sum / cycleTimes.length;

  // 中央値計算
  const mid = Math.floor(sortedCycleTimes.length / 2);
  const median =
    sortedCycleTimes.length % 2 !== 0
      ? sortedCycleTimes[mid]
      : (sortedCycleTimes[mid - 1] + sortedCycleTimes[mid]) / 2;

  return {
    period,
    completedTaskCount: validIssues.length,
    avgCycleTimeHours: Math.round(avg * 10) / 10,
    medianCycleTimeHours: Math.round(median * 10) / 10,
    minCycleTimeHours: sortedCycleTimes[0],
    maxCycleTimeHours: sortedCycleTimes[sortedCycleTimes.length - 1],
    issueDetails,
  };
}

/**
 * コーディング時間（Coding Time）を計算
 *
 * 定義: 着手（Notion進行中）からPR作成（GitHub）までの時間
 * 純粋なコーディング作業にかかった時間を測定
 *
 * 計算方法:
 * 1. 着手日（Date Started）とPR URLの両方があるタスクを対象
 * 2. GitHubからPR作成時刻を取得
 * 3. 各タスクのPR作成時刻 - 着手時刻 を計算
 * 4. 平均値、中央値、最小値、最大値を算出
 *
 * @param tasks - Notionタスクの配列（着手日・PR URLを持つもの）
 * @param prMap - タスクIDとPR情報のマップ
 * @param period - 計測期間の表示文字列
 */
export function calculateCodingTime(
  tasks: NotionTask[],
  prMap: Map<string, GitHubPullRequest>,
  period: string
): CodingTimeMetrics {
  const taskDetails: TaskCodingTime[] = [];

  for (const task of tasks) {
    if (!task.startedAt || !task.prUrl) continue;

    const pr = prMap.get(task.id);
    if (!pr) continue;

    const started = new Date(task.startedAt).getTime();
    const prCreated = new Date(pr.createdAt).getTime();
    const codingTimeHours = (prCreated - started) / MS_TO_HOURS;

    // 負の値はスキップ（PR作成後にNotionで着手日を設定した場合など）
    if (codingTimeHours < 0) continue;

    taskDetails.push({
      taskId: task.id,
      title: task.title,
      startedAt: task.startedAt,
      prCreatedAt: pr.createdAt,
      prUrl: task.prUrl,
      codingTimeHours: Math.round(codingTimeHours * 10) / 10,
    });
  }

  if (taskDetails.length === 0) {
    return {
      period,
      taskCount: 0,
      avgCodingTimeHours: null,
      medianCodingTimeHours: null,
      minCodingTimeHours: null,
      maxCodingTimeHours: null,
      taskDetails: [],
    };
  }

  const codingTimes = taskDetails.map((t) => t.codingTimeHours);
  const sortedCodingTimes = [...codingTimes].sort((a, b) => a - b);

  const sum = codingTimes.reduce((acc, val) => acc + val, 0);
  const avg = sum / codingTimes.length;

  // 中央値計算
  const mid = Math.floor(sortedCodingTimes.length / 2);
  const median =
    sortedCodingTimes.length % 2 !== 0
      ? sortedCodingTimes[mid]
      : (sortedCodingTimes[mid - 1] + sortedCodingTimes[mid]) / 2;

  return {
    period,
    taskCount: taskDetails.length,
    avgCodingTimeHours: Math.round(avg * 10) / 10,
    medianCodingTimeHours: Math.round(median * 10) / 10,
    minCodingTimeHours: sortedCodingTimes[0],
    maxCodingTimeHours: sortedCodingTimes[sortedCodingTimes.length - 1],
    taskDetails,
  };
}

/**
 * 手戻り率（Rework Rate）を計算
 *
 * 定義: PR作成後の追加コミット数とForce Push回数を測定
 * コードレビューでの指摘対応やコード品質の指標として使用
 *
 * 計算方法:
 * 1. 各PRの追加コミット数（PR作成後のコミット）を集計
 * 2. 各PRのForce Push回数を集計
 * 3. 平均値、中央値、合計値を算出
 *
 * @param reworkData - 各PRの手戻りデータ配列
 * @param period - 計測期間の表示文字列
 */
export function calculateReworkRate(
  reworkData: PRReworkData[],
  period: string
): ReworkRateMetrics {
  if (reworkData.length === 0) {
    return {
      period,
      prCount: 0,
      additionalCommits: {
        total: 0,
        avgPerPr: null,
        median: null,
        max: null,
      },
      forcePushes: {
        total: 0,
        avgPerPr: null,
        prsWithForcePush: 0,
        forcePushRate: null,
      },
      prDetails: [],
    };
  }

  // 追加コミット統計
  const additionalCommitCounts = reworkData.map((pr) => pr.additionalCommits);
  const sortedCommitCounts = [...additionalCommitCounts].sort((a, b) => a - b);
  const totalAdditionalCommits = additionalCommitCounts.reduce((sum, count) => sum + count, 0);
  const avgAdditionalCommits = totalAdditionalCommits / reworkData.length;

  // 追加コミットの中央値
  const commitMid = Math.floor(sortedCommitCounts.length / 2);
  const commitMedian =
    sortedCommitCounts.length % 2 !== 0
      ? sortedCommitCounts[commitMid]
      : (sortedCommitCounts[commitMid - 1] + sortedCommitCounts[commitMid]) / 2;

  // Force Push統計
  const forcePushCounts = reworkData.map((pr) => pr.forcePushCount);
  const totalForcePushes = forcePushCounts.reduce((sum, count) => sum + count, 0);
  const prsWithForcePush = reworkData.filter((pr) => pr.forcePushCount > 0).length;
  const avgForcePushes = totalForcePushes / reworkData.length;
  const forcePushRate = (prsWithForcePush / reworkData.length) * 100;

  return {
    period,
    prCount: reworkData.length,
    additionalCommits: {
      total: totalAdditionalCommits,
      avgPerPr: Math.round(avgAdditionalCommits * 10) / 10,
      median: Math.round(commitMedian * 10) / 10,
      max: sortedCommitCounts[sortedCommitCounts.length - 1],
    },
    forcePushes: {
      total: totalForcePushes,
      avgPerPr: Math.round(avgForcePushes * 10) / 10,
      prsWithForcePush,
      forcePushRate: Math.round(forcePushRate * 10) / 10,
    },
    prDetails: reworkData,
  };
}

/**
 * 配列の統計値（平均、中央値、最小値、最大値）を計算するヘルパー
 */
function calculateStats(values: number[]): { avg: number | null; median: number | null; min: number | null; max: number | null } {
  if (values.length === 0) {
    return { avg: null, median: null, min: null, max: null };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const avg = Math.round((sum / values.length) * 10) / 10;

  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 !== 0
      ? Math.round(sorted[mid] * 10) / 10
      : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;

  const min = Math.round(sorted[0] * 10) / 10;
  const max = Math.round(sorted[sorted.length - 1] * 10) / 10;

  return { avg, median, min, max };
}

/**
 * レビュー効率（Review Efficiency）を計算
 *
 * 定義: PRの各フェーズでの滞留時間を測定
 * - レビュー待ち時間: Ready for Review → 最初のレビュー
 * - レビュー時間: 最初のレビュー → 承認
 * - マージ待ち時間: 承認 → マージ
 * - 全体時間: Ready for Review → マージ
 *
 * 長い滞留時間はコードが難解な可能性を示唆
 *
 * @param reviewData - 各PRのレビューデータ配列
 * @param period - 計測期間の表示文字列
 */
export function calculateReviewEfficiency(
  reviewData: PRReviewData[],
  period: string
): ReviewEfficiencyMetrics {
  if (reviewData.length === 0) {
    return {
      period,
      prCount: 0,
      timeToFirstReview: { avgHours: null, medianHours: null, minHours: null, maxHours: null },
      reviewDuration: { avgHours: null, medianHours: null, minHours: null, maxHours: null },
      timeToMerge: { avgHours: null, medianHours: null, minHours: null, maxHours: null },
      totalTime: { avgHours: null, medianHours: null, minHours: null, maxHours: null },
      prDetails: [],
    };
  }

  // 各時間を抽出（nullを除外）
  const timeToFirstReviewValues = reviewData
    .map((pr) => pr.timeToFirstReviewHours)
    .filter((v): v is number => v !== null);

  const reviewDurationValues = reviewData
    .map((pr) => pr.reviewDurationHours)
    .filter((v): v is number => v !== null);

  const timeToMergeValues = reviewData
    .map((pr) => pr.timeToMergeHours)
    .filter((v): v is number => v !== null);

  const totalTimeValues = reviewData
    .map((pr) => pr.totalTimeHours)
    .filter((v): v is number => v !== null);

  // 統計値を計算
  const timeToFirstReviewStats = calculateStats(timeToFirstReviewValues);
  const reviewDurationStats = calculateStats(reviewDurationValues);
  const timeToMergeStats = calculateStats(timeToMergeValues);
  const totalTimeStats = calculateStats(totalTimeValues);

  return {
    period,
    prCount: reviewData.length,
    timeToFirstReview: {
      avgHours: timeToFirstReviewStats.avg,
      medianHours: timeToFirstReviewStats.median,
      minHours: timeToFirstReviewStats.min,
      maxHours: timeToFirstReviewStats.max,
    },
    reviewDuration: {
      avgHours: reviewDurationStats.avg,
      medianHours: reviewDurationStats.median,
      minHours: reviewDurationStats.min,
      maxHours: reviewDurationStats.max,
    },
    timeToMerge: {
      avgHours: timeToMergeStats.avg,
      medianHours: timeToMergeStats.median,
      minHours: timeToMergeStats.min,
      maxHours: timeToMergeStats.max,
    },
    totalTime: {
      avgHours: totalTimeStats.avg,
      medianHours: totalTimeStats.median,
      minHours: totalTimeStats.min,
      maxHours: totalTimeStats.max,
    },
    prDetails: reviewData,
  };
}

/**
 * PRサイズ（PR Size）を計算
 *
 * 定義: PRの変更行数と変更ファイル数を測定
 * 小さいPRほどレビューしやすく、マージが早い傾向がある
 *
 * @param sizeData - 各PRのサイズデータ配列
 * @param period - 計測期間の表示文字列
 */
export function calculatePRSize(
  sizeData: PRSizeData[],
  period: string
): PRSizeMetrics {
  if (sizeData.length === 0) {
    return {
      period,
      prCount: 0,
      linesOfCode: { total: 0, avg: null, median: null, min: null, max: null },
      filesChanged: { total: 0, avg: null, median: null, min: null, max: null },
      prDetails: [],
    };
  }

  // 変更行数の統計
  const locValues = sizeData.map((pr) => pr.linesOfCode);
  const locStats = calculateStats(locValues);
  const locTotal = locValues.reduce((sum, val) => sum + val, 0);

  // 変更ファイル数の統計
  const filesValues = sizeData.map((pr) => pr.filesChanged);
  const filesStats = calculateStats(filesValues);
  const filesTotal = filesValues.reduce((sum, val) => sum + val, 0);

  return {
    period,
    prCount: sizeData.length,
    linesOfCode: {
      total: locTotal,
      avg: locStats.avg,
      median: locStats.median,
      min: locStats.min,
      max: locStats.max,
    },
    filesChanged: {
      total: filesTotal,
      avg: filesStats.avg,
      median: filesStats.median,
      min: filesStats.min,
      max: filesStats.max,
    },
    prDetails: sizeData,
  };
}

/**
 * 開発者満足度（Developer Satisfaction）を計算
 *
 * 定義: Notionタスク完了時に入力された満足度スコア（★1〜5）を集計
 * SPACEフレームワークの「Satisfaction」ディメンションに対応
 *
 * @param tasks - 満足度スコアが入力されているNotionタスクの配列
 * @param period - 計測期間の表示文字列
 */
export function calculateDeveloperSatisfaction(
  tasks: NotionTask[],
  period: string
): DeveloperSatisfactionMetrics {
  // 満足度スコアが入力されているタスクのみ対象
  const validTasks = tasks.filter(
    (task) => task.satisfactionScore !== null && task.completedAt !== null
  );

  if (validTasks.length === 0) {
    return {
      period,
      taskCount: 0,
      satisfaction: {
        avg: null,
        median: null,
        min: null,
        max: null,
        distribution: { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0 },
      },
      taskDetails: [],
    };
  }

  // タスク詳細データを生成
  const taskDetails: TaskSatisfactionData[] = validTasks.map((task) => ({
    taskId: task.id,
    title: task.title,
    assignee: task.assignee,
    completedAt: task.completedAt!,
    satisfactionScore: task.satisfactionScore!,
  }));

  // 満足度スコアの統計を計算
  const scores = validTasks.map((task) => task.satisfactionScore!);
  const stats = calculateStats(scores);

  // 分布を計算
  const distribution = {
    star1: scores.filter((s) => s === 1).length,
    star2: scores.filter((s) => s === 2).length,
    star3: scores.filter((s) => s === 3).length,
    star4: scores.filter((s) => s === 4).length,
    star5: scores.filter((s) => s === 5).length,
  };

  return {
    period,
    taskCount: validTasks.length,
    satisfaction: {
      avg: stats.avg,
      median: stats.median,
      min: stats.min,
      max: stats.max,
      distribution,
    },
    taskDetails,
  };
}
