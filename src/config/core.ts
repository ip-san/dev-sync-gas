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
