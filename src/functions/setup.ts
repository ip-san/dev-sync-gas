/**
 * セットアップ・設定関数モジュール
 *
 * 初期設定、リポジトリ管理、プロジェクト管理、トリガー設定など
 * 設定に関するGASエントリーポイント関数を提供。
 */

import {
  getConfig,
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
import {
  validateSpreadsheetId,
  validateRepositoryOwner,
  validateRepositoryName,
  validateProjectName,
} from '../utils/validation';
import { auditLog } from '../utils/auditLog';
import { validateSpreadsheetAccess } from '../utils/spreadsheetValidator';

// =============================================================================
// 初期セットアップ
// =============================================================================
// NOTE: 初期セットアップは src/init.ts の initConfig() を使用してください
// setup() と setupWithGitHubApp() は削除されました

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

  // 入力検証
  try {
    validateRepositoryOwner(owner);
    validateRepositoryName(name);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.log(`❌ Validation error: ${errorMessage}`);
    auditLog('repository.add', { owner, name }, 'failure', errorMessage);
    throw error;
  }

  try {
    addRepository(owner, name);
    Logger.log(`✅ Added repository: ${owner}/${name}`);
    auditLog('repository.add', { fullName: `${owner}/${name}` });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    auditLog('repository.add', { owner, name }, 'failure', errorMessage);
    throw error;
  }
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

  try {
    // 既存のトリガーを削除
    const triggers = triggerClient.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'syncDevOpsMetrics') {
        triggerClient.deleteTrigger(trigger);
      }
    }

    // 毎日午前9時に実行
    triggerClient.newTrigger('syncDevOpsMetrics').timeBased().everyDays(1).atHour(9).create();

    // 監査ログ
    auditLog('trigger.create', {
      functionName: 'syncDevOpsMetrics',
      schedule: 'daily at 9:00 AM',
    });

    logger.info('✅ Daily trigger created for 9:00 AM');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    auditLog('trigger.create', { functionName: 'syncDevOpsMetrics' }, 'failure', errorMessage);
    throw error;
  }
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

  // 入力検証
  try {
    validateProjectName(name);
    validateSpreadsheetId(spreadsheetId);
    validateSpreadsheetAccess(spreadsheetId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.log(`❌ Validation error: ${errorMessage}`);
    auditLog('project.create', { name, spreadsheetId }, 'failure', errorMessage);
    throw error;
  }

  try {
    addProject({ name, spreadsheetId, sheetName, repositories: [] });
    Logger.log(`✅ Project "${name}" created`);
    Logger.log(`   Spreadsheet: ${spreadsheetId}`);
    Logger.log(`   Sheet: ${sheetName}`);
    auditLog('project.create', { name, spreadsheetId, sheetName });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    auditLog('project.create', { name, spreadsheetId }, 'failure', errorMessage);
    throw error;
  }
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

  // 入力検証
  try {
    validateProjectName(projectName);
    validateRepositoryOwner(owner);
    validateRepositoryName(repoName);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.log(`❌ Validation error: ${errorMessage}`);
    auditLog('project.add_repository', { projectName, owner, repoName }, 'failure', errorMessage);
    throw error;
  }

  try {
    addRepositoryToProject(projectName, owner, repoName);
    Logger.log(`✅ Repository "${owner}/${repoName}" added to project "${projectName}"`);
    auditLog('project.add_repository', { projectName, fullName: `${owner}/${repoName}` });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    auditLog('project.add_repository', { projectName, owner, repoName }, 'failure', errorMessage);
    throw error;
  }
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
