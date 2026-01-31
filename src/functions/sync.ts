/**
 * DevOps指標同期関数モジュール
 *
 * GitHub APIからDevOps指標を取得し、スプレッドシートに書き出す
 * メインの同期処理を提供。
 *
 * GraphQL API（デフォルト）を使用してAPI呼び出し回数を削減。
 * REST APIにフォールバック可能（setGitHubApiMode('rest')）
 */

import { getConfig, getGitHubToken, getProjects, getGitHubApiMode } from '../config/settings';
import {
  getAllRepositoriesData,
  getAllRepositoriesDataGraphQL,
  type DateRange,
} from '../services/github';
import { writeMetricsToSheet, createSummarySheet, clearOldData } from '../services/spreadsheet';
import { calculateMetricsForRepository } from '../utils/metrics';
import { ensureContainerInitialized } from './helpers';
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
 * APIモードに応じたデータ取得関数を選択
 */
function fetchRepositoriesData(
  repositories: GitHubRepository[],
  token: string,
  options: { dateRange?: DateRange } = {}
): RepositoriesData {
  const apiMode = getGitHubApiMode();

  if (apiMode === 'graphql') {
    Logger.log('🚀 Using GraphQL API (efficient mode)');
    return getAllRepositoriesDataGraphQL(repositories, token, options);
  } else {
    Logger.log('📡 Using REST API (legacy mode)');
    return getAllRepositoriesData(repositories, token, options);
  }
}

// =============================================================================
// DORA Metrics 同期
// =============================================================================

/**
 * DevOps指標を収集してスプレッドシートに書き出す
 */
export function syncDevOpsMetrics(dateRange?: DateRange): void {
  ensureContainerInitialized();
  const config = getConfig();

  Logger.log(`📊 Repositories: ${config.github.repositories.length}`);
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
    calculateMetricsForRepository(repo.fullName, pullRequests, workflowRuns, deployments)
  );

  Logger.log(`📈 Calculated ${metrics.length} metrics`);

  writeMetricsToSheet(config.spreadsheet.id, config.spreadsheet.sheetName, metrics);

  Logger.log(`✅ Synced metrics for ${metrics.length} repositories`);
}

/**
 * 全プロジェクトグループのDevOps指標を収集
 */
export function syncAllProjects(dateRange?: DateRange): void {
  ensureContainerInitialized();
  const config = getConfig();
  const projects = config.projects ?? [];

  if (projects.length === 0) {
    Logger.log('⚠️ No projects configured. Using legacy single spreadsheet mode.');
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

    const { pullRequests, workflowRuns, deployments } = fetchRepositoriesData(
      project.repositories,
      token,
      { dateRange }
    );

    Logger.log(
      `   📥 Fetched ${pullRequests.length} PRs, ${workflowRuns.length} workflow runs, ${deployments.length} deployments`
    );

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
export function syncProject(projectName: string, dateRange?: DateRange): void {
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
  const { pullRequests, workflowRuns, deployments } = fetchRepositoriesData(
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

// =============================================================================
// 履歴データ同期
// =============================================================================

/**
 * 過去N日分のメトリクスを取得
 */
export function syncHistoricalMetrics(days: number): void {
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
export function syncAllProjectsHistorical(days: number): void {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);

  Logger.log(`📅 Fetching metrics for the last ${days} days`);
  Logger.log(`   From: ${since.toISOString()}`);
  Logger.log(`   To: ${until.toISOString()}`);

  syncAllProjects({ since, until });
}

/** 過去30日分を取得 */
export function syncLast30Days(): void {
  syncHistoricalMetrics(30);
}

/** 過去90日分を取得 */
export function syncLast90Days(): void {
  syncHistoricalMetrics(90);
}

// =============================================================================
// ユーティリティ
// =============================================================================

/** 古いデータのクリーンアップ */
export function cleanup(daysToKeep = 90): void {
  ensureContainerInitialized();
  const config = getConfig();
  clearOldData(config.spreadsheet.id, config.spreadsheet.sheetName, daysToKeep);
  Logger.log(`✅ Cleaned up data older than ${daysToKeep} days`);
}

/** サマリーシートを作成 */
export function generateSummary(): void {
  ensureContainerInitialized();
  const config = getConfig();
  createSummarySheet(config.spreadsheet.id, config.spreadsheet.sheetName);
  Logger.log('✅ Summary sheet created');
}

/** 全プロジェクトのサマリーシートを生成 */
export function generateAllProjectSummaries(): void {
  ensureContainerInitialized();
  const projects = getProjects();

  if (projects.length === 0) {
    Logger.log('⚠️ No projects configured. Using legacy single spreadsheet mode.');
    generateSummary();
    return;
  }

  for (const project of projects) {
    Logger.log(`📊 Generating summary for project: ${project.name}`);
    createSummarySheet(project.spreadsheetId, project.sheetName);
  }

  Logger.log(`✅ Generated summaries for ${projects.length} projects`);
}
