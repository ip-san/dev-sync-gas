import type { Config, GitHubRepository, GitHubAppConfig, ProjectGroup } from "../types";
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

  const spreadsheetId = storageClient.getProperty("SPREADSHEET_ID");
  const sheetName = storageClient.getProperty("SHEET_NAME") ?? "DevOps Metrics";
  const repositoriesJson = storageClient.getProperty("GITHUB_REPOSITORIES");
  const projectsJson = storageClient.getProperty("PROJECTS");

  // projectsが設定されている場合はそちらを使用、なければ従来の単一スプレッドシート設定
  const projects: ProjectGroup[] = projectsJson ? JSON.parse(projectsJson) : [];

  // projectsがない場合は従来の設定が必須
  if (projects.length === 0 && !spreadsheetId) {
    throw new Error(
      "SPREADSHEET_ID is not set\n" +
      "→ setup('GITHUB_TOKEN', 'SPREADSHEET_ID') または setupWithGitHubApp() で設定してください\n" +
      "→ 複数スプレッドシートを使う場合は createProject() でプロジェクトを作成してください\n" +
      "→ 設定状況を確認するには checkConfig() を実行してください"
    );
  }

  const repositories: GitHubRepository[] = repositoriesJson
    ? JSON.parse(repositoriesJson)
    : [];

  const authMode = getGitHubAuthMode();

  if (authMode === "none") {
    // 部分的に設定されているか確認して、より詳細なエラーを出す
    const appId = storageClient.getProperty("GITHUB_APP_ID");
    const privateKey = storageClient.getProperty("GITHUB_APP_PRIVATE_KEY");
    const installationId = storageClient.getProperty("GITHUB_APP_INSTALLATION_ID");

    if (appId || privateKey || installationId) {
      const missing: string[] = [];
      if (!appId) missing.push("App ID");
      if (!privateKey) missing.push("Private Key");
      if (!installationId) missing.push("Installation ID");

      throw new Error(
        `GitHub Apps設定が不完全です（${missing.join(", ")} が未設定）\n` +
        "→ setupWithGitHubApp(appId, privateKey, installationId, spreadsheetId) で全ての値を設定してください\n" +
        "→ 設定状況を確認するには checkConfig() を実行してください"
      );
    }

    throw new Error(
      "GitHub認証が設定されていません\n" +
      "→ PAT認証: setup('GITHUB_TOKEN', 'SPREADSHEET_ID')\n" +
      "→ GitHub Apps認証: setupWithGitHubApp(appId, privateKey, installationId, spreadsheetId)\n" +
      "→ 設定状況を確認するには checkConfig() を実行してください"
    );
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
      spreadsheet: { id: spreadsheetId ?? "", sheetName },
      projects: projects.length > 0 ? projects : undefined,
    };
  }

  // PAT認証
  const githubToken = storageClient.getProperty("GITHUB_TOKEN")!;

  return {
    github: { token: githubToken, repositories },
    spreadsheet: { id: spreadsheetId ?? "", sheetName },
    projects: projects.length > 0 ? projects : undefined,
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
  if (config.spreadsheet?.id) {
    storageClient.setProperty("SPREADSHEET_ID", config.spreadsheet.id);
  }
  if (config.spreadsheet?.sheetName) {
    storageClient.setProperty("SHEET_NAME", config.spreadsheet.sheetName);
  }
  if (config.projects) {
    storageClient.setProperty("PROJECTS", JSON.stringify(config.projects));
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
  const config = getConfig();
  const projects = config.projects ?? [];

  const exists = projects.some((p) => p.name === project.name);
  if (exists) {
    throw new Error(`Project "${project.name}" already exists`);
  }

  projects.push(project);
  setConfig({ projects });
}

/**
 * プロジェクトグループを更新
 */
export function updateProject(name: string, updates: Partial<Omit<ProjectGroup, "name">>): void {
  const config = getConfig();
  const projects = config.projects ?? [];

  const index = projects.findIndex((p) => p.name === name);
  if (index === -1) {
    throw new Error(`Project "${name}" not found`);
  }

  projects[index] = { ...projects[index], ...updates };
  setConfig({ projects });
}

/**
 * プロジェクトグループを削除
 */
export function removeProject(name: string): void {
  const config = getConfig();
  const projects = (config.projects ?? []).filter((p) => p.name !== name);
  setConfig({ projects });
}

/**
 * プロジェクトグループにリポジトリを追加
 */
export function addRepositoryToProject(projectName: string, owner: string, repoName: string): void {
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

  project.repositories = project.repositories.filter((r) => r.fullName !== fullName);
  setConfig({ projects });
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
  const { storageClient } = getContainer();
  const json = storageClient.getProperty("CODING_TIME_ISSUE_LABELS");
  if (!json) return [];
  return JSON.parse(json);
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
  const { storageClient } = getContainer();
  storageClient.setProperty("CODING_TIME_ISSUE_LABELS", JSON.stringify(labels));
}

/**
 * コーディングタイムIssueラベル設定をリセット（全Issue対象に戻す）
 */
export function resetCodingTimeIssueLabels(): void {
  const { storageClient } = getContainer();
  storageClient.deleteProperty("CODING_TIME_ISSUE_LABELS");
}

// ============================================================
// 設定診断
// ============================================================

/**
 * 設定項目の診断結果
 */
export interface ConfigDiagnosticItem {
  name: string;
  status: "ok" | "warning" | "error";
  message: string;
  hint?: string;
}

/**
 * 設定診断結果
 */
export interface ConfigDiagnosticResult {
  items: ConfigDiagnosticItem[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

/**
 * 設定状況を診断する
 * 設定ミスを分かりやすいメッセージで報告
 *
 * @returns 診断結果
 */
export function diagnoseConfig(): ConfigDiagnosticResult {
  const { storageClient } = getContainer();
  const items: ConfigDiagnosticItem[] = [];

  // 1. スプレッドシートID
  const spreadsheetId = storageClient.getProperty("SPREADSHEET_ID");
  if (!spreadsheetId) {
    items.push({
      name: "Spreadsheet ID",
      status: "error",
      message: "未設定です",
      hint: "setup('GITHUB_TOKEN', 'SPREADSHEET_ID') または setupWithGitHubApp() で設定してください",
    });
  } else {
    items.push({
      name: "Spreadsheet ID",
      status: "ok",
      message: `設定済み: ${spreadsheetId.substring(0, 10)}...`,
    });
  }

  // 2. GitHub認証
  const authMode = getGitHubAuthMode();
  if (authMode === "none") {
    const appId = storageClient.getProperty("GITHUB_APP_ID");
    const privateKey = storageClient.getProperty("GITHUB_APP_PRIVATE_KEY");
    const installationId = storageClient.getProperty("GITHUB_APP_INSTALLATION_ID");
    const token = storageClient.getProperty("GITHUB_TOKEN");

    // 部分的に設定されている場合のヒント
    if (appId || privateKey || installationId) {
      const missing: string[] = [];
      if (!appId) missing.push("App ID");
      if (!privateKey) missing.push("Private Key");
      if (!installationId) missing.push("Installation ID");

      items.push({
        name: "GitHub認証",
        status: "error",
        message: `GitHub Apps設定が不完全です（${missing.join(", ")} が未設定）`,
        hint: "setupWithGitHubApp(appId, privateKey, installationId, spreadsheetId) で全ての値を設定してください",
      });
    } else if (!token) {
      items.push({
        name: "GitHub認証",
        status: "error",
        message: "GitHub認証が設定されていません",
        hint: "setup('GITHUB_TOKEN', 'SPREADSHEET_ID') でPAT認証、または setupWithGitHubApp() でGitHub Apps認証を設定してください",
      });
    }
  } else if (authMode === "pat") {
    const token = storageClient.getProperty("GITHUB_TOKEN");
    // トークン形式の簡易チェック
    if (token && !token.startsWith("ghp_") && !token.startsWith("github_pat_")) {
      items.push({
        name: "GitHub認証",
        status: "warning",
        message: "PAT認証（トークン形式が通常と異なります）",
        hint: "Fine-grained PATは 'github_pat_' で始まり、Classic PATは 'ghp_' で始まります。正しいトークンか確認してください",
      });
    } else {
      items.push({
        name: "GitHub認証",
        status: "ok",
        message: "PAT認証 (Personal Access Token)",
      });
    }
  } else if (authMode === "app") {
    items.push({
      name: "GitHub認証",
      status: "ok",
      message: "GitHub Apps認証",
    });

    // Private Key形式の簡易チェック
    const privateKey = storageClient.getProperty("GITHUB_APP_PRIVATE_KEY");
    if (privateKey) {
      const hasValidHeader = privateKey.includes("-----BEGIN RSA PRIVATE KEY-----") ||
                            privateKey.includes("-----BEGIN PRIVATE KEY-----");
      const hasValidFooter = privateKey.includes("-----END RSA PRIVATE KEY-----") ||
                            privateKey.includes("-----END PRIVATE KEY-----");

      if (!hasValidHeader || !hasValidFooter) {
        items.push({
          name: "Private Key形式",
          status: "error",
          message: "PEM形式ではありません",
          hint: "Private Keyは '-----BEGIN RSA PRIVATE KEY-----' で始まる必要があります。改行は \\n に置換してください",
        });
      }
    }
  }

  // 3. リポジトリ設定
  const repositoriesJson = storageClient.getProperty("GITHUB_REPOSITORIES");
  let repositories: { owner: string; name: string; fullName: string }[] = [];
  let jsonParseError = false;
  try {
    repositories = repositoriesJson ? JSON.parse(repositoriesJson) : [];
  } catch {
    jsonParseError = true;
    items.push({
      name: "リポジトリ設定",
      status: "error",
      message: "リポジトリ設定のJSON形式が不正です",
      hint: "addRepo('owner', 'repo-name') で再設定してください",
    });
  }

  if (!jsonParseError) {
    if (repositories.length === 0) {
      items.push({
        name: "リポジトリ",
        status: "warning",
        message: "リポジトリが登録されていません",
        hint: "addRepo('owner', 'repo-name') でリポジトリを追加してください",
      });
    } else {
      items.push({
        name: "リポジトリ",
        status: "ok",
        message: `${repositories.length}件登録済み: ${repositories.map(r => r.fullName).join(", ")}`,
      });
    }
  }

  // 結果のサマリー
  const hasErrors = items.some((item) => item.status === "error");
  const hasWarnings = items.some((item) => item.status === "warning");

  return { items, hasErrors, hasWarnings };
}

/**
 * 設定診断結果をフォーマットして文字列で返す
 */
export function formatDiagnosticResult(result: ConfigDiagnosticResult): string {
  const lines: string[] = [];
  lines.push("=== DevSyncGAS 設定診断 ===\n");

  for (const item of result.items) {
    const icon = item.status === "ok" ? "✅" : item.status === "warning" ? "⚠️" : "❌";
    lines.push(`${icon} ${item.name}: ${item.message}`);
    if (item.hint) {
      lines.push(`   → ${item.hint}`);
    }
  }

  lines.push("");

  if (result.hasErrors) {
    lines.push("❌ エラーがあります。上記のヒントを参考に設定を修正してください。");
  } else if (result.hasWarnings) {
    lines.push("⚠️ 警告があります。必要に応じて設定を確認してください。");
  } else {
    lines.push("✅ すべての設定が正常です。");
  }

  return lines.join("\n");
}
