/**
 * 統合テスト - DevOps指標の同期フロー全体をテスト
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getConfig, setConfig, addRepository } from "../../src/config/settings";
import { getAllRepositoriesData } from "../../src/services/github";
import { writeMetricsToSheet } from "../../src/services/spreadsheet";
import { calculateMetricsForRepository } from "../../src/utils/metrics";
import {
  setupTestContainer,
  teardownTestContainer,
  setupDefaultConfig,
  type TestContainer,
} from "../helpers/setup";
import { MockSheet } from "../mocks";
import type { DevOpsMetrics } from "../../src/types";

describe("Integration: syncDevOpsMetrics flow", () => {
  let container: TestContainer;

  beforeEach(() => {
    container = setupTestContainer();
    setupDefaultConfig(container.storageClient);
  });

  afterEach(() => {
    teardownTestContainer();
  });

  it("設定取得 → GitHub データ取得 → メトリクス計算 → スプレッドシート書き込み", () => {
    // Setup: GitHub API モックレスポンス
    container.httpClient.setJsonResponse(
      "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
      200,
      [
        {
          id: 1,
          number: 1,
          title: "Feature: Add new feature",
          state: "closed",
          created_at: "2024-01-01T10:00:00Z",
          merged_at: "2024-01-01T14:00:00Z",
          closed_at: "2024-01-01T14:00:00Z",
          user: { login: "developer" },
        },
        {
          id: 2,
          number: 2,
          title: "Fix: Bug fix",
          state: "closed",
          created_at: "2024-01-02T09:00:00Z",
          merged_at: "2024-01-02T11:00:00Z",
          closed_at: "2024-01-02T11:00:00Z",
          user: { login: "developer" },
        },
      ]
    );

    container.httpClient.setJsonResponse(
      "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc",
      200,
      []
    );

    container.httpClient.setJsonResponse(
      "https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=1",
      200,
      {
        workflow_runs: [
          {
            id: 1,
            name: "Deploy to Production",
            status: "completed",
            conclusion: "success",
            created_at: "2024-01-01T14:30:00Z",
            updated_at: "2024-01-01T14:35:00Z",
          },
          {
            id: 2,
            name: "Deploy to Production",
            status: "completed",
            conclusion: "failure",
            created_at: "2024-01-02T11:30:00Z",
            updated_at: "2024-01-02T11:35:00Z",
          },
          {
            id: 3,
            name: "Deploy to Production",
            status: "completed",
            conclusion: "success",
            created_at: "2024-01-02T12:00:00Z",
            updated_at: "2024-01-02T12:05:00Z",
          },
        ],
      }
    );

    container.httpClient.setJsonResponse(
      "https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=2",
      200,
      { workflow_runs: [] }
    );

    // Setup: スプレッドシート
    const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-spreadsheet-id");

    // Step 1: 設定を取得
    const config = getConfig();
    expect(config.github.repositories).toHaveLength(1);
    expect(config.github.repositories[0].fullName).toBe("test-owner/test-repo");

    // Step 2: GitHub からデータを取得
    const { pullRequests, workflowRuns } = getAllRepositoriesData(
      config.github.repositories,
      config.github.token
    );

    expect(pullRequests).toHaveLength(2);
    expect(workflowRuns).toHaveLength(3);

    // Step 3: メトリクスを計算
    const metrics: DevOpsMetrics[] = config.github.repositories.map((repo) =>
      calculateMetricsForRepository(repo.fullName, pullRequests, workflowRuns)
    );

    expect(metrics).toHaveLength(1);
    expect(metrics[0].repository).toBe("test-owner/test-repo");
    expect(metrics[0].leadTimeForChangesHours).toBe(3); // (4 + 2) / 2 = 3 hours
    expect(metrics[0].totalDeployments).toBe(3);
    expect(metrics[0].failedDeployments).toBe(1);
    expect(metrics[0].changeFailureRate).toBeCloseTo(33.3, 0);

    // Step 4: スプレッドシートに書き込み
    writeMetricsToSheet(config.spreadsheet.id, config.spreadsheet.sheetName, metrics);

    const sheet = spreadsheet.getSheetByName(config.spreadsheet.sheetName) as MockSheet;
    expect(sheet).not.toBeNull();
    const data = sheet!.getData();
    expect(data).toHaveLength(2); // ヘッダー + 1行
    expect(data[1][1]).toBe("test-owner/test-repo");
  });

  it("複数リポジトリの同期", () => {
    // 2つ目のリポジトリを追加
    addRepository("another-owner", "another-repo");

    // Repo 1 のモック
    container.httpClient.setJsonResponse(
      "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
      200,
      []
    );
    container.httpClient.setJsonResponse(
      "https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=1",
      200,
      { workflow_runs: [] }
    );

    // Repo 2 のモック
    container.httpClient.setJsonResponse(
      "https://api.github.com/repos/another-owner/another-repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
      200,
      [
        {
          id: 1,
          number: 1,
          title: "PR in another repo",
          state: "closed",
          created_at: "2024-01-01T10:00:00Z",
          merged_at: "2024-01-01T12:00:00Z",
          closed_at: "2024-01-01T12:00:00Z",
          user: { login: "user" },
        },
      ]
    );
    container.httpClient.setJsonResponse(
      "https://api.github.com/repos/another-owner/another-repo/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc",
      200,
      []
    );
    container.httpClient.setJsonResponse(
      "https://api.github.com/repos/another-owner/another-repo/actions/runs?per_page=100&page=1",
      200,
      {
        workflow_runs: [
          {
            id: 1,
            name: "Deploy",
            status: "completed",
            conclusion: "success",
            created_at: "2024-01-01T12:30:00Z",
            updated_at: "2024-01-01T12:35:00Z",
          },
        ],
      }
    );
    container.httpClient.setJsonResponse(
      "https://api.github.com/repos/another-owner/another-repo/actions/runs?per_page=100&page=2",
      200,
      { workflow_runs: [] }
    );

    const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-spreadsheet-id");

    const config = getConfig();
    expect(config.github.repositories).toHaveLength(2);

    const { pullRequests, workflowRuns } = getAllRepositoriesData(
      config.github.repositories,
      config.github.token
    );

    expect(pullRequests).toHaveLength(1); // another-repo only
    expect(workflowRuns).toHaveLength(1); // another-repo only

    const metrics: DevOpsMetrics[] = config.github.repositories.map((repo) =>
      calculateMetricsForRepository(repo.fullName, pullRequests, workflowRuns)
    );

    expect(metrics).toHaveLength(2);

    writeMetricsToSheet(config.spreadsheet.id, config.spreadsheet.sheetName, metrics);

    const sheet = spreadsheet.getSheetByName(config.spreadsheet.sheetName) as MockSheet;
    const data = sheet!.getData();
    expect(data).toHaveLength(3); // ヘッダー + 2行
  });

  it("API エラー時も処理を継続する", () => {
    // GitHub API がエラーを返す
    container.httpClient.setResponse(
      "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
      { statusCode: 500, content: "Internal Server Error" }
    );
    container.httpClient.setResponse(
      "https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=1",
      { statusCode: 500, content: "Internal Server Error" }
    );

    const config = getConfig();
    const { pullRequests, workflowRuns } = getAllRepositoriesData(
      config.github.repositories,
      config.github.token
    );

    // エラーが発生しても空の結果が返る
    expect(pullRequests).toHaveLength(0);
    expect(workflowRuns).toHaveLength(0);

    // エラーログが出力されている
    expect(container.logger.logs.some((log) => log.includes("PR fetch failed"))).toBe(true);
    expect(container.logger.logs.some((log) => log.includes("Workflow fetch failed"))).toBe(true);
  });
});

describe("Integration: Configuration management", () => {
  let container: TestContainer;

  beforeEach(() => {
    container = setupTestContainer();
  });

  afterEach(() => {
    teardownTestContainer();
  });

  it("初期設定 → リポジトリ追加 → 設定確認", () => {
    // 初期設定
    setConfig({
      github: { token: "new-token", repositories: [] },
      spreadsheet: { id: "new-spreadsheet-id", sheetName: "New Sheet" },
    });

    // リポジトリ追加
    addRepository("owner1", "repo1");
    addRepository("owner2", "repo2");

    // 設定確認
    const config = getConfig();
    expect(config.github.token).toBe("new-token");
    expect(config.github.repositories).toHaveLength(2);
    expect(config.github.repositories[0].fullName).toBe("owner1/repo1");
    expect(config.github.repositories[1].fullName).toBe("owner2/repo2");
    expect(config.spreadsheet.id).toBe("new-spreadsheet-id");
    expect(config.spreadsheet.sheetName).toBe("New Sheet");
  });
});
