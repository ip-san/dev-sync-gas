/**
 * セットアップ・設定関数モジュール
 *
 * 初期設定、リポジトリ管理、プロジェクト管理、トリガー設定など
 * 設定に関するGASエントリーポイント関数を提供。
 */

import {
  getConfig,
  setConfig,
  addRepository,
  removeRepository,
  getGitHubAuthMode,
  getProjects,
  addProject,
  removeProject,
  updateProject,
  addRepositoryToProject,
  removeRepositoryFromProject,
  diagnoseConfig,
  formatDiagnosticResult,
} from '../config/settings';
import { getContainer } from '../container';
import { ensureContainerInitialized } from './helpers';

// =============================================================================
// 初期セットアップ
// =============================================================================

/**
 * 初期セットアップ（PAT認証）
 */
export function setup(githubToken: string, spreadsheetId: string): void {
  ensureContainerInitialized();
  setConfig({
    github: { token: githubToken, repositories: [] },
    spreadsheet: { id: spreadsheetId, sheetName: 'DevOps Metrics' },
  });
  Logger.log('✅ Configuration saved (PAT auth). Add repositories with addRepo()');
}

/**
 * GitHub Apps認証用セットアップ
 */
export function setupWithGitHubApp(
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
    spreadsheet: { id: spreadsheetId, sheetName: 'DevOps Metrics' },
  });
  Logger.log('✅ Configuration saved (GitHub App auth). Add repositories with addRepo()');
}

/** 現在の認証モードを表示 */
export function showAuthMode(): void {
  ensureContainerInitialized();
  const mode = getGitHubAuthMode();

  if (mode === 'app') {
    Logger.log('🔐 Current auth mode: GitHub App');
  } else if (mode === 'pat') {
    Logger.log('🔐 Current auth mode: Personal Access Token (PAT)');
  } else {
    Logger.log('⚠️ GitHub authentication is not configured');
  }
}

// =============================================================================
// リポジトリ管理
// =============================================================================

/** リポジトリ追加 */
export function addRepo(owner: string, name: string): void {
  ensureContainerInitialized();
  addRepository(owner, name);
  Logger.log(`✅ Added repository: ${owner}/${name}`);
}

/** リポジトリ削除 */
export function removeRepo(fullName: string): void {
  ensureContainerInitialized();
  removeRepository(fullName);
  Logger.log(`✅ Removed repository: ${fullName}`);
}

/** 登録済みリポジトリ一覧を表示 */
export function listRepos(): void {
  ensureContainerInitialized();
  const config = getConfig();
  Logger.log('Registered repositories:');
  config.github.repositories.forEach((repo, i) => {
    Logger.log(`  ${i + 1}. ${repo.fullName}`);
  });
}

// =============================================================================
// トリガー管理
// =============================================================================

/** 日次実行用トリガー設定 */
export function createDailyTrigger(): void {
  ensureContainerInitialized();
  const { triggerClient, logger } = getContainer();

  // 既存のトリガーを削除
  const triggers = triggerClient.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'syncDevOpsMetrics') {
      triggerClient.deleteTrigger(trigger);
    }
  }

  // 毎日午前9時に実行
  triggerClient.newTrigger('syncDevOpsMetrics').timeBased().everyDays(1).atHour(9).create();

  logger.log('✅ Daily trigger created for 9:00 AM');
}

// =============================================================================
// プロジェクトグループ管理
// =============================================================================

/**
 * プロジェクトグループを作成
 */
export function createProject(
  name: string,
  spreadsheetId: string,
  sheetName = 'DevOps Metrics'
): void {
  ensureContainerInitialized();
  addProject({ name, spreadsheetId, sheetName, repositories: [] });
  Logger.log(`✅ Project "${name}" created`);
  Logger.log(`   Spreadsheet: ${spreadsheetId}`);
  Logger.log(`   Sheet: ${sheetName}`);
}

/** プロジェクトグループを削除 */
export function deleteProject(name: string): void {
  ensureContainerInitialized();
  removeProject(name);
  Logger.log(`✅ Project "${name}" deleted`);
}

/** プロジェクト一覧を表示 */
export function listProjects(): void {
  ensureContainerInitialized();
  const projects = getProjects();

  if (projects.length === 0) {
    Logger.log('📋 No projects configured');
    Logger.log('   Use createProject(name, spreadsheetId) to create one');
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

/** プロジェクトにリポジトリを追加 */
export function addRepoToProject(projectName: string, owner: string, repoName: string): void {
  ensureContainerInitialized();
  addRepositoryToProject(projectName, owner, repoName);
  Logger.log(`✅ Repository "${owner}/${repoName}" added to project "${projectName}"`);
}

/** プロジェクトからリポジトリを削除 */
export function removeRepoFromProject(projectName: string, fullName: string): void {
  ensureContainerInitialized();
  removeRepositoryFromProject(projectName, fullName);
  Logger.log(`✅ Repository "${fullName}" removed from project "${projectName}"`);
}

/** プロジェクトのスプレッドシートIDまたはシート名を更新 */
export function modifyProject(name: string, spreadsheetId?: string, sheetName?: string): void {
  ensureContainerInitialized();
  const updates: { spreadsheetId?: string; sheetName?: string } = {};
  if (spreadsheetId) {
    updates.spreadsheetId = spreadsheetId;
  }
  if (sheetName) {
    updates.sheetName = sheetName;
  }

  if (Object.keys(updates).length === 0) {
    Logger.log('⚠️ No updates specified. Provide spreadsheetId and/or sheetName.');
    return;
  }

  updateProject(name, updates);
  Logger.log(`✅ Project "${name}" updated`);
  if (spreadsheetId) {
    Logger.log(`   Spreadsheet: ${spreadsheetId}`);
  }
  if (sheetName) {
    Logger.log(`   Sheet: ${sheetName}`);
  }
}

// =============================================================================
// 診断・権限テスト
// =============================================================================

/**
 * 設定状況を診断して問題を報告
 */
export function checkConfig(): void {
  ensureContainerInitialized();
  const result = diagnoseConfig();
  const formatted = formatDiagnosticResult(result);
  Logger.log(formatted);
}

/**
 * 権限テスト用関数 - 初回実行で承認ダイアログを表示
 */
export function testPermissions(): void {
  // 外部リクエスト権限のテスト
  const response = UrlFetchApp.fetch('https://api.github.com', {
    muteHttpExceptions: true,
  });
  Logger.log(`GitHub API status: ${response.getResponseCode()}`);

  // スプレッドシート権限のテスト
  const config = getConfig();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheet.id);
  Logger.log(`Spreadsheet name: ${spreadsheet.getName()}`);

  Logger.log('✅ All permissions granted!');
}
