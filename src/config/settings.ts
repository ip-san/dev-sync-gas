import type { Config, GitHubRepository } from "../types";

export function getConfig(): Config {
  const props = PropertiesService.getScriptProperties();

  const githubToken = props.getProperty("GITHUB_TOKEN");
  const notionToken = props.getProperty("NOTION_TOKEN");
  const notionDatabaseId = props.getProperty("NOTION_DATABASE_ID");
  const spreadsheetId = props.getProperty("SPREADSHEET_ID");
  const sheetName = props.getProperty("SHEET_NAME") ?? "DevOps Metrics";
  const repositoriesJson = props.getProperty("GITHUB_REPOSITORIES");

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
  const props = PropertiesService.getScriptProperties();

  if (config.github?.token) {
    props.setProperty("GITHUB_TOKEN", config.github.token);
  }
  if (config.github?.repositories) {
    props.setProperty("GITHUB_REPOSITORIES", JSON.stringify(config.github.repositories));
  }
  if (config.notion?.token) {
    props.setProperty("NOTION_TOKEN", config.notion.token);
  }
  if (config.notion?.databaseId) {
    props.setProperty("NOTION_DATABASE_ID", config.notion.databaseId);
  }
  if (config.spreadsheet?.id) {
    props.setProperty("SPREADSHEET_ID", config.spreadsheet.id);
  }
  if (config.spreadsheet?.sheetName) {
    props.setProperty("SHEET_NAME", config.spreadsheet.sheetName);
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
