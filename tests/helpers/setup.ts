/**
 * テストセットアップヘルパー
 */

import { initializeContainer, resetContainer } from "../../src/container";
import {
  createMockContainer,
  MockHttpClient,
  MockSpreadsheetClient,
  MockStorageClient,
  MockLoggerClient,
  MockTriggerClient,
} from "../mocks";

export interface TestContainer {
  httpClient: MockHttpClient;
  spreadsheetClient: MockSpreadsheetClient;
  storageClient: MockStorageClient;
  logger: MockLoggerClient;
  triggerClient: MockTriggerClient;
}

/**
 * テスト用コンテナをセットアップする
 * beforeEach で呼び出す
 */
export function setupTestContainer(): TestContainer {
  const mocks = createMockContainer();
  initializeContainer(mocks);
  return mocks;
}

/**
 * テスト用コンテナをクリーンアップする
 * afterEach で呼び出す
 */
export function teardownTestContainer(): void {
  resetContainer();
}

/**
 * デフォルトの設定でストレージを初期化する
 */
export function setupDefaultConfig(storage: MockStorageClient): void {
  storage.setProperties({
    GITHUB_TOKEN: "test-github-token",
    SPREADSHEET_ID: "test-spreadsheet-id",
    SHEET_NAME: "DevOps Metrics",
    GITHUB_REPOSITORIES: JSON.stringify([
      { owner: "test-owner", name: "test-repo", fullName: "test-owner/test-repo" },
    ]),
  });
}

/**
 * GitHub APIのモックレスポンスを設定する
 */
export function setupGitHubMocks(http: MockHttpClient): void {
  // PRs response
  http.setJsonResponse(
    "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
    200,
    [
      {
        id: 1,
        number: 1,
        title: "Test PR",
        state: "closed",
        created_at: "2024-01-01T10:00:00Z",
        merged_at: "2024-01-01T12:00:00Z",
        closed_at: "2024-01-01T12:00:00Z",
        user: { login: "test-user" },
      },
    ]
  );

  // Empty page 2
  http.setJsonResponse(
    "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc",
    200,
    []
  );

  // Workflow runs response
  http.setJsonResponse(
    "https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=1",
    200,
    {
      workflow_runs: [
        {
          id: 1,
          name: "Deploy",
          status: "completed",
          conclusion: "success",
          created_at: "2024-01-01T12:00:00Z",
          updated_at: "2024-01-01T12:05:00Z",
        },
      ],
    }
  );

  // Empty page 2
  http.setJsonResponse(
    "https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=2",
    200,
    { workflow_runs: [] }
  );
}

/**
 * テスト用のPRデータを作成する
 */
export function createTestPR(overrides: Partial<{
  id: number;
  number: number;
  title: string;
  state: "open" | "closed";
  createdAt: string;
  mergedAt: string | null;
  closedAt: string | null;
  author: string;
  repository: string;
}> = {}) {
  return {
    id: 1,
    number: 1,
    title: "Test PR",
    state: "closed" as const,
    createdAt: "2024-01-01T10:00:00Z",
    mergedAt: "2024-01-01T12:00:00Z",
    closedAt: "2024-01-01T12:00:00Z",
    author: "test-user",
    repository: "test-owner/test-repo",
    ...overrides,
  };
}

/**
 * テスト用のワークフロー実行データを作成する
 */
export function createTestWorkflowRun(overrides: Partial<{
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  repository: string;
}> = {}) {
  return {
    id: 1,
    name: "Deploy",
    status: "completed",
    conclusion: "success",
    createdAt: "2024-01-01T12:00:00Z",
    updatedAt: "2024-01-01T12:05:00Z",
    repository: "test-owner/test-repo",
    ...overrides,
  };
}
