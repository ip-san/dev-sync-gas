import { getConfig, setConfig, addRepository, removeRepository, getGitHubToken, getGitHubAuthMode, getProductionBranchPattern, setProductionBranchPattern, resetProductionBranchPattern, getCycleTimeIssueLabels, setCycleTimeIssueLabels, resetCycleTimeIssueLabels, getCodingTimeIssueLabels, setCodingTimeIssueLabels, resetCodingTimeIssueLabels, diagnoseConfig, formatDiagnosticResult, getProjects, addProject, updateProject, removeProject, addRepositoryToProject, removeRepositoryFromProject } from "./config/settings";
import "./init";
import { getAllRepositoriesData, DateRange, getPullRequests, getReworkDataForPRs, getReviewEfficiencyDataForPRs, getPRSizeDataForPRs, getCycleTimeData, getCodingTimeData } from "./services/github";
import { writeMetricsToSheet, clearOldData, createSummarySheet, writeCycleTimeToSheet, writeCodingTimeToSheet, writeReworkRateToSheet, writeReviewEfficiencyToSheet, writePRSizeToSheet } from "./services/spreadsheet";
import { calculateMetricsForRepository, calculateCycleTime, calculateCodingTime, calculateReworkRate, calculateReviewEfficiency, calculatePRSize } from "./utils/metrics";
import { initializeContainer, isContainerInitialized, getContainer } from "./container";
import { createGasAdapters } from "./adapters/gas";
import type { DevOpsMetrics, CycleTimeMetrics, GitHubPullRequest } from "./types";
import { ALL_SCHEMAS, findSchemaBySheetName } from "./schemas";
import { getMigrationPreview, migrateSheetSchema, updateSheetHeadersOnly, logMigrationPreview, logMigrationResult, logMigrationSummary, logBackupCleanupInstructions } from "./services/migration";

// GAS環境でコンテナを初期化
function ensureContainerInitialized(): void {
  if (!isContainerInitialized()) {
    initializeContainer(createGasAdapters());
  }
}

/**
 * メイン実行関数 - DevOps指標を収集してスプレッドシートに書き出す
 */
function syncDevOpsMetrics(dateRange?: DateRange): void {
  ensureContainerInitialized();
  const config = getConfig();

  Logger.log(`📊 Repositories: ${config.github.repositories.length}`);
  config.github.repositories.forEach((repo) => {
    Logger.log(`  - ${repo.fullName}`);
  });

  if (dateRange) {
    Logger.log(`📅 Date range: ${dateRange.since?.toISOString()} ~ ${dateRange.until?.toISOString()}`);
  }

  const token = getGitHubToken();
  const { pullRequests, workflowRuns, deployments } = getAllRepositoriesData(
    config.github.repositories,
    token,
    { dateRange }
  );

  Logger.log(`📥 Fetched ${pullRequests.length} PRs, ${workflowRuns.length} workflow runs, ${deployments.length} deployments`);

  const metrics: DevOpsMetrics[] = config.github.repositories.map((repo) =>
    calculateMetricsForRepository(repo.fullName, pullRequests, workflowRuns, deployments)
  );

  Logger.log(`📈 Calculated ${metrics.length} metrics`);

  writeMetricsToSheet(config.spreadsheet.id, config.spreadsheet.sheetName, metrics);

  Logger.log(`✅ Synced metrics for ${metrics.length} repositories`);
}

/**
 * 全プロジェクトグループのDevOps指標を収集
 * 各グループのリポジトリ指標を対応するスプレッドシートに書き出す
 */
function syncAllProjects(dateRange?: DateRange): void {
  ensureContainerInitialized();
  const config = getConfig();
  const projects = config.projects ?? [];

  if (projects.length === 0) {
    Logger.log("⚠️ No projects configured. Using legacy single spreadsheet mode.");
    syncDevOpsMetrics(dateRange);
    return;
  }

  Logger.log(`📊 Syncing ${projects.length} project groups`);

  const token = getGitHubToken();

  for (const project of projects) {
    Logger.log(`\n🔹 Project: ${project.name}`);
    Logger.log(`   Spreadsheet: ${project.spreadsheetId}`);
    Logger.log(`   Repositories: ${project.repositories.length}`);

    if (project.repositories.length === 0) {
      Logger.log(`   ⚠️ No repositories in this project, skipping`);
      continue;
    }

    project.repositories.forEach((repo) => {
      Logger.log(`     - ${repo.fullName}`);
    });

    const { pullRequests, workflowRuns, deployments } = getAllRepositoriesData(
      project.repositories,
      token,
      { dateRange }
    );

    Logger.log(`   📥 Fetched ${pullRequests.length} PRs, ${workflowRuns.length} workflow runs, ${deployments.length} deployments`);

    const metrics: DevOpsMetrics[] = project.repositories.map((repo) =>
      calculateMetricsForRepository(repo.fullName, pullRequests, workflowRuns, deployments)
    );

    writeMetricsToSheet(project.spreadsheetId, project.sheetName, metrics);

    Logger.log(`   ✅ Synced metrics for ${metrics.length} repositories`);
  }

  Logger.log(`\n✅ All ${projects.length} projects synced`);
}

/**
 * 指定したプロジェクトのDevOps指標を収集
 */
function syncProject(projectName: string, dateRange?: DateRange): void {
  ensureContainerInitialized();
  const projects = getProjects();
  const project = projects.find((p) => p.name === projectName);

  if (!project) {
    Logger.log(`❌ Project "${projectName}" not found`);
    return;
  }

  Logger.log(`📊 Syncing project: ${project.name}`);
  Logger.log(`   Spreadsheet: ${project.spreadsheetId}`);
  Logger.log(`   Repositories: ${project.repositories.length}`);

  if (project.repositories.length === 0) {
    Logger.log(`   ⚠️ No repositories in this project`);
    return;
  }

  const token = getGitHubToken();
  const { pullRequests, workflowRuns, deployments } = getAllRepositoriesData(
    project.repositories,
    token,
    { dateRange }
  );

  const metrics: DevOpsMetrics[] = project.repositories.map((repo) =>
    calculateMetricsForRepository(repo.fullName, pullRequests, workflowRuns, deployments)
  );

  writeMetricsToSheet(project.spreadsheetId, project.sheetName, metrics);

  Logger.log(`✅ Synced metrics for ${metrics.length} repositories`);
}

/**
 * 過去N日分のメトリクスを取得
 */
function syncHistoricalMetrics(days: number): void {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);

  Logger.log(`📅 Fetching metrics for the last ${days} days`);
  Logger.log(`   From: ${since.toISOString()}`);
  Logger.log(`   To: ${until.toISOString()}`);

  syncDevOpsMetrics({ since, until });
}

/**
 * 全プロジェクトの過去N日分のメトリクスを取得
 */
function syncAllProjectsHistorical(days: number): void {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);

  Logger.log(`📅 Fetching metrics for the last ${days} days`);
  Logger.log(`   From: ${since.toISOString()}`);
  Logger.log(`   To: ${until.toISOString()}`);

  syncAllProjects({ since, until });
}

/**
 * 過去30日分を取得
 */
function syncLast30Days(): void {
  syncHistoricalMetrics(30);
}

/**
 * 過去90日分を取得
 */
function syncLast90Days(): void {
  syncHistoricalMetrics(90);
}

/**
 * 日次実行用トリガー設定
 */
function createDailyTrigger(): void {
  ensureContainerInitialized();
  const { triggerClient, logger } = getContainer();

  // 既存のトリガーを削除
  const triggers = triggerClient.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "syncDevOpsMetrics") {
      triggerClient.deleteTrigger(trigger);
    }
  }

  // 毎日午前9時に実行
  triggerClient.newTrigger("syncDevOpsMetrics")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  logger.log("✅ Daily trigger created for 9:00 AM");
}

/**
 * 初期セットアップ（PAT認証） - スクリプトプロパティを設定
 */
function setup(
  githubToken: string,
  spreadsheetId: string
): void {
  ensureContainerInitialized();
  setConfig({
    github: { token: githubToken, repositories: [] },
    spreadsheet: { id: spreadsheetId, sheetName: "DevOps Metrics" },
  });

  Logger.log("✅ Configuration saved (PAT auth). Add repositories with addRepo()");
}

/**
 * GitHub Apps認証用セットアップ
 *
 * @param appId - GitHub App ID
 * @param privateKey - Private Key（PEM形式、改行は\nで）
 * @param installationId - Installation ID
 * @param spreadsheetId - Google Spreadsheet ID
 */
function setupWithGitHubApp(
  appId: string,
  privateKey: string,
  installationId: string,
  spreadsheetId: string
): void {
  ensureContainerInitialized();
  setConfig({
    github: {
      appConfig: { appId, privateKey, installationId },
      repositories: [],
    },
    spreadsheet: { id: spreadsheetId, sheetName: "DevOps Metrics" },
  });

  Logger.log("✅ Configuration saved (GitHub App auth). Add repositories with addRepo()");
}

/**
 * 現在の認証モードを表示
 */
function showAuthMode(): void {
  ensureContainerInitialized();
  const mode = getGitHubAuthMode();

  if (mode === "app") {
    Logger.log("🔐 Current auth mode: GitHub App");
  } else if (mode === "pat") {
    Logger.log("🔐 Current auth mode: Personal Access Token (PAT)");
  } else {
    Logger.log("⚠️ GitHub authentication is not configured");
  }
}

/**
 * リポジトリ追加のラッパー
 */
function addRepo(owner: string, name: string): void {
  ensureContainerInitialized();
  addRepository(owner, name);
  Logger.log(`✅ Added repository: ${owner}/${name}`);
}

/**
 * リポジトリ削除のラッパー
 */
function removeRepo(fullName: string): void {
  ensureContainerInitialized();
  removeRepository(fullName);
  Logger.log(`✅ Removed repository: ${fullName}`);
}

/**
 * 登録済みリポジトリ一覧を表示
 */
function listRepos(): void {
  ensureContainerInitialized();
  const config = getConfig();
  Logger.log("Registered repositories:");
  config.github.repositories.forEach((repo, i) => {
    Logger.log(`  ${i + 1}. ${repo.fullName}`);
  });
}

/**
 * 古いデータのクリーンアップ
 */
function cleanup(daysToKeep = 90): void {
  ensureContainerInitialized();
  const config = getConfig();
  clearOldData(config.spreadsheet.id, config.spreadsheet.sheetName, daysToKeep);
  Logger.log(`✅ Cleaned up data older than ${daysToKeep} days`);
}

/**
 * サマリーシートを作成
 */
function generateSummary(): void {
  ensureContainerInitialized();
  const config = getConfig();
  createSummarySheet(config.spreadsheet.id, config.spreadsheet.sheetName);
  Logger.log("✅ Summary sheet created");
}

/**
 * サイクルタイムを計算してスプレッドシートに書き出す
 *
 * 定義:
 * - 着手日: Issue作成日時
 * - 完了日: productionブランチへのPRマージ日時
 *
 * @param days - 計測期間（日数）デフォルト30日
 */
function syncCycleTime(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured. Set githubToken in setup() or configure GitHub App");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured. Add repositories with addRepo()");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const period = `${startDateStr}〜${endDateStr}`;

  const productionPattern = getProductionBranchPattern();
  const labels = getCycleTimeIssueLabels();

  Logger.log(`⏱️ Calculating Cycle Time for ${days} days`);
  Logger.log(`   Period: ${period}`);
  Logger.log(`   Production branch pattern: "${productionPattern}"`);
  if (labels.length > 0) {
    Logger.log(`   Issue labels: ${labels.join(", ")}`);
  } else {
    Logger.log(`   Issue labels: (all issues)`);
  }

  // サイクルタイムデータを取得
  const cycleTimeResult = getCycleTimeData(
    config.github.repositories,
    token,
    {
      dateRange: {
        start: startDateStr,
        end: endDateStr,
      },
      productionBranchPattern: productionPattern,
      labels: labels.length > 0 ? labels : undefined,
    }
  );

  if (!cycleTimeResult.success || !cycleTimeResult.data) {
    Logger.log(`❌ Failed to fetch cycle time data: ${cycleTimeResult.error}`);
    return;
  }

  Logger.log(`📥 Fetched ${cycleTimeResult.data.length} issues`);

  // メトリクス計算
  const cycleTimeMetrics = calculateCycleTime(cycleTimeResult.data, period);

  Logger.log(`📊 Cycle Time Results:`);
  Logger.log(`   Issues with production merge: ${cycleTimeMetrics.completedTaskCount}`);
  if (cycleTimeMetrics.avgCycleTimeHours !== null) {
    Logger.log(`   Average: ${cycleTimeMetrics.avgCycleTimeHours} hours (${(cycleTimeMetrics.avgCycleTimeHours / 24).toFixed(1)} days)`);
    Logger.log(`   Median: ${cycleTimeMetrics.medianCycleTimeHours} hours`);
    Logger.log(`   Min: ${cycleTimeMetrics.minCycleTimeHours} hours`);
    Logger.log(`   Max: ${cycleTimeMetrics.maxCycleTimeHours} hours`);
  }

  writeCycleTimeToSheet(config.spreadsheet.id, cycleTimeMetrics);

  Logger.log("✅ Cycle Time metrics synced");
}

/**
 * サイクルタイムのIssue詳細を表示（デバッグ用）
 */
function showCycleTimeDetails(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  const productionPattern = getProductionBranchPattern();
  const labels = getCycleTimeIssueLabels();

  const cycleTimeResult = getCycleTimeData(
    config.github.repositories,
    token,
    {
      dateRange: {
        start: startDateStr,
        end: endDateStr,
      },
      productionBranchPattern: productionPattern,
      labels: labels.length > 0 ? labels : undefined,
    }
  );

  if (!cycleTimeResult.success || !cycleTimeResult.data) {
    Logger.log(`❌ Failed to fetch cycle time data: ${cycleTimeResult.error}`);
    return;
  }

  const cycleTimeMetrics = calculateCycleTime(cycleTimeResult.data, `${startDateStr}〜${endDateStr}`);

  Logger.log(`\n📋 Issue Details (${cycleTimeMetrics.completedTaskCount} issues with production merge):\n`);
  cycleTimeMetrics.issueDetails.forEach((issue, i) => {
    const daysValue = (issue.cycleTimeHours / 24).toFixed(1);
    Logger.log(`${i + 1}. #${issue.issueNumber}: ${issue.title}`);
    Logger.log(`   Repository: ${issue.repository}`);
    Logger.log(`   Issue Created: ${issue.issueCreatedAt}`);
    Logger.log(`   Production Merged: ${issue.productionMergedAt}`);
    Logger.log(`   Cycle Time: ${issue.cycleTimeHours} hours (${daysValue} days)`);
    Logger.log(`   PR Chain: ${issue.prChainSummary}\n`);
  });
}

/**
 * コーディング時間を計算してスプレッドシートに書き出す
 *
 * 定義:
 * - 着手日: Issue作成日時
 * - コーディング完了日: リンクされたPR作成日時
 *
 * @param days - 計測期間（日数）デフォルト30日
 */
function syncCodingTime(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured. Set githubToken in setup() or configure GitHub App");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured. Add repositories with addRepo()");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const period = `${startDateStr}〜${endDateStr}`;

  const labels = getCodingTimeIssueLabels();

  Logger.log(`⌨️ Calculating Coding Time for ${days} days`);
  Logger.log(`   Period: ${period}`);
  if (labels.length > 0) {
    Logger.log(`   Issue labels: ${labels.join(", ")}`);
  } else {
    Logger.log(`   Issue labels: (all issues)`);
  }

  // コーディングタイムデータを取得
  const codingTimeResult = getCodingTimeData(
    config.github.repositories,
    token,
    {
      dateRange: {
        start: startDateStr,
        end: endDateStr,
      },
      labels: labels.length > 0 ? labels : undefined,
    }
  );

  if (!codingTimeResult.success || !codingTimeResult.data) {
    Logger.log(`❌ Failed to fetch coding time data: ${codingTimeResult.error}`);
    return;
  }

  Logger.log(`📥 Fetched ${codingTimeResult.data.length} issues`);

  // メトリクス計算
  const codingTimeMetrics = calculateCodingTime(codingTimeResult.data, period);

  Logger.log(`📊 Coding Time Results:`);
  Logger.log(`   Issues with linked PRs: ${codingTimeMetrics.issueCount}`);
  if (codingTimeMetrics.avgCodingTimeHours !== null) {
    Logger.log(`   Average: ${codingTimeMetrics.avgCodingTimeHours} hours (${(codingTimeMetrics.avgCodingTimeHours / 24).toFixed(1)} days)`);
    Logger.log(`   Median: ${codingTimeMetrics.medianCodingTimeHours} hours`);
    Logger.log(`   Min: ${codingTimeMetrics.minCodingTimeHours} hours`);
    Logger.log(`   Max: ${codingTimeMetrics.maxCodingTimeHours} hours`);
  }

  writeCodingTimeToSheet(config.spreadsheet.id, codingTimeMetrics);

  Logger.log("✅ Coding Time metrics synced");
}

/**
 * コーディング時間のIssue詳細を表示（デバッグ用）
 */
function showCodingTimeDetails(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];

  const labels = getCodingTimeIssueLabels();

  const codingTimeResult = getCodingTimeData(
    config.github.repositories,
    token,
    {
      dateRange: {
        start: startDateStr,
        end: endDateStr,
      },
      labels: labels.length > 0 ? labels : undefined,
    }
  );

  if (!codingTimeResult.success || !codingTimeResult.data) {
    Logger.log(`❌ Failed to fetch coding time data: ${codingTimeResult.error}`);
    return;
  }

  const codingTimeMetrics = calculateCodingTime(codingTimeResult.data, `${startDateStr}〜${endDateStr}`);

  Logger.log(`\n📋 Coding Time Details (${codingTimeMetrics.issueCount} issues with linked PRs):\n`);
  codingTimeMetrics.issueDetails.forEach((issue, i) => {
    const daysValue = (issue.codingTimeHours / 24).toFixed(1);
    Logger.log(`${i + 1}. #${issue.issueNumber}: ${issue.title}`);
    Logger.log(`   Repository: ${issue.repository}`);
    Logger.log(`   Issue Created: ${issue.issueCreatedAt}`);
    Logger.log(`   PR #${issue.prNumber} Created: ${issue.prCreatedAt}`);
    Logger.log(`   Coding Time: ${issue.codingTimeHours} hours (${daysValue} days)\n`);
  });
}

/**
 * 手戻り率を計算してスプレッドシートに書き出す
 *
 * 定義: PR作成後の追加コミット数とForce Push回数
 * コードレビューでの指摘対応やコード品質の指標
 *
 * @param days - 計測期間（日数）デフォルト30日
 */
function syncReworkRate(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured. Set githubToken in setup() or configure GitHub App");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured. Add repositories with addRepo()");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const period = `${startDateStr}〜${endDateStr}`;

  Logger.log(`🔄 Calculating Rework Rate for ${days} days`);
  Logger.log(`   Period: ${period}`);

  // 全リポジトリからPRを取得
  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    Logger.log(`📡 Fetching PRs from ${repo.fullName}...`);
    const prsResult = getPullRequests(repo, token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      // マージ済みPRのみを対象とする
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
      Logger.log(`   Found ${mergedPRs.length} merged PRs`);
    } else {
      Logger.log(`   ⚠️ Failed to fetch PRs: ${prsResult.error}`);
    }
  }

  if (allPRs.length === 0) {
    Logger.log("⚠️ No merged PRs found in the period");
    return;
  }

  Logger.log(`📊 Fetching rework data for ${allPRs.length} PRs...`);
  const reworkData = getReworkDataForPRs(allPRs, token);

  const reworkMetrics = calculateReworkRate(reworkData, period);

  Logger.log(`📊 Rework Rate Results:`);
  Logger.log(`   PRs analyzed: ${reworkMetrics.prCount}`);
  Logger.log(`   Additional Commits: total=${reworkMetrics.additionalCommits.total}, avg=${reworkMetrics.additionalCommits.avgPerPr}`);
  Logger.log(`   Force Pushes: total=${reworkMetrics.forcePushes.total}, rate=${reworkMetrics.forcePushes.forcePushRate}%`);

  writeReworkRateToSheet(config.spreadsheet.id, reworkMetrics);

  Logger.log("✅ Rework Rate metrics synced");
}

/**
 * 手戻り率のPR詳細を表示（デバッグ用）
 */
function showReworkRateDetails(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    const prsResult = getPullRequests(repo, token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
    }
  }

  const reworkData = getReworkDataForPRs(allPRs, token);
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const reworkMetrics = calculateReworkRate(reworkData, `${startDateStr}〜${endDateStr}`);

  Logger.log(`\n📋 Rework Rate Details (${reworkMetrics.prCount} PRs):\n`);
  reworkMetrics.prDetails.forEach((pr, i) => {
    Logger.log(`${i + 1}. PR #${pr.prNumber}: ${pr.title}`);
    Logger.log(`   Repository: ${pr.repository}`);
    Logger.log(`   Commits: ${pr.totalCommits} total, ${pr.additionalCommits} additional`);
    Logger.log(`   Force Pushes: ${pr.forcePushCount}\n`);
  });
}

/**
 * レビュー効率を計算してスプレッドシートに書き出す
 *
 * 定義: PRの各フェーズでの滞留時間
 * - レビュー待ち時間: Ready for Review → 最初のレビュー
 * - レビュー時間: 最初のレビュー → 承認（長い = コードが難解な可能性）
 * - マージ待ち時間: 承認 → マージ
 *
 * @param days - 計測期間（日数）デフォルト30日
 */
function syncReviewEfficiency(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured. Set githubToken in setup() or configure GitHub App");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured. Add repositories with addRepo()");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const period = `${startDateStr}〜${endDateStr}`;

  Logger.log(`⏱️ Calculating Review Efficiency for ${days} days`);
  Logger.log(`   Period: ${period}`);

  // 全リポジトリからPRを取得
  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    Logger.log(`📡 Fetching PRs from ${repo.fullName}...`);
    const prsResult = getPullRequests(repo, token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      // マージ済みPRのみを対象とする
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
      Logger.log(`   Found ${mergedPRs.length} merged PRs`);
    } else {
      Logger.log(`   ⚠️ Failed to fetch PRs: ${prsResult.error}`);
    }
  }

  if (allPRs.length === 0) {
    Logger.log("⚠️ No merged PRs found in the period");
    return;
  }

  Logger.log(`📊 Fetching review data for ${allPRs.length} PRs...`);
  const reviewData = getReviewEfficiencyDataForPRs(allPRs, token);

  const reviewMetrics = calculateReviewEfficiency(reviewData, period);

  Logger.log(`📊 Review Efficiency Results:`);
  Logger.log(`   PRs analyzed: ${reviewMetrics.prCount}`);
  Logger.log(`   Time to First Review: avg=${reviewMetrics.timeToFirstReview.avgHours}h, median=${reviewMetrics.timeToFirstReview.medianHours}h`);
  Logger.log(`   Review Duration: avg=${reviewMetrics.reviewDuration.avgHours}h, median=${reviewMetrics.reviewDuration.medianHours}h`);
  Logger.log(`   Time to Merge: avg=${reviewMetrics.timeToMerge.avgHours}h, median=${reviewMetrics.timeToMerge.medianHours}h`);
  Logger.log(`   Total Time: avg=${reviewMetrics.totalTime.avgHours}h, median=${reviewMetrics.totalTime.medianHours}h`);

  writeReviewEfficiencyToSheet(config.spreadsheet.id, reviewMetrics);

  Logger.log("✅ Review Efficiency metrics synced");
}

/**
 * レビュー効率のPR詳細を表示（デバッグ用）
 */
function showReviewEfficiencyDetails(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    const prsResult = getPullRequests(repo, token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
    }
  }

  const reviewData = getReviewEfficiencyDataForPRs(allPRs, token);
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const reviewMetrics = calculateReviewEfficiency(reviewData, `${startDateStr}〜${endDateStr}`);

  Logger.log(`\n📋 Review Efficiency Details (${reviewMetrics.prCount} PRs):\n`);
  reviewMetrics.prDetails.forEach((pr, i) => {
    Logger.log(`${i + 1}. PR #${pr.prNumber}: ${pr.title}`);
    Logger.log(`   Repository: ${pr.repository}`);
    Logger.log(`   Ready for Review: ${pr.readyForReviewAt}`);
    Logger.log(`   First Review: ${pr.firstReviewAt ?? "N/A"}`);
    Logger.log(`   Approved: ${pr.approvedAt ?? "N/A"}`);
    Logger.log(`   Merged: ${pr.mergedAt ?? "Not merged"}`);
    Logger.log(`   Time to First Review: ${pr.timeToFirstReviewHours ?? "N/A"}h`);
    Logger.log(`   Review Duration: ${pr.reviewDurationHours ?? "N/A"}h`);
    Logger.log(`   Time to Merge: ${pr.timeToMergeHours ?? "N/A"}h`);
    Logger.log(`   Total Time: ${pr.totalTimeHours ?? "N/A"}h\n`);
  });
}

/**
 * PRサイズを計算してスプレッドシートに書き出す
 *
 * 定義: PRの変更行数（additions + deletions）と変更ファイル数
 * 小さいPRほどレビューしやすく、マージが早い傾向がある
 *
 * @param days - 計測期間（日数）デフォルト30日
 */
function syncPRSize(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured. Set githubToken in setup() or configure GitHub App");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured. Add repositories with addRepo()");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const period = `${startDateStr}〜${endDateStr}`;

  Logger.log(`📏 Calculating PR Size for ${days} days`);
  Logger.log(`   Period: ${period}`);

  // 全リポジトリからPRを取得
  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    Logger.log(`📡 Fetching PRs from ${repo.fullName}...`);
    const prsResult = getPullRequests(repo, token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      // マージ済みPRのみを対象とする
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
      Logger.log(`   Found ${mergedPRs.length} merged PRs`);
    } else {
      Logger.log(`   ⚠️ Failed to fetch PRs: ${prsResult.error}`);
    }
  }

  if (allPRs.length === 0) {
    Logger.log("⚠️ No merged PRs found in the period");
    return;
  }

  Logger.log(`📊 Fetching PR size data for ${allPRs.length} PRs...`);
  const sizeData = getPRSizeDataForPRs(allPRs, token);

  const sizeMetrics = calculatePRSize(sizeData, period);

  Logger.log(`📊 PR Size Results:`);
  Logger.log(`   PRs analyzed: ${sizeMetrics.prCount}`);
  Logger.log(`   Lines of Code: total=${sizeMetrics.linesOfCode.total}, avg=${sizeMetrics.linesOfCode.avg}, median=${sizeMetrics.linesOfCode.median}, min=${sizeMetrics.linesOfCode.min}, max=${sizeMetrics.linesOfCode.max}`);
  Logger.log(`   Files Changed: total=${sizeMetrics.filesChanged.total}, avg=${sizeMetrics.filesChanged.avg}, median=${sizeMetrics.filesChanged.median}, min=${sizeMetrics.filesChanged.min}, max=${sizeMetrics.filesChanged.max}`);

  writePRSizeToSheet(config.spreadsheet.id, sizeMetrics);

  Logger.log("✅ PR Size metrics synced");
}

/**
 * PRサイズの詳細を表示（デバッグ用）
 */
function showPRSizeDetails(days: number = 30): void {
  ensureContainerInitialized();
  const config = getConfig();

  if (getGitHubAuthMode() === "none") {
    Logger.log("⚠️ GitHub authentication is not configured");
    return;
  }

  if (config.github.repositories.length === 0) {
    Logger.log("⚠️ No repositories configured");
    return;
  }

  const token = getGitHubToken();
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const allPRs: GitHubPullRequest[] = [];
  for (const repo of config.github.repositories) {
    const prsResult = getPullRequests(repo, token, "all", {
      since: startDate,
      until: endDate,
    });

    if (prsResult.success && prsResult.data) {
      const mergedPRs = prsResult.data.filter((pr) => pr.mergedAt !== null);
      allPRs.push(...mergedPRs);
    }
  }

  const sizeData = getPRSizeDataForPRs(allPRs, token);
  const startDateStr = startDate.toISOString().split("T")[0];
  const endDateStr = endDate.toISOString().split("T")[0];
  const sizeMetrics = calculatePRSize(sizeData, `${startDateStr}〜${endDateStr}`);

  Logger.log(`\n📋 PR Size Details (${sizeMetrics.prCount} PRs):\n`);
  sizeMetrics.prDetails.forEach((pr, i) => {
    Logger.log(`${i + 1}. PR #${pr.prNumber}: ${pr.title}`);
    Logger.log(`   Repository: ${pr.repository}`);
    Logger.log(`   Lines of Code: ${pr.linesOfCode} (+${pr.additions}/-${pr.deletions})`);
    Logger.log(`   Files Changed: ${pr.filesChanged}`);
    Logger.log(`   Merged: ${pr.mergedAt ?? "Not merged"}\n`);
  });
}

/**
 * 権限テスト用関数 - 初回実行で承認ダイアログを表示
 */
function testPermissions(): void {
  // 外部リクエスト権限のテスト
  const response = UrlFetchApp.fetch("https://api.github.com", {
    muteHttpExceptions: true,
  });
  Logger.log(`GitHub API status: ${response.getResponseCode()}`);

  // スプレッドシート権限のテスト
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheet.id);
  Logger.log(`Spreadsheet name: ${spreadsheet.getName()}`);

  Logger.log("✅ All permissions granted!");
}

// GASグローバルスコープにエクスポート
declare const global: any;
global.syncDevOpsMetrics = syncDevOpsMetrics;
global.syncAllProjects = syncAllProjects;
global.syncProject = syncProject;
global.syncHistoricalMetrics = syncHistoricalMetrics;
global.syncAllProjectsHistorical = syncAllProjectsHistorical;
global.syncLast30Days = syncLast30Days;
global.syncLast90Days = syncLast90Days;
global.testPermissions = testPermissions;
global.createDailyTrigger = createDailyTrigger;
global.setup = setup;
global.setupWithGitHubApp = setupWithGitHubApp;
global.showAuthMode = showAuthMode;
global.addRepo = addRepo;
global.removeRepo = removeRepo;
global.listRepos = listRepos;
global.cleanup = cleanup;
global.generateSummary = generateSummary;
global.syncCycleTime = syncCycleTime;
global.showCycleTimeDetails = showCycleTimeDetails;
global.syncCodingTime = syncCodingTime;
global.showCodingTimeDetails = showCodingTimeDetails;
global.syncReworkRate = syncReworkRate;
global.showReworkRateDetails = showReworkRateDetails;
global.syncReviewEfficiency = syncReviewEfficiency;
global.showReviewEfficiencyDetails = showReviewEfficiencyDetails;
global.syncPRSize = syncPRSize;
global.showPRSizeDetails = showPRSizeDetails;

// =============================================================================
// サイクルタイム設定関数
// =============================================================================

/**
 * productionブランチパターンを設定
 * このパターンを含むブランチへのマージをproductionリリースとみなす
 *
 * @example
 * // "xxx_production" にマッチ
 * configureProductionBranch("production");
 *
 * // "release" ブランチにマッチ
 * configureProductionBranch("release");
 */
function configureProductionBranch(pattern: string): void {
  ensureContainerInitialized();
  setProductionBranchPattern(pattern);
  Logger.log(`✅ Production branch pattern set to: "${pattern}"`);
}

/**
 * 現在のproductionブランチパターンを表示
 */
function showProductionBranch(): void {
  ensureContainerInitialized();
  const pattern = getProductionBranchPattern();
  Logger.log(`📋 Production branch pattern: "${pattern}"`);
}

/**
 * productionブランチパターンをリセット
 */
function resetProductionBranch(): void {
  ensureContainerInitialized();
  resetProductionBranchPattern();
  Logger.log('✅ Production branch pattern reset to: "production"');
}

/**
 * サイクルタイム計測対象のIssueラベルを設定
 * 空配列を設定すると全Issueが対象になる
 *
 * @example
 * // "feature" と "enhancement" ラベルを持つIssueのみ計測
 * configureCycleTimeLabels(["feature", "enhancement"]);
 *
 * // 全Issueを対象にする
 * configureCycleTimeLabels([]);
 */
function configureCycleTimeLabels(labels: string[]): void {
  ensureContainerInitialized();
  setCycleTimeIssueLabels(labels);
  if (labels.length > 0) {
    Logger.log(`✅ Cycle time labels set to: ${labels.join(", ")}`);
  } else {
    Logger.log("✅ Cycle time labels cleared (all issues will be tracked)");
  }
}

/**
 * 現在のサイクルタイムIssueラベルを表示
 */
function showCycleTimeLabels(): void {
  ensureContainerInitialized();
  const labels = getCycleTimeIssueLabels();
  if (labels.length > 0) {
    Logger.log(`📋 Cycle time labels: ${labels.join(", ")}`);
  } else {
    Logger.log("📋 Cycle time labels: (all issues)");
  }
}

/**
 * サイクルタイムIssueラベルをリセット（全Issue対象に戻す）
 */
function resetCycleTimeLabelsConfig(): void {
  ensureContainerInitialized();
  resetCycleTimeIssueLabels();
  Logger.log("✅ Cycle time labels reset (all issues will be tracked)");
}

/**
 * サイクルタイム設定を一覧表示
 */
function showCycleTimeConfig(): void {
  ensureContainerInitialized();
  Logger.log("📋 Cycle Time Configuration:");
  Logger.log(`   Production branch pattern: "${getProductionBranchPattern()}"`);
  const labels = getCycleTimeIssueLabels();
  if (labels.length > 0) {
    Logger.log(`   Issue labels: ${labels.join(", ")}`);
  } else {
    Logger.log("   Issue labels: (all issues)");
  }
}

global.configureProductionBranch = configureProductionBranch;
global.showProductionBranch = showProductionBranch;
global.resetProductionBranch = resetProductionBranch;
global.configureCycleTimeLabels = configureCycleTimeLabels;
global.showCycleTimeLabels = showCycleTimeLabels;
global.resetCycleTimeLabelsConfig = resetCycleTimeLabelsConfig;
global.showCycleTimeConfig = showCycleTimeConfig;

// =============================================================================
// コーディングタイム設定関数
// =============================================================================

/**
 * コーディングタイム計測対象のIssueラベルを設定
 * 空配列を設定すると全Issueが対象になる
 *
 * @example
 * // "feature" と "enhancement" ラベルを持つIssueのみ計測
 * configureCodingTimeLabels(["feature", "enhancement"]);
 *
 * // 全Issueを対象にする
 * configureCodingTimeLabels([]);
 */
function configureCodingTimeLabels(labels: string[]): void {
  ensureContainerInitialized();
  setCodingTimeIssueLabels(labels);
  if (labels.length > 0) {
    Logger.log(`✅ Coding time labels set to: ${labels.join(", ")}`);
  } else {
    Logger.log("✅ Coding time labels cleared (all issues will be tracked)");
  }
}

/**
 * 現在のコーディングタイムIssueラベルを表示
 */
function showCodingTimeLabels(): void {
  ensureContainerInitialized();
  const labels = getCodingTimeIssueLabels();
  if (labels.length > 0) {
    Logger.log(`📋 Coding time labels: ${labels.join(", ")}`);
  } else {
    Logger.log("📋 Coding time labels: (all issues)");
  }
}

/**
 * コーディングタイムIssueラベルをリセット（全Issue対象に戻す）
 */
function resetCodingTimeLabelsConfig(): void {
  ensureContainerInitialized();
  resetCodingTimeIssueLabels();
  Logger.log("✅ Coding time labels reset (all issues will be tracked)");
}

/**
 * コーディングタイム設定を一覧表示
 */
function showCodingTimeConfig(): void {
  ensureContainerInitialized();
  Logger.log("📋 Coding Time Configuration:");
  const labels = getCodingTimeIssueLabels();
  if (labels.length > 0) {
    Logger.log(`   Issue labels: ${labels.join(", ")}`);
  } else {
    Logger.log("   Issue labels: (all issues)");
  }
}

global.configureCodingTimeLabels = configureCodingTimeLabels;
global.showCodingTimeLabels = showCodingTimeLabels;
global.resetCodingTimeLabelsConfig = resetCodingTimeLabelsConfig;
global.showCodingTimeConfig = showCodingTimeConfig;

// =============================================================================
// スキーママイグレーション関数
// =============================================================================

/**
 * 全シートのマイグレーションをプレビュー（ドライラン）
 * 実際の変更は行わず、何が変更されるかをログ出力する
 */
function previewMigration(): void {
  ensureContainerInitialized();
  const config = getConfig();
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(config.spreadsheet.id);

  logger.log("=== Schema Migration Preview ===");
  logger.log("This is a dry run. No changes will be made.\n");

  for (const schema of ALL_SCHEMAS) {
    const preview = getMigrationPreview(spreadsheet, schema);
    logMigrationPreview(preview);
  }

  logger.log("\nTo apply migrations, run: migrateAllSchemas()");
}

/**
 * 全シートのスキーママイグレーションを実行
 */
function migrateAllSchemas(): void {
  ensureContainerInitialized();
  const config = getConfig();
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(config.spreadsheet.id);

  logger.log("=== Starting Schema Migration ===\n");

  const results = ALL_SCHEMAS.map((schema) => {
    logger.log(`Migrating: ${schema.sheetName}...`);
    const result = migrateSheetSchema(spreadsheet, schema);
    logMigrationResult(result);
    return result;
  });

  logMigrationSummary(results);
}

/**
 * 特定のシートのみマイグレーションを実行
 */
function migrateSheet(sheetName: string): void {
  ensureContainerInitialized();
  const config = getConfig();
  const { spreadsheetClient, logger } = getContainer();

  const schema = findSchemaBySheetName(sheetName);
  if (!schema) {
    logger.log(`❌ Error: Unknown sheet name: ${sheetName}`);
    logger.log("Available sheets:");
    ALL_SCHEMAS.forEach((s) => logger.log(`  - ${s.sheetName}`));
    return;
  }

  const spreadsheet = spreadsheetClient.openById(config.spreadsheet.id);
  const result = migrateSheetSchema(spreadsheet, schema);
  logMigrationResult(result);
}

/**
 * ヘッダー行のみを最新に更新（データの列順は変更しない）
 * より安全なオプション
 */
function updateHeadersOnly(): void {
  ensureContainerInitialized();
  const config = getConfig();
  const { spreadsheetClient, logger } = getContainer();
  const spreadsheet = spreadsheetClient.openById(config.spreadsheet.id);

  logger.log("=== Updating Headers Only ===\n");

  const results = ALL_SCHEMAS.map((schema) => {
    logger.log(`Updating headers: ${schema.sheetName}...`);
    const result = updateSheetHeadersOnly(spreadsheet, schema);
    logMigrationResult(result);
    return result;
  });

  logMigrationSummary(results);
}

/**
 * バックアップシートの削除方法を表示
 */
function showBackupCleanupHelp(): void {
  ensureContainerInitialized();
  logBackupCleanupInstructions();
}

global.previewMigration = previewMigration;
global.migrateAllSchemas = migrateAllSchemas;
global.migrateSheet = migrateSheet;
global.updateHeadersOnly = updateHeadersOnly;
global.showBackupCleanupHelp = showBackupCleanupHelp;

// =============================================================================
// 設定診断関数
// =============================================================================

/**
 * 設定状況を診断して問題を報告する
 * 設定ミスがあった場合、何が問題でどう修正すべきかを分かりやすく表示
 *
 * @example
 * // GASエディタで実行
 * checkConfig();
 *
 * // 出力例:
 * // === DevSyncGAS 設定診断 ===
 * // ✅ Spreadsheet ID: 設定済み: 1234567890...
 * // ❌ GitHub認証: GitHub認証が設定されていません
 * //    → setup('GITHUB_TOKEN', 'SPREADSHEET_ID') でPAT認証を設定してください
 * // ⚠️ リポジトリ: リポジトリが登録されていません
 * //    → addRepo('owner', 'repo-name') でリポジトリを追加してください
 */
function checkConfig(): void {
  ensureContainerInitialized();
  const result = diagnoseConfig();
  const formatted = formatDiagnosticResult(result);
  Logger.log(formatted);
}

global.checkConfig = checkConfig;

// =============================================================================
// プロジェクトグループ管理関数
// =============================================================================

/**
 * プロジェクトグループを作成
 * @param name - グループ名
 * @param spreadsheetId - 出力先スプレッドシートID
 * @param sheetName - シート名（省略時: "DevOps Metrics"）
 */
function createProject(name: string, spreadsheetId: string, sheetName = "DevOps Metrics"): void {
  ensureContainerInitialized();
  addProject({
    name,
    spreadsheetId,
    sheetName,
    repositories: [],
  });
  Logger.log(`✅ Project "${name}" created`);
  Logger.log(`   Spreadsheet: ${spreadsheetId}`);
  Logger.log(`   Sheet: ${sheetName}`);
}

/**
 * プロジェクトグループを削除
 */
function deleteProject(name: string): void {
  ensureContainerInitialized();
  removeProject(name);
  Logger.log(`✅ Project "${name}" deleted`);
}

/**
 * プロジェクト一覧を表示
 */
function listProjects(): void {
  ensureContainerInitialized();
  const projects = getProjects();

  if (projects.length === 0) {
    Logger.log("📋 No projects configured");
    Logger.log("   Use createProject(name, spreadsheetId) to create one");
    return;
  }

  Logger.log(`📋 Projects: ${projects.length}`);
  for (const project of projects) {
    Logger.log(`\n🔹 ${project.name}`);
    Logger.log(`   Spreadsheet: ${project.spreadsheetId}`);
    Logger.log(`   Sheet: ${project.sheetName}`);
    Logger.log(`   Repositories: ${project.repositories.length}`);
    project.repositories.forEach((repo) => {
      Logger.log(`     - ${repo.fullName}`);
    });
  }
}

/**
 * プロジェクトにリポジトリを追加
 */
function addRepoToProject(projectName: string, owner: string, repoName: string): void {
  ensureContainerInitialized();
  addRepositoryToProject(projectName, owner, repoName);
  Logger.log(`✅ Repository "${owner}/${repoName}" added to project "${projectName}"`);
}

/**
 * プロジェクトからリポジトリを削除
 */
function removeRepoFromProject(projectName: string, fullName: string): void {
  ensureContainerInitialized();
  removeRepositoryFromProject(projectName, fullName);
  Logger.log(`✅ Repository "${fullName}" removed from project "${projectName}"`);
}

/**
 * 全プロジェクトのサマリーシートを生成
 */
function generateAllProjectSummaries(): void {
  ensureContainerInitialized();
  const projects = getProjects();

  if (projects.length === 0) {
    Logger.log("⚠️ No projects configured. Using legacy single spreadsheet mode.");
    generateSummary();
    return;
  }

  for (const project of projects) {
    Logger.log(`📊 Generating summary for project: ${project.name}`);
    createSummarySheet(project.spreadsheetId, project.sheetName);
  }

  Logger.log(`✅ Generated summaries for ${projects.length} projects`);
}

/**
 * プロジェクトのスプレッドシートIDまたはシート名を更新
 */
function modifyProject(name: string, spreadsheetId?: string, sheetName?: string): void {
  ensureContainerInitialized();
  const updates: { spreadsheetId?: string; sheetName?: string; repositories?: never } = {};
  if (spreadsheetId) updates.spreadsheetId = spreadsheetId;
  if (sheetName) updates.sheetName = sheetName;

  if (Object.keys(updates).length === 0) {
    Logger.log("⚠️ No updates specified. Provide spreadsheetId and/or sheetName.");
    return;
  }

  updateProject(name, updates);
  Logger.log(`✅ Project "${name}" updated`);
  if (spreadsheetId) Logger.log(`   Spreadsheet: ${spreadsheetId}`);
  if (sheetName) Logger.log(`   Sheet: ${sheetName}`);
}

global.createProject = createProject;
global.deleteProject = deleteProject;
global.modifyProject = modifyProject;
global.listProjects = listProjects;
global.addRepoToProject = addRepoToProject;
global.removeRepoFromProject = removeRepoFromProject;
global.generateAllProjectSummaries = generateAllProjectSummaries;
