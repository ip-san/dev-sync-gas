import type { Config, GitHubRepository } from "../types";
import { getContainer } from "../container";

export function getConfig(): Config {
  const { storageClient } = getContainer();

  const githubToken = storageClient.getProperty("GITHUB_TOKEN");
  const notionToken = storageClient.getProperty("NOTION_TOKEN");
  const notionDatabaseId = storageClient.getProperty("NOTION_DATABASE_ID");
  const spreadsheetId = storageClient.getProperty("SPREADSHEET_ID");
  const sheetName = storageClient.getProperty("SHEET_NAME") ?? "DevOps Metrics";
  const repositoriesJson = storageClient.getProperty("GITHUB_REPOSITORIES");

  if (!githubToken) throw new Error("GITHUB_TOKEN is not set");
  if (!spreadsheetId) throw new Error("SPREADSHEET_ID is not set");

  const repositories: GitHubRepository[] = repositoriesJson
    ? JSON.parse(repositoriesJson)
    : [];

  return {
    github: { token: githubToken, repositories },
    notion: { token: notionToken || "", databaseId: notionDatabaseId || "" },
    spreadsheet: { id: spreadsheetId, sheetName },
  };
}

export function setConfig(config: Partial<Config>): void {
  const { storageClient } = getContainer();

  if (config.github?.token) {
    storageClient.setProperty("GITHUB_TOKEN", config.github.token);
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
  if (config.spreadsheet?.id) {
    storageClient.setProperty("SPREADSHEET_ID", config.spreadsheet.id);
  }
  if (config.spreadsheet?.sheetName) {
    storageClient.setProperty("SHEET_NAME", config.spreadsheet.sheetName);
  }
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
 * インシデント計測設定
 */
export interface IncidentConfig {
  /**
   * インシデントとして認識するGitHub Issueのラベル
   * デフォルト: ["incident"]
   * 例: ["incident", "production-bug", "p0"]
   */
  labels: string[];
  /**
   * インシデント計測を有効にするかどうか
   * デフォルト: false
   */
  enabled: boolean;
}

/** デフォルトのインシデントラベル */
const DEFAULT_INCIDENT_LABELS = ["incident"];

/**
 * インシデント計測設定を取得
 */
export function getIncidentConfig(): IncidentConfig {
  const { storageClient } = getContainer();

  const labelsJson = storageClient.getProperty("INCIDENT_LABELS");
  const enabledStr = storageClient.getProperty("INCIDENT_TRACKING_ENABLED");

  const labels = labelsJson ? JSON.parse(labelsJson) : DEFAULT_INCIDENT_LABELS;
  const enabled = enabledStr === "true";

  return { labels, enabled };
}

/**
 * インシデント計測設定を保存
 */
export function setIncidentConfig(config: Partial<IncidentConfig>): void {
  const { storageClient } = getContainer();

  if (config.labels !== undefined) {
    storageClient.setProperty("INCIDENT_LABELS", JSON.stringify(config.labels));
  }
  if (config.enabled !== undefined) {
    storageClient.setProperty("INCIDENT_TRACKING_ENABLED", String(config.enabled));
  }
}

/**
 * インシデントラベルを追加
 */
export function addIncidentLabel(label: string): void {
  const config = getIncidentConfig();
  if (!config.labels.includes(label)) {
    config.labels.push(label);
    setIncidentConfig({ labels: config.labels });
  }
}

/**
 * インシデントラベルを削除
 */
export function removeIncidentLabel(label: string): void {
  const config = getIncidentConfig();
  config.labels = config.labels.filter((l) => l !== label);
  setIncidentConfig({ labels: config.labels });
}

/**
 * インシデント計測を有効化
 */
export function enableIncidentTracking(): void {
  setIncidentConfig({ enabled: true });
}

/**
 * インシデント計測を無効化
 */
export function disableIncidentTracking(): void {
  setIncidentConfig({ enabled: false });
}
