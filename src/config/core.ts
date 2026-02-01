/**
 * コア設定管理
 *
 * アプリケーション全体の設定取得・保存の中核機能
 */

import type { Config, GitHubRepository, GitHubAppConfig, ProjectGroup } from '../types';
import { getContainer } from '../container';
import { CONFIG_KEYS } from './propertyKeys';
import {
  safeParseJSON,
  GitHubRepositoriesSchema,
  ProjectGroupsSchema,
} from '../utils/configSchemas';
import { getGitHubAuthMode, checkPartialGitHubAppConfig } from './authMode';
import type { StorageClient } from '../interfaces';

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

/**
 * GitHub App認証の設定オブジェクトを作成
 *
 * @param storageClient - ストレージクライアント
 * @returns GitHub App設定
 */
function createGitHubAppConfig(storageClient: StorageClient): GitHubAppConfig {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const appId = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_ID)!;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const privateKey = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY)!;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const installationId = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.APP_INSTALLATION_ID)!;

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
    throw new Error(
      'SPREADSHEET_ID is not set\n' +
        "→ setup('GITHUB_TOKEN', 'SPREADSHEET_ID') または setupWithGitHubApp() で設定してください\n" +
        '→ 複数スプレッドシートを使う場合は createProject() でプロジェクトを作成してください\n' +
        '→ 設定状況を確認するには checkConfig() を実行してください'
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

  const githubToken = storageClient.getProperty(CONFIG_KEYS.GITHUB_AUTH.TOKEN)!;
  return { ...baseConfig, github: { token: githubToken, repositories } };
}

/**
 * 設定を保存
 *
 * @param partialConfig - 保存する設定（部分的でもOK）
 */
export function setConfig(partialConfig: {
  github?: { token?: string; appConfig?: GitHubAppConfig; repositories?: GitHubRepository[] };
  spreadsheet?: { id?: string; sheetName?: string };
  projects?: ProjectGroup[];
}): void {
  const { storageClient } = getContainer();

  if (partialConfig.github) {
    if (partialConfig.github.token !== undefined) {
      storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.TOKEN, partialConfig.github.token);
    }

    if (partialConfig.github.appConfig) {
      const { appId, privateKey, installationId } = partialConfig.github.appConfig;
      storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.APP_ID, appId);
      storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.APP_PRIVATE_KEY, privateKey);
      storageClient.setProperty(CONFIG_KEYS.GITHUB_AUTH.APP_INSTALLATION_ID, installationId);
    }

    if (partialConfig.github.repositories !== undefined) {
      storageClient.setProperty(
        CONFIG_KEYS.GITHUB_API.REPOSITORIES,
        JSON.stringify(partialConfig.github.repositories)
      );
    }
  }

  if (partialConfig.spreadsheet) {
    if (partialConfig.spreadsheet.id !== undefined) {
      storageClient.setProperty(CONFIG_KEYS.SPREADSHEET.ID, partialConfig.spreadsheet.id);
    }
    if (partialConfig.spreadsheet.sheetName !== undefined) {
      storageClient.setProperty('SHEET_NAME', partialConfig.spreadsheet.sheetName);
    }
  }

  if (partialConfig.projects !== undefined) {
    storageClient.setProperty(
      CONFIG_KEYS.SPREADSHEET.PROJECT_GROUPS,
      JSON.stringify(partialConfig.projects)
    );
  }
}
