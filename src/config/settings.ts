import type { Config, GitHubRepository, GitHubAppConfig, ProjectGroup } from '../types';
import { getContainer } from '../container';
import { resolveGitHubToken } from '../services/githubAuth';
import {
  validateRepositoryOwner,
  validateRepositoryName,
  validateProjectName,
  validateSpreadsheetId,
} from '../utils/validation';
import { auditLog } from '../utils/auditLog';
import { validateSpreadsheetAccess } from '../utils/spreadsheetValidator';
import { CONFIG_KEYS } from './propertyKeys';
import {
  safeParseJSON,
  GitHubRepositoriesSchema,
  ProjectGroupsSchema,
} from '../utils/configSchemas';

// =============================================================================
// API モード設定
// =============================================================================

/** GitHub APIモード */
export type GitHubApiMode = 'rest' | 'graphql';

/**
 * GitHub APIモードを取得
 * @returns "graphql" | "rest"（デフォルト: "graphql"）
 */
export function getGitHubApiMode(): GitHubApiMode {
  const { storageClient } = getContainer();
  const mode = storageClient.getProperty(CONFIG_KEYS.GITHUB_API.API_MODE);
  return mode === 'rest' ? 'rest' : 'graphql';
}

/**
 * GitHub APIモードを設定
 * @param mode - "graphql" または "rest"
 */
export function setGitHubApiMode(mode: GitHubApiMode): void {
  const { storageClient } = getContainer();
  storageClient.setProperty(CONFIG_KEYS.GITHUB_API.API_MODE, mode);
}

/**
 * GitHub APIモードをリセット（デフォルトのgraphqlに戻す）
 */
export function resetGitHubApiMode(): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty(CONFIG_KEYS.GITHUB_API.API_MODE);
}

/**
 * GitHub認証モードを判定
 * @returns "app" | "pat" | "none"
 */
export function getGitHubAuthMode(): 'app' | 'pat' | 'none' {
  const { storageClient } = getContainer();

  const appId = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_ID);
  const privateKey = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY);
  const installationId = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_INSTALLATION_ID);

  if (appId && privateKey && installationId) {
    return 'app';
  }

  const token = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.TOKEN);
  if (token) {
    return 'pat';
  }

  return 'none';
}

export function getConfig(): Config {
  const { storageClient, logger } = getContainer();

  const spreadsheetId = storageClient.getProperty(CONFIG_KEYS.SPREADSHEET.ID);
  const sheetName = storageClient.getProperty('SHEET_NAME') ?? 'DevOps Metrics';
  const repositoriesJson = storageClient.getProperty(CONFIG_KEYS.GITHUB_API.REPOSITORIES);
  const projectsJson = storageClient.getProperty(CONFIG_KEYS.SPREADSHEET.PROJECT_GROUPS);

  // projectsが設定されている場合はそちらを使用、なければ従来の単一スプレッドシート設定
  const projects = safeParseJSON(projectsJson, ProjectGroupsSchema, [], logger);

  // projectsがない場合は従来の設定が必須
  if (projects.length === 0 && !spreadsheetId) {
    throw new Error(
      'SPREADSHEET_ID is not set\n' +
        "→ setup('GITHUB_TOKEN', 'SPREADSHEET_ID') または setupWithGitHubApp() で設定してください\n" +
        '→ 複数スプレッドシートを使う場合は createProject() でプロジェクトを作成してください\n' +
        '→ 設定状況を確認するには checkConfig() を実行してください'
    );
  }

  const repositories = safeParseJSON(repositoriesJson, GitHubRepositoriesSchema, [], logger);

  const authMode = getGitHubAuthMode();

  if (authMode === 'none') {
    // 部分的に設定されているか確認して、より詳細なエラーを出す
    const appId = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_ID);
    const privateKey = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY);
    const installationId = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_INSTALLATION_ID);

    // 部分的に設定されているかチェック（||はブール値コンテキストなので適切）
    const hasPartialConfig = appId !== null || privateKey !== null || installationId !== null;
    if (hasPartialConfig) {
      const missing: string[] = [];
      if (!appId) {
        missing.push('App ID');
      }
      if (!privateKey) {
        missing.push('Private Key');
      }
      if (!installationId) {
        missing.push('Installation ID');
      }

      throw new Error(
        `GitHub Apps設定が不完全です（${missing.join(', ')} が未設定）\n` +
          '→ setupWithGitHubApp(appId, privateKey, installationId, spreadsheetId) で全ての値を設定してください\n' +
          '→ 設定状況を確認するには checkConfig() を実行してください'
      );
    }

    throw new Error(
      'GitHub認証が設定されていません\n' +
        "→ PAT認証: setup('GITHUB_TOKEN', 'SPREADSHEET_ID')\n" +
        '→ GitHub Apps認証: setupWithGitHubApp(appId, privateKey, installationId, spreadsheetId)\n' +
        '→ 設定状況を確認するには checkConfig() を実行してください'
    );
  }

  // GitHub Apps認証
  if (authMode === 'app') {
    const appConfig: GitHubAppConfig = {
      appId: storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_ID)!,
      privateKey: storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY)!,
      installationId: storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_INSTALLATION_ID)!,
    };

    return {
      github: { appConfig, repositories },
      spreadsheet: { id: spreadsheetId ?? '', sheetName },
      projects: projects.length > 0 ? projects : undefined,
    };
  }

  // PAT認証
  const githubToken = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.TOKEN)!;

  return {
    github: { token: githubToken, repositories },
    spreadsheet: { id: spreadsheetId ?? '', sheetName },
    projects: projects.length > 0 ? projects : undefined,
  };
}

export function setConfig(config: Partial<Config>): void {
  const { storageClient } = getContainer();

  if (config.github?.token) {
    storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.TOKEN, config.github.token);
  }
  if (config.github?.appConfig) {
    storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.APP_ID, config.github.appConfig.appId);
    storageClient.setProperty(
      CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY,
      config.github.appConfig.privateKey
    );
    storageClient.setProperty(
      CONFIG_KEYS.GITHUB_AUTH.APP_INSTALLATION_ID,
      config.github.appConfig.installationId
    );
  }
  if (config.github?.repositories) {
    storageClient.setProperty(
      CONFIG_KEYS.GITHUB_API.REPOSITORIES,
      JSON.stringify(config.github.repositories)
    );
  }
  if (config.spreadsheet?.id) {
    storageClient.setProperty(CONFIG_KEYS.SPREADSHEET.ID, config.spreadsheet.id);
  }
  if (config.spreadsheet?.sheetName) {
    storageClient.setProperty('SHEET_NAME', config.spreadsheet.sheetName);
  }
  if (config.projects) {
    storageClient.setProperty(
      CONFIG_KEYS.SPREADSHEET.PROJECT_GROUPS,
      JSON.stringify(config.projects)
    );
  }
}

/**
 * プロジェクトグループを取得
 */
export function getProjects(): ProjectGroup[] {
  const config = getConfig();
  return config.projects ?? [];
}

/**
 * プロジェクトグループを追加
 */
export function addProject(project: ProjectGroup): void {
  // 入力検証
  validateProjectName(project.name);
  validateSpreadsheetId(project.spreadsheetId);
  // スプレッドシートへのアクセス権限を検証
  validateSpreadsheetAccess(project.spreadsheetId);

  const config = getConfig();
  const projects = config.projects ?? [];

  const exists = projects.some((p) => p.name === project.name);
  if (exists) {
    throw new Error(`Project "${project.name}" already exists`);
  }

  projects.push(project);
  setConfig({ projects });

  // 監査ログ
  auditLog('project.create', {
    name: project.name,
    spreadsheetId: project.spreadsheetId,
    sheetName: project.sheetName,
  });
}

/**
 * プロジェクトグループを更新
 */
export function updateProject(name: string, updates: Partial<Omit<ProjectGroup, 'name'>>): void {
  // 入力検証
  if (updates.spreadsheetId) {
    validateSpreadsheetId(updates.spreadsheetId);
  }

  const config = getConfig();
  const projects = config.projects ?? [];

  const index = projects.findIndex((p) => p.name === name);
  if (index === -1) {
    throw new Error(`Project "${name}" not found`);
  }

  projects[index] = { ...projects[index], ...updates };
  setConfig({ projects });

  // 監査ログ
  auditLog('project.update', { name, updates });
}

/**
 * プロジェクトグループを削除
 */
export function removeProject(name: string): void {
  const config = getConfig();
  const beforeCount = (config.projects ?? []).length;
  const projects = (config.projects ?? []).filter((p) => p.name !== name);
  const afterCount = projects.length;

  if (beforeCount !== afterCount) {
    setConfig({ projects });

    // 監査ログ
    auditLog('project.delete', { name });
  }
}

/**
 * プロジェクトグループにリポジトリを追加
 */
export function addRepositoryToProject(projectName: string, owner: string, repoName: string): void {
  // 入力検証
  validateRepositoryOwner(owner);
  validateRepositoryName(repoName);

  const config = getConfig();
  const projects = config.projects ?? [];

  const project = projects.find((p) => p.name === projectName);
  if (!project) {
    throw new Error(`Project "${projectName}" not found`);
  }

  const newRepo: GitHubRepository = { owner, name: repoName, fullName: `${owner}/${repoName}` };
  const exists = project.repositories.some((r) => r.fullName === newRepo.fullName);

  if (!exists) {
    project.repositories.push(newRepo);
    setConfig({ projects });

    // 監査ログ
    auditLog('project.repository.add', {
      projectName,
      owner,
      repoName,
      fullName: newRepo.fullName,
    });
  }
}

/**
 * プロジェクトグループからリポジトリを削除
 */
export function removeRepositoryFromProject(projectName: string, fullName: string): void {
  const config = getConfig();
  const projects = config.projects ?? [];

  const project = projects.find((p) => p.name === projectName);
  if (!project) {
    throw new Error(`Project "${projectName}" not found`);
  }

  const beforeCount = project.repositories.length;
  project.repositories = project.repositories.filter((r) => r.fullName !== fullName);
  const afterCount = project.repositories.length;

  if (beforeCount !== afterCount) {
    setConfig({ projects });

    // 監査ログ
    auditLog('project.repository.remove', { projectName, fullName });
  }
}

/**
 * GitHub Apps設定をクリア（PAT認証に戻す際に使用）
 * セキュリティ: 機密情報の削除を監査ログに記録
 */
export function clearGitHubAppConfig(): void {
  const { storageClient, logger } = getContainer();

  // 削除前の確認メッセージ
  logger.log('⚠️ Clearing GitHub App configuration...');
  logger.log('   This will remove App ID, Private Key, and Installation ID');
  logger.log('   Make sure to revoke the GitHub App access if no longer needed');

  try {
    storageClient.deleteProperty(CONFIG_KEYS.GITHUB_AUTH.APP_ID);
    storageClient.deleteProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY);
    storageClient.deleteProperty(CONFIG_KEYS.GITHUB_AUTH.APP_INSTALLATION_ID);

    // 監査ログ（成功）
    auditLog('config.github_app.clear', {
      message: 'GitHub App configuration cleared successfully',
    });

    logger.log('✅ GitHub App configuration cleared');
  } catch (error) {
    // 監査ログ（失敗）
    auditLog(
      'config.github_app.clear',
      { message: 'Failed to clear GitHub App configuration' },
      'failure',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

/**
 * 設定からGitHubトークンを取得
 * - GitHub Apps設定がある場合: Installation Tokenを取得して返す
 * - PAT設定の場合: PATをそのまま返す
 *
 * @returns GitHub APIで使用するトークン
 */
export function getGitHubToken(): string {
  const config = getConfig();
  return resolveGitHubToken(config.github.token, config.github.appConfig);
}

export function addRepository(owner: string, name: string): void {
  // 入力検証
  validateRepositoryOwner(owner);
  validateRepositoryName(name);

  const config = getConfig();
  const newRepo: GitHubRepository = { owner, name, fullName: `${owner}/${name}` };
  const exists = config.github.repositories.some((r) => r.fullName === newRepo.fullName);

  if (!exists) {
    config.github.repositories.push(newRepo);
    setConfig({ github: config.github });

    // 監査ログ
    auditLog('repository.add', { owner, name, fullName: newRepo.fullName });
  }
}

export function removeRepository(fullName: string): void {
  const config = getConfig();
  const beforeCount = config.github.repositories.length;
  config.github.repositories = config.github.repositories.filter((r) => r.fullName !== fullName);
  const afterCount = config.github.repositories.length;

  if (beforeCount !== afterCount) {
    setConfig({ github: config.github });

    // 監査ログ
    auditLog('repository.remove', { fullName });
  }
}

// ============================================================
// サイクルタイム設定
// ============================================================

/** デフォルトのproductionブランチパターン */
const DEFAULT_PRODUCTION_BRANCH_PATTERN = 'production';

/**
 * productionブランチパターンを取得
 * このパターンを含むブランチへのマージをproductionリリースとみなす
 *
 * @returns productionブランチパターン（デフォルト: "production"）
 */
export function getProductionBranchPattern(): string {
  const { storageClient } = getContainer();
  return (
    storageClient.getProperty('PRODUCTION_BRANCH_PATTERN') ?? DEFAULT_PRODUCTION_BRANCH_PATTERN
  );
}

/**
 * productionブランチパターンを設定
 *
 * @example
 * // "xxx_production" にマッチ
 * setProductionBranchPattern("production");
 *
 * // "release" ブランチにマッチ
 * setProductionBranchPattern("release");
 */
export function setProductionBranchPattern(pattern: string): void {
  const { storageClient } = getContainer();
  storageClient.setProperty('PRODUCTION_BRANCH_PATTERN', pattern);
}

/**
 * productionブランチパターン設定をリセット
 */
export function resetProductionBranchPattern(): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty('PRODUCTION_BRANCH_PATTERN');
}

/**
 * プロパティから文字列配列を取得する汎用ヘルパー関数
 * @param key プロパティキー
 * @returns パースされた文字列配列（失敗時は空配列）
 */
function getPropertyAsStringArray(key: string): string[] {
  const { storageClient, logger } = getContainer();
  const json = storageClient.getProperty(key);
  if (!json) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed;
    }
    logger.log(`⚠️ Property ${key} is not a valid string array`);
  } catch (error) {
    logger.log(
      `⚠️ Failed to parse ${key}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return [];
}

/**
 * プロパティに文字列配列を設定する汎用ヘルパー関数
 * @param key プロパティキー
 * @param values 設定する文字列配列
 */
function setPropertyAsStringArray(key: string, values: string[]): void {
  const { storageClient } = getContainer();
  storageClient.setProperty(key, JSON.stringify(values));
}

/**
 * プロパティを削除する汎用ヘルパー関数
 * @param key プロパティキー
 */
function deleteProperty(key: string): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty(key);
}

/**
 * サイクルタイム計測対象のIssueラベルを取得
 * 空配列の場合は全Issueが対象
 *
 * @returns ラベル配列（デフォルト: []）
 */
export function getCycleTimeIssueLabels(): string[] {
  return getPropertyAsStringArray('CYCLE_TIME_ISSUE_LABELS');
}

/**
 * サイクルタイム計測対象のIssueラベルを設定
 *
 * @example
 * // "feature" と "enhancement" ラベルを持つIssueのみ計測
 * setCycleTimeIssueLabels(["feature", "enhancement"]);
 *
 * // 全Issueを対象にする
 * setCycleTimeIssueLabels([]);
 */
export function setCycleTimeIssueLabels(labels: string[]): void {
  setPropertyAsStringArray('CYCLE_TIME_ISSUE_LABELS', labels);
}

/**
 * サイクルタイムIssueラベル設定をリセット（全Issue対象に戻す）
 */
export function resetCycleTimeIssueLabels(): void {
  deleteProperty('CYCLE_TIME_ISSUE_LABELS');
}

// ============================================================
// コーディングタイム設定
// ============================================================

/**
 * コーディングタイム計測対象のIssueラベルを取得
 * 空配列の場合は全Issueが対象
 *
 * @returns ラベル配列（デフォルト: []）
 */
export function getCodingTimeIssueLabels(): string[] {
  return getPropertyAsStringArray('CODING_TIME_ISSUE_LABELS');
}

/**
 * コーディングタイム計測対象のIssueラベルを設定
 *
 * @example
 * // "feature" と "enhancement" ラベルを持つIssueのみ計測
 * setCodingTimeIssueLabels(["feature", "enhancement"]);
 *
 * // 全Issueを対象にする
 * setCodingTimeIssueLabels([]);
 */
export function setCodingTimeIssueLabels(labels: string[]): void {
  setPropertyAsStringArray('CODING_TIME_ISSUE_LABELS', labels);
}

/**
 * コーディングタイムIssueラベル設定をリセット（全Issue対象に戻す）
 */
export function resetCodingTimeIssueLabels(): void {
  deleteProperty('CODING_TIME_ISSUE_LABELS');
}

// ============================================================
// 設定診断
// ============================================================

// 診断ロジックは src/config/diagnostics.ts に移動しました
// 後方互換性のため型定義と関数を再エクスポート
export type { ConfigDiagnosticItem, ConfigDiagnosticResult } from './diagnostics.js';
export { diagnoseConfig, formatDiagnosticResult } from './diagnostics.js';
