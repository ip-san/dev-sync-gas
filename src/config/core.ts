/**
 * コア設定管理
 *
 * アプリケーション全体の設定取得・保存の中核機能
 */

import { getContainer } from '../container';
import type { StorageClient } from '../interfaces';
import type { Config, GitHubAppConfig, GitHubRepository, ProjectGroup } from '../types';
import {
  GitHubRepositoriesSchema,
  ProjectGroupsSchema,
  safeParseJSON,
} from '../utils/configSchemas';
import { ConfigurationError, ErrorCode } from '../utils/errors';
import { checkPartialGitHubAppConfig, getGitHubAuthMode } from './authMode';
import { CONFIG_KEYS } from './propertyKeys';

/**
 * 認証モードを検証し、未設定の場合はエラーを投げる
 *
 * @param authMode - 認証モード
 * @throws 認証が設定されていない場合
 */
function validateAuthMode(authMode: 'none' | 'pat' | 'app'): void {
  if (authMode !== 'none') {
    return;
  }

  const missing = checkPartialGitHubAppConfig();
  if (missing) {
    throw new ConfigurationError(
      `GitHub Apps設定が不完全です（${missing.join(', ')} が未設定）\n` +
        '→ setupWithGitHubApp(appId, privateKey, installationId, spreadsheetId) で全ての値を設定してください\n' +
        '→ 設定状況を確認するには checkConfig() を実行してください',
      {
        code: ErrorCode.CONFIG_INVALID_PROJECT,
        context: { missing },
      }
    );
  }

  throw new ConfigurationError(
    'GitHub認証が設定されていません\n' +
      "→ PAT認証: setup('GITHUB_TOKEN', 'SPREADSHEET_ID')\n" +
      '→ GitHub Apps認証: setupWithGitHubApp(appId, privateKey, installationId, spreadsheetId)\n' +
      '→ 設定状況を確認するには checkConfig() を実行してください',
    {
      code: ErrorCode.CONFIG_MISSING_TOKEN,
    }
  );
}

/**
 * GitHub App認証の設定オブジェクトを作成
 *
 * @param storageClient - ストレージクライアント
 * @returns GitHub App設定
 */
function createGitHubAppConfig(storageClient: StorageClient): GitHubAppConfig {
  const appId = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_ID) ?? '';
  const privateKey = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY) ?? '';
  const installationId =
    storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_INSTALLATION_ID) ?? '';

  return { appId, privateKey, installationId };
}

/**
 * アプリケーション設定を取得
 *
 * @returns 設定オブジェクト
 * @throws 必須設定が欠けている場合
 */
export function getConfig(): Config {
  const { storageClient, logger } = getContainer();

  const spreadsheetId = storageClient.getProperty(CONFIG_KEYS.SPREADSHEET.ID);
  const sheetName = storageClient.getProperty('SHEET_NAME') ?? 'DevOps Metrics';
  const repositoriesJson = storageClient.getProperty(CONFIG_KEYS.GITHUB_API.REPOSITORIES);
  const projectsJson = storageClient.getProperty(CONFIG_KEYS.SPREADSHEET.PROJECT_GROUPS);

  const projects = safeParseJSON(projectsJson, ProjectGroupsSchema, [], logger);

  if (projects.length === 0 && !spreadsheetId) {
    throw new ConfigurationError(
      'SPREADSHEET_ID is not set\n' +
        "→ setup('GITHUB_TOKEN', 'SPREADSHEET_ID') または setupWithGitHubApp() で設定してください\n" +
        '→ 複数スプレッドシートを使う場合は createProject() でプロジェクトを作成してください\n' +
        '→ 設定状況を確認するには checkConfig() を実行してください',
      {
        code: ErrorCode.CONFIG_MISSING_SPREADSHEET,
      }
    );
  }

  const repositories = safeParseJSON(repositoriesJson, GitHubRepositoriesSchema, [], logger);
  const authMode = getGitHubAuthMode();
  validateAuthMode(authMode);

  const baseConfig = {
    spreadsheet: { id: spreadsheetId ?? '', sheetName },
    projects: projects.length > 0 ? projects : undefined,
  };

  if (authMode === 'app') {
    return {
      ...baseConfig,
      github: { appConfig: createGitHubAppConfig(storageClient), repositories },
    };
  }

  const githubToken = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.TOKEN) ?? '';
  return { ...baseConfig, github: { token: githubToken, repositories } };
}

/**
 * 設定を保存
 *
 * @param partialConfig - 保存する設定（部分的でもOK）
 */
function saveGitHubConfig(
  storageClient: StorageClient,
  github: { token?: string; appConfig?: GitHubAppConfig; repositories?: GitHubRepository[] }
): void {
  if (github.token !== undefined) {
    storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.TOKEN, github.token);
  }
  if (github.appConfig) {
    const { appId, privateKey, installationId } = github.appConfig;
    storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.APP_ID, appId);
    storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY, privateKey);
    storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.APP_INSTALLATION_ID, installationId);
  }
  if (github.repositories !== undefined) {
    storageClient.setProperty(
      CONFIG_KEYS.GITHUB_API.REPOSITORIES,
      JSON.stringify(github.repositories)
    );
  }
}

function saveSpreadsheetConfig(
  storageClient: StorageClient,
  spreadsheet: { id?: string; sheetName?: string }
): void {
  if (spreadsheet.id !== undefined) {
    storageClient.setProperty(CONFIG_KEYS.SPREADSHEET.ID, spreadsheet.id);
  }
  if (spreadsheet.sheetName !== undefined) {
    storageClient.setProperty('SHEET_NAME', spreadsheet.sheetName);
  }
}

export function setConfig(partialConfig: {
  github?: { token?: string; appConfig?: GitHubAppConfig; repositories?: GitHubRepository[] };
  spreadsheet?: { id?: string; sheetName?: string };
  projects?: ProjectGroup[];
}): void {
  const { storageClient } = getContainer();

  if (partialConfig.github) {
    saveGitHubConfig(storageClient, partialConfig.github);
  }
  if (partialConfig.spreadsheet) {
    saveSpreadsheetConfig(storageClient, partialConfig.spreadsheet);
  }
  if (partialConfig.projects !== undefined) {
    storageClient.setProperty(
      CONFIG_KEYS.SPREADSHEET.PROJECT_GROUPS,
      JSON.stringify(partialConfig.projects)
    );
  }
}
