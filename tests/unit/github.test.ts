/**
 * github.ts のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  getPullRequests,
  getWorkflowRuns,
  getDeployments,
  getAllRepositoriesData,
} from "../../src/services/github";
import { setupTestContainer, teardownTestContainer, type TestContainer } from "../helpers/setup";
import type { GitHubRepository } from "../../src/types";

describe("github", () => {
  let container: TestContainer;

  beforeEach(() => {
    container = setupTestContainer();
  });

  afterEach(() => {
    teardownTestContainer();
  });

  const testRepo: GitHubRepository = {
    owner: "test-owner",
    name: "test-repo",
    fullName: "test-owner/test-repo",
  };

  describe("getPullRequests", () => {
    it("PRを正しく取得する", () => {
      container.httpClient.setJsonResponse(
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

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc",
        200,
        []
      );

      const result = getPullRequests(testRepo, "test-token");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].title).toBe("Test PR");
      expect(result.data![0].repository).toBe("test-owner/test-repo");
    });

    it("APIエラー時はエラーを返す", () => {
      container.httpClient.setResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
        { statusCode: 401, content: "Unauthorized" }
      );

      const result = getPullRequests(testRepo, "invalid-token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("401");
    });

    it("日付範囲でフィルタリングする", () => {
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
        200,
        [
          {
            id: 1,
            number: 1,
            title: "Old PR",
            state: "closed",
            created_at: "2023-01-01T10:00:00Z",
            merged_at: "2023-01-01T12:00:00Z",
            closed_at: "2023-01-01T12:00:00Z",
            user: { login: "test-user" },
          },
          {
            id: 2,
            number: 2,
            title: "New PR",
            state: "closed",
            created_at: "2024-06-01T10:00:00Z",
            merged_at: "2024-06-01T12:00:00Z",
            closed_at: "2024-06-01T12:00:00Z",
            user: { login: "test-user" },
          },
        ]
      );

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc",
        200,
        []
      );

      const result = getPullRequests(testRepo, "test-token", "all", {
        since: new Date("2024-01-01"),
        until: new Date("2024-12-31"),
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].title).toBe("New PR");
    });

    it("ページネーションを正しく処理する", () => {
      // Page 1
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
        200,
        [
          {
            id: 1,
            number: 1,
            title: "PR 1",
            state: "open",
            created_at: "2024-01-01T10:00:00Z",
            merged_at: null,
            closed_at: null,
            user: { login: "user1" },
          },
        ]
      );

      // Page 2
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc",
        200,
        [
          {
            id: 2,
            number: 2,
            title: "PR 2",
            state: "open",
            created_at: "2024-01-02T10:00:00Z",
            merged_at: null,
            closed_at: null,
            user: { login: "user2" },
          },
        ]
      );

      // Page 3 (empty)
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=3&sort=updated&direction=desc",
        200,
        []
      );

      const result = getPullRequests(testRepo, "test-token");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("getWorkflowRuns", () => {
    it("ワークフロー実行を正しく取得する", () => {
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=1",
        200,
        {
          workflow_runs: [
            {
              id: 1,
              name: "CI",
              status: "completed",
              conclusion: "success",
              created_at: "2024-01-01T10:00:00Z",
              updated_at: "2024-01-01T10:05:00Z",
            },
          ],
        }
      );

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=2",
        200,
        { workflow_runs: [] }
      );

      const result = getWorkflowRuns(testRepo, "test-token");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe("CI");
      expect(result.data![0].repository).toBe("test-owner/test-repo");
    });

    it("APIエラー時はエラーを返す", () => {
      container.httpClient.setResponse(
        "https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=1",
        { statusCode: 403, content: "Forbidden" }
      );

      const result = getWorkflowRuns(testRepo, "test-token");

      expect(result.success).toBe(false);
      expect(result.error).toContain("403");
    });

    it("日付範囲パラメータを正しく設定する", () => {
      const since = new Date("2024-01-01");
      const sinceStr = since.toISOString().split("T")[0];

      container.httpClient.setJsonResponse(
        `https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=1&created=${encodeURIComponent(">=" + sinceStr)}`,
        200,
        { workflow_runs: [] }
      );

      const result = getWorkflowRuns(testRepo, "test-token", { since });

      expect(result.success).toBe(true);
      // Verify the correct URL was called
      const calls = container.httpClient.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain("created=%3E%3D2024-01-01");
    });
  });

  describe("getDeployments", () => {
    it("デプロイメントを正しく取得する", () => {
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=1&environment=production",
        200,
        [
          {
            id: 1,
            sha: "abc123",
            environment: "production",
            created_at: "2024-01-01T10:00:00Z",
            updated_at: "2024-01-01T10:05:00Z",
          },
        ]
      );

      // Deployment status
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/deployments/1/statuses?per_page=1",
        200,
        [{ state: "success" }]
      );

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=2&environment=production",
        200,
        []
      );

      const result = getDeployments(testRepo, "test-token", { environment: "production" });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].sha).toBe("abc123");
      expect(result.data![0].status).toBe("success");
      expect(result.data![0].repository).toBe("test-owner/test-repo");
    });

    it("skipStatusFetch=trueでステータス取得をスキップする", () => {
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=1",
        200,
        [
          {
            id: 1,
            sha: "abc123",
            environment: "production",
            created_at: "2024-01-01T10:00:00Z",
            updated_at: "2024-01-01T10:05:00Z",
          },
        ]
      );

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=2",
        200,
        []
      );

      const result = getDeployments(testRepo, "test-token", { skipStatusFetch: true });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].status).toBeNull(); // ステータス未取得

      // ステータスAPIは呼ばれていない
      const calls = container.httpClient.calls;
      expect(calls.every((c) => !c.url.includes("/statuses"))).toBe(true);
    });

    it("APIエラー時はエラーを返す", () => {
      container.httpClient.setResponse(
        "https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=1&environment=production",
        { statusCode: 404, content: "Not Found" }
      );

      const result = getDeployments(testRepo, "test-token", { environment: "production" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("404");
    });

    it("日付範囲でフィルタリングする", () => {
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=1",
        200,
        [
          {
            id: 1,
            sha: "old",
            environment: "production",
            created_at: "2023-01-01T10:00:00Z",
            updated_at: "2023-01-01T10:05:00Z",
          },
          {
            id: 2,
            sha: "new",
            environment: "production",
            created_at: "2024-06-01T10:00:00Z",
            updated_at: "2024-06-01T10:05:00Z",
          },
        ]
      );

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/deployments/2/statuses?per_page=1",
        200,
        [{ state: "success" }]
      );

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=2",
        200,
        []
      );

      const result = getDeployments(testRepo, "test-token", {
        dateRange: {
          since: new Date("2024-01-01"),
          until: new Date("2024-12-31"),
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].sha).toBe("new");
    });
  });

  describe("getAllRepositoriesData", () => {
    it("複数リポジトリからデータを取得する", () => {
      const repos: GitHubRepository[] = [
        { owner: "owner1", name: "repo1", fullName: "owner1/repo1" },
        { owner: "owner2", name: "repo2", fullName: "owner2/repo2" },
      ];

      // Repo 1 PRs
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner1/repo1/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
        200,
        [
          {
            id: 1,
            number: 1,
            title: "PR 1",
            state: "open",
            created_at: "2024-01-01T10:00:00Z",
            merged_at: null,
            closed_at: null,
            user: { login: "user" },
          },
        ]
      );
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner1/repo1/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc",
        200,
        []
      );

      // Repo 1 Runs
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner1/repo1/actions/runs?per_page=100&page=1",
        200,
        {
          workflow_runs: [
            {
              id: 1,
              name: "CI",
              status: "completed",
              conclusion: "success",
              created_at: "2024-01-01T10:00:00Z",
              updated_at: "2024-01-01T10:05:00Z",
            },
          ],
        }
      );
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner1/repo1/actions/runs?per_page=100&page=2",
        200,
        { workflow_runs: [] }
      );

      // Repo 2 PRs
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner2/repo2/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
        200,
        [
          {
            id: 2,
            number: 1,
            title: "PR 2",
            state: "closed",
            created_at: "2024-01-02T10:00:00Z",
            merged_at: "2024-01-02T12:00:00Z",
            closed_at: "2024-01-02T12:00:00Z",
            user: { login: "user" },
          },
        ]
      );
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner2/repo2/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc",
        200,
        []
      );

      // Repo 2 Runs
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner2/repo2/actions/runs?per_page=100&page=1",
        200,
        {
          workflow_runs: [
            {
              id: 2,
              name: "Deploy",
              status: "completed",
              conclusion: "failure",
              created_at: "2024-01-02T10:00:00Z",
              updated_at: "2024-01-02T10:05:00Z",
            },
          ],
        }
      );
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner2/repo2/actions/runs?per_page=100&page=2",
        200,
        { workflow_runs: [] }
      );

      // Repo 1 Deployments
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner1/repo1/deployments?per_page=100&page=1&environment=production",
        200,
        []
      );

      // Repo 2 Deployments
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner2/repo2/deployments?per_page=100&page=1&environment=production",
        200,
        [
          {
            id: 1,
            sha: "abc123",
            environment: "production",
            created_at: "2024-01-02T10:00:00Z",
            updated_at: "2024-01-02T10:05:00Z",
          },
        ]
      );
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner2/repo2/deployments/1/statuses?per_page=1",
        200,
        [{ state: "success" }]
      );
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner2/repo2/deployments?per_page=100&page=2&environment=production",
        200,
        []
      );

      const result = getAllRepositoriesData(repos, "test-token");

      expect(result.pullRequests).toHaveLength(2);
      expect(result.workflowRuns).toHaveLength(2);
      expect(result.deployments).toHaveLength(1);
      expect(result.pullRequests[0].repository).toBe("owner1/repo1");
      expect(result.pullRequests[1].repository).toBe("owner2/repo2");
      expect(result.deployments[0].repository).toBe("owner2/repo2");
    });

    it("ログを出力する", () => {
      const repos: GitHubRepository[] = [
        { owner: "owner", name: "repo", fullName: "owner/repo" },
      ];

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner/repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
        200,
        []
      );
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner/repo/actions/runs?per_page=100&page=1",
        200,
        { workflow_runs: [] }
      );
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner/repo/deployments?per_page=100&page=1&environment=production",
        200,
        []
      );

      getAllRepositoriesData(repos, "test-token");

      expect(container.logger.logs).toContain("📡 Fetching data for owner/repo...");
    });

    it("エラー時もログを出力して続行する", () => {
      const repos: GitHubRepository[] = [
        { owner: "owner", name: "repo", fullName: "owner/repo" },
      ];

      container.httpClient.setResponse(
        "https://api.github.com/repos/owner/repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
        { statusCode: 500, content: "Server Error" }
      );
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner/repo/actions/runs?per_page=100&page=1",
        200,
        { workflow_runs: [] }
      );
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner/repo/deployments?per_page=100&page=1&environment=production",
        200,
        []
      );

      const result = getAllRepositoriesData(repos, "test-token");

      expect(result.pullRequests).toHaveLength(0);
      expect(container.logger.logs.some((log) => log.includes("PR fetch failed"))).toBe(true);
    });

    it("カスタム環境名を指定できる", () => {
      const repos: GitHubRepository[] = [
        { owner: "owner", name: "repo", fullName: "owner/repo" },
      ];

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner/repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc",
        200,
        []
      );
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner/repo/actions/runs?per_page=100&page=1",
        200,
        { workflow_runs: [] }
      );
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/owner/repo/deployments?per_page=100&page=1&environment=prod",
        200,
        []
      );

      const result = getAllRepositoriesData(repos, "test-token", {
        deploymentEnvironment: "prod",
      });

      // Verify the correct environment was used
      const calls = container.httpClient.calls;
      expect(calls.some((c) => c.url.includes("environment=prod"))).toBe(true);
    });
  });
});
