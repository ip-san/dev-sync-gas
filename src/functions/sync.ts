/**
 * DevOps指標同期関数モジュール
 *
 * GitHub APIからDevOps指標を取得し、スプレッドシートに書き出す
 * メインの同期処理を提供。
 *
 * GraphQL APIを使用してAPI呼び出し回数を削減。
 */

import { getConfig, getGitHubToken } from '../config/settings';
import { getAllRepositoriesDataGraphQL, type DateRange } from '../services/github';
import {
  // リポジトリ別シート構造
  writeMetricsToAllRepositorySheets,
  writeDashboard,
  writeDashboardTrends,
} from '../services/spreadsheet';
import { calculateMetricsForRepository, calculateDailyMetrics } from '../utils/metrics';
import { ensureContainerInitialized } from './helpers';
import { isSlackNotificationEnabled } from '../services/slack/client';
import { createDailySummaryMessage } from '../services/slack/dailySummary';
import { getContainer } from '../container';
import type {
  DevOpsMetrics,
  GitHubRepository,
  GitHubPullRequest,
  GitHubWorkflowRun,
  GitHubDeployment,
} from '../types';

/** データ取得関数の戻り値型 */
interface RepositoriesData {
  pullRequests: GitHubPullRequest[];
  workflowRuns: GitHubWorkflowRun[];
  deployments: GitHubDeployment[];
}

/**
 * GraphQL APIを使用してリポジトリデータを取得
 */
function fetchRepositoriesData(
  repositories: GitHubRepository[],
  token: string,
  options: { dateRange?: DateRange } = {}
): RepositoriesData {
  Logger.log('🚀 Using GraphQL API');
  return getAllRepositoriesDataGraphQL(repositories, token, options);
}

// =============================================================================
// DORA Metrics 同期
// =============================================================================

/**
 * DevOps指標を収集してスプレッドシートに書き出す
 *
 * リポジトリごとに別シートに書き出し、
 * Dashboard、Summaryシートも自動生成。
 */
export async function syncDevOpsMetrics(dateRange?: DateRange): Promise<void> {
  ensureContainerInitialized();
  const config = getConfig();

  Logger.log(`📊 Syncing metrics to repository sheets`);
  Logger.log(`   Repositories: ${config.github.repositories.length}`);
  config.github.repositories.forEach((repo) => {
    Logger.log(`  - ${repo.fullName}`);
  });

  if (dateRange) {
    Logger.log(
      `📅 Date range: ${dateRange.since?.toISOString()} ~ ${dateRange.until?.toISOString()}`
    );
  }

  const token = getGitHubToken();
  const { pullRequests, workflowRuns, deployments } = fetchRepositoriesData(
    config.github.repositories,
    token,
    { dateRange }
  );

  Logger.log(
    `📥 Fetched ${pullRequests.length} PRs, ${workflowRuns.length} workflow runs, ${deployments.length} deployments`
  );

  const metrics: DevOpsMetrics[] = config.github.repositories.map((repo) =>
    calculateMetricsForRepository({
      repository: repo.fullName,
      prs: pullRequests,
      runs: workflowRuns,
      deployments,
    })
  );

  Logger.log(`📈 Calculated ${metrics.length} metrics`);

  // リポジトリ別シートに書き込み
  writeMetricsToAllRepositorySheets(config.spreadsheet.id, metrics, { skipDuplicates: true });

  // Dashboard更新
  await writeDashboard(config.spreadsheet.id, metrics);
  await writeDashboardTrends(config.spreadsheet.id, metrics);

  Logger.log(`✅ Synced metrics to ${config.github.repositories.length} repository sheets`);

  // Slack通知（日次サマリー）
  if (isSlackNotificationEnabled()) {
    try {
      const { slackClient, logger } = getContainer();
      const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${config.spreadsheet.id}`;
      const message = createDailySummaryMessage(metrics, spreadsheetUrl);
      slackClient.sendMessage(message);
      logger.info('📢 Slack daily summary notification sent');
    } catch (error) {
      Logger.log(`⚠️ Failed to send Slack notification: ${String(error)}`);
    }
  }
}

/**
 * 全プロジェクトグループのDevOps指標を収集
 *
 * 各プロジェクトでリポジトリ別シート、Dashboard、Summaryを生成。
 */

// =============================================================================
// 日別バックフィル
// =============================================================================

/**
 * 日別バックフィル: 過去N日分のメトリクスを日別に記録
 *
 * 30日分なら 30 × リポジトリ数 の行がリポジトリ別シートに追加される。
 * 重複チェックにより、既に記録済みの(日付, リポジトリ)はスキップされる。
 *
 * @param days - バックフィル日数（デフォルト: 30）
 */
export async function syncDailyBackfill(days = 30): Promise<void> {
  ensureContainerInitialized();
  const config = getConfig();
  const token = getGitHubToken();

  // 1. 期間設定
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);

  Logger.log(`📅 Daily backfill for the last ${days} days`);
  Logger.log(`   From: ${since.toISOString().split('T')[0]}`);
  Logger.log(`   To: ${until.toISOString().split('T')[0]}`);
  Logger.log(`   Repositories: ${config.github.repositories.length}`);

  // 2. GitHubデータ一括取得
  const { pullRequests, workflowRuns, deployments } = fetchRepositoriesData(
    config.github.repositories,
    token,
    { dateRange: { since, until } }
  );

  Logger.log(
    `📥 Fetched ${pullRequests.length} PRs, ${workflowRuns.length} workflow runs, ${deployments.length} deployments`
  );

  // 3. 日別メトリクス計算
  const dailyMetrics = calculateDailyMetrics({
    repositories: config.github.repositories,
    prs: pullRequests,
    runs: workflowRuns,
    deployments,
    dateRange: { since, until },
  });

  Logger.log(`📊 Generated ${dailyMetrics.length} daily records`);

  // 4. リポジトリ別シートに書き込み
  writeMetricsToAllRepositorySheets(config.spreadsheet.id, dailyMetrics, { skipDuplicates: true });

  // 5. Dashboard更新
  await writeDashboard(config.spreadsheet.id, dailyMetrics);
  await writeDashboardTrends(config.spreadsheet.id, dailyMetrics);

  Logger.log(`✅ Daily backfill completed`);
}

/**
 * 全プロジェクトの日別バックフィル
 *
 * 各プロジェクトでリポジトリ別シート、Dashboard、Summaryを生成。
 *
 * @param days - バックフィル日数（デフォルト: 30）
 */
export async function backfillAllProjectsDaily(days = 30): Promise<void> {
  ensureContainerInitialized();
  const config = getConfig();
  const projects = config.projects ?? [];

  if (projects.length === 0) {
    Logger.log('⚠️ No projects configured. Using single spreadsheet mode.');
    await syncDailyBackfill(days);
    return;
  }

  Logger.log(`📊 Daily backfill for ${projects.length} project groups (${days} days)`);

  const token = getGitHubToken();

  // 期間設定
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);

  for (const project of projects) {
    Logger.log(`\n🔹 Project: ${project.name}`);
    Logger.log(`   Spreadsheet: ${project.spreadsheetId}`);
    Logger.log(`   Repositories: ${project.repositories.length}`);

    if (project.repositories.length === 0) {
      Logger.log(`   ⚠️ No repositories in this project, skipping`);
      continue;
    }

    const { pullRequests, workflowRuns, deployments } = fetchRepositoriesData(
      project.repositories,
      token,
      { dateRange: { since, until } }
    );

    Logger.log(
      `   📥 Fetched ${pullRequests.length} PRs, ${workflowRuns.length} workflow runs, ${deployments.length} deployments`
    );

    const dailyMetrics = calculateDailyMetrics({
      repositories: project.repositories,
      prs: pullRequests,
      runs: workflowRuns,
      deployments,
      dateRange: { since, until },
    });

    Logger.log(`   📊 Generated ${dailyMetrics.length} daily records`);

    // リポジトリ別シートに書き込み
    writeMetricsToAllRepositorySheets(project.spreadsheetId, dailyMetrics, {
      skipDuplicates: true,
    });

    // Dashboard更新
    await writeDashboard(project.spreadsheetId, dailyMetrics);
    await writeDashboardTrends(project.spreadsheetId, dailyMetrics);
  }

  Logger.log(`\n✅ Daily backfill completed for ${projects.length} projects`);
}

// =============================================================================
// ユーティリティ
// =============================================================================
