import type { Config, GitHubRepository, GitHubAppConfig, NotionPropertyNames } from "../types";
import { DEFAULT_NOTION_PROPERTY_NAMES } from "../types";
import { getContainer } from "../container";
import { resolveGitHubToken } from "../services/githubAuth";

/**
 * GitHub認証モードを判定
 * @returns "app" | "pat" | "none"
 */
export function getGitHubAuthMode(): "app" | "pat" | "none" {
  const { storageClient } = getContainer();

  const appId = storageClient.getProperty("GITHUB_APP_ID");
  const privateKey = storageClient.getProperty("GITHUB_APP_PRIVATE_KEY");
  const installationId = storageClient.getProperty("GITHUB_APP_INSTALLATION_ID");

  if (appId && privateKey && installationId) {
    return "app";
  }

  const token = storageClient.getProperty("GITHUB_TOKEN");
  if (token) {
    return "pat";
  }

  return "none";
}

export function getConfig(): Config {
  const { storageClient } = getContainer();

  const notionToken = storageClient.getProperty("NOTION_TOKEN");
  const notionDatabaseId = storageClient.getProperty("NOTION_DATABASE_ID");
  const spreadsheetId = storageClient.getProperty("SPREADSHEET_ID");
  const sheetName = storageClient.getProperty("SHEET_NAME") ?? "DevOps Metrics";
  const repositoriesJson = storageClient.getProperty("GITHUB_REPOSITORIES");

  // Notionプロパティ名のカスタム設定を取得
  const notionPropertyNamesJson = storageClient.getProperty("NOTION_PROPERTY_NAMES");
  const notionPropertyNames: Partial<NotionPropertyNames> | undefined = notionPropertyNamesJson
    ? JSON.parse(notionPropertyNamesJson)
    : undefined;

  if (!spreadsheetId) throw new Error("SPREADSHEET_ID is not set");

  const repositories: GitHubRepository[] = repositoriesJson
    ? JSON.parse(repositoriesJson)
    : [];

  const authMode = getGitHubAuthMode();

  if (authMode === "none") {
    throw new Error("GitHub authentication not configured. Set either GITHUB_TOKEN or GitHub App credentials.");
  }

  // GitHub Apps認証
  if (authMode === "app") {
    const appConfig: GitHubAppConfig = {
      appId: storageClient.getProperty("GITHUB_APP_ID")!,
      privateKey: storageClient.getProperty("GITHUB_APP_PRIVATE_KEY")!,
      installationId: storageClient.getProperty("GITHUB_APP_INSTALLATION_ID")!,
    };

    return {
      github: { appConfig, repositories },
      notion: { token: notionToken || "", databaseId: notionDatabaseId || "", propertyNames: notionPropertyNames },
      spreadsheet: { id: spreadsheetId, sheetName },
    };
  }

  // PAT認証
  const githubToken = storageClient.getProperty("GITHUB_TOKEN")!;

  return {
    github: { token: githubToken, repositories },
    notion: { token: notionToken || "", databaseId: notionDatabaseId || "", propertyNames: notionPropertyNames },
    spreadsheet: { id: spreadsheetId, sheetName },
  };
}

export function setConfig(config: Partial<Config>): void {
  const { storageClient } = getContainer();

  if (config.github?.token) {
    storageClient.setProperty("GITHUB_TOKEN", config.github.token);
  }
  if (config.github?.appConfig) {
    storageClient.setProperty("GITHUB_APP_ID", config.github.appConfig.appId);
    storageClient.setProperty("GITHUB_APP_PRIVATE_KEY", config.github.appConfig.privateKey);
    storageClient.setProperty("GITHUB_APP_INSTALLATION_ID", config.github.appConfig.installationId);
  }
  if (config.github?.repositories) {
    storageClient.setProperty("GITHUB_REPOSITORIES", JSON.stringify(config.github.repositories));
  }
  if (config.notion?.token) {
    storageClient.setProperty("NOTION_TOKEN", config.notion.token);
  }
  if (config.notion?.databaseId) {
    storageClient.setProperty("NOTION_DATABASE_ID", config.notion.databaseId);
  }
  if (config.notion?.propertyNames) {
    storageClient.setProperty("NOTION_PROPERTY_NAMES", JSON.stringify(config.notion.propertyNames));
  }
  if (config.spreadsheet?.id) {
    storageClient.setProperty("SPREADSHEET_ID", config.spreadsheet.id);
  }
  if (config.spreadsheet?.sheetName) {
    storageClient.setProperty("SHEET_NAME", config.spreadsheet.sheetName);
  }
}

/**
 * GitHub Apps設定をクリア（PAT認証に戻す際に使用）
 */
export function clearGitHubAppConfig(): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty("GITHUB_APP_ID");
  storageClient.deleteProperty("GITHUB_APP_PRIVATE_KEY");
  storageClient.deleteProperty("GITHUB_APP_INSTALLATION_ID");
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
  const config = getConfig();
  const newRepo: GitHubRepository = { owner, name, fullName: `${owner}/${name}` };
  const exists = config.github.repositories.some((r) => r.fullName === newRepo.fullName);
  
  if (!exists) {
    config.github.repositories.push(newRepo);
    setConfig({ github: config.github });
  }
}

export function removeRepository(fullName: string): void {
  const config = getConfig();
  config.github.repositories = config.github.repositories.filter((r) => r.fullName !== fullName);
  setConfig({ github: config.github });
}

/**
 * Notionプロパティ名をカスタム設定
 *
 * @example
 * // 日本語プロパティ名を使う場合
 * setNotionPropertyNames({
 *   startedDate: "着手日",
 *   completedDate: "完了日",
 *   satisfaction: "満足度",
 *   prUrl: "PR URL"
 * });
 */
export function setNotionPropertyNames(propertyNames: Partial<NotionPropertyNames>): void {
  const { storageClient } = getContainer();
  storageClient.setProperty("NOTION_PROPERTY_NAMES", JSON.stringify(propertyNames));
}

/**
 * 現在のNotionプロパティ名設定を取得（デフォルト値とマージ済み）
 */
export function getNotionPropertyNames(): NotionPropertyNames {
  const { storageClient } = getContainer();
  const json = storageClient.getProperty("NOTION_PROPERTY_NAMES");
  const custom: Partial<NotionPropertyNames> = json ? JSON.parse(json) : {};

  return {
    ...DEFAULT_NOTION_PROPERTY_NAMES,
    ...custom,
  };
}

/**
 * Notionプロパティ名設定をリセット（デフォルトに戻す）
 */
export function resetNotionPropertyNames(): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty("NOTION_PROPERTY_NAMES");
}

// ============================================================
// サイクルタイム設定
// ============================================================

/** デフォルトのproductionブランチパターン */
const DEFAULT_PRODUCTION_BRANCH_PATTERN = "production";

/**
 * productionブランチパターンを取得
 * このパターンを含むブランチへのマージをproductionリリースとみなす
 *
 * @returns productionブランチパターン（デフォルト: "production"）
 */
export function getProductionBranchPattern(): string {
  const { storageClient } = getContainer();
  return storageClient.getProperty("PRODUCTION_BRANCH_PATTERN") ?? DEFAULT_PRODUCTION_BRANCH_PATTERN;
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
  storageClient.setProperty("PRODUCTION_BRANCH_PATTERN", pattern);
}

/**
 * productionブランチパターン設定をリセット
 */
export function resetProductionBranchPattern(): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty("PRODUCTION_BRANCH_PATTERN");
}

/**
 * サイクルタイム計測対象のIssueラベルを取得
 * 空配列の場合は全Issueが対象
 *
 * @returns ラベル配列（デフォルト: []）
 */
export function getCycleTimeIssueLabels(): string[] {
  const { storageClient } = getContainer();
  const json = storageClient.getProperty("CYCLE_TIME_ISSUE_LABELS");
  if (!json) return [];
  return JSON.parse(json);
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
  const { storageClient } = getContainer();
  storageClient.setProperty("CYCLE_TIME_ISSUE_LABELS", JSON.stringify(labels));
}

/**
 * サイクルタイムIssueラベル設定をリセット（全Issue対象に戻す）
 */
export function resetCycleTimeIssueLabels(): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty("CYCLE_TIME_ISSUE_LABELS");
}
