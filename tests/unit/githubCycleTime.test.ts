/**
 * サイクルタイム機能のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  getIssues,
  getLinkedPRsForIssue,
  getPullRequestWithBranches,
  findPRContainingCommit,
  trackToProductionMerge,
  getGitHubCycleTimeData,
} from "../../src/services/github";
import { calculateCycleTime } from "../../src/utils/metrics";
import { setupTestContainer, teardownTestContainer, type TestContainer } from "../helpers/setup";
import type { GitHubRepository, GitHubIssueCycleTime } from "../../src/types";

describe("GitHub Cycle Time", () => {
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

  describe("getIssues", () => {
    it("Issueを正しく取得する（PRを除外）", () => {
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/issues?state=all&per_page=100&page=1",
        200,
        [
          {
            id: 1,
            number: 1,
            title: "Feature request",
            state: "closed",
            created_at: "2024-01-01T10:00:00Z",
            closed_at: "2024-01-05T12:00:00Z",
            labels: [{ name: "feature" }],
          },
          {
            id: 2,
            number: 2,
            title: "Bug fix PR",
            state: "closed",
            created_at: "2024-01-02T10:00:00Z",
            closed_at: "2024-01-02T12:00:00Z",
            pull_request: { url: "https://api.github.com/repos/test-owner/test-repo/pulls/2" },
          },
          {
            id: 3,
            number: 3,
            title: "Another issue",
            state: "open",
            created_at: "2024-01-03T10:00:00Z",
            closed_at: null,
            labels: [],
          },
        ]
      );

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/issues?state=all&per_page=100&page=2",
        200,
        []
      );

      const result = getIssues(testRepo, "test-token");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2); // PRを除外
      expect(result.data![0].title).toBe("Feature request");
      expect(result.data![1].title).toBe("Another issue");
    });

    it("ラベルでフィルタリングできる", () => {
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/issues?state=all&per_page=100&labels=feature&page=1",
        200,
        [
          {
            id: 1,
            number: 1,
            title: "Feature request",
            state: "closed",
            created_at: "2024-01-01T10:00:00Z",
            closed_at: "2024-01-05T12:00:00Z",
            labels: [{ name: "feature" }],
          },
        ]
      );

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/issues?state=all&per_page=100&labels=feature&page=2",
        200,
        []
      );

      const result = getIssues(testRepo, "test-token", { labels: ["feature"] });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].labels).toContain("feature");
    });
  });

  describe("getLinkedPRsForIssue", () => {
    it("IssueにリンクされたPR番号を取得する", () => {
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/issues/1/timeline?per_page=100&page=1",
        200,
        [
          {
            event: "cross-referenced",
            source: {
              issue: {
                number: 10,
                pull_request: { url: "https://api.github.com/pulls/10" },
                repository: { full_name: "test-owner/test-repo" },
              },
            },
          },
          {
            event: "labeled",
            label: { name: "bug" },
          },
          {
            event: "cross-referenced",
            source: {
              issue: {
                number: 20,
                pull_request: { url: "https://api.github.com/pulls/20" },
                repository: { full_name: "test-owner/test-repo" },
              },
            },
          },
        ]
      );

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/issues/1/timeline?per_page=100&page=2",
        200,
        []
      );

      const result = getLinkedPRsForIssue("test-owner", "test-repo", 1, "test-token");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data).toContain(10);
      expect(result.data).toContain(20);
    });

    it("リンクPRがない場合は空配列を返す", () => {
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/issues/1/timeline?per_page=100&page=1",
        200,
        [
          { event: "labeled", label: { name: "bug" } },
          { event: "assigned", assignee: { login: "user" } },
        ]
      );

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/issues/1/timeline?per_page=100&page=2",
        200,
        []
      );

      const result = getLinkedPRsForIssue("test-owner", "test-repo", 1, "test-token");

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe("getPullRequestWithBranches", () => {
    it("PRの詳細（ブランチ情報含む）を取得する", () => {
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls/10",
        200,
        {
          id: 100,
          number: 10,
          title: "Feature implementation",
          state: "closed",
          draft: false,
          created_at: "2024-01-01T10:00:00Z",
          merged_at: "2024-01-02T12:00:00Z",
          user: { login: "developer" },
          base: { ref: "main" },
          head: { ref: "feature/new-feature" },
          merge_commit_sha: "abc123",
        }
      );

      const result = getPullRequestWithBranches("test-owner", "test-repo", 10, "test-token");

      expect(result.success).toBe(true);
      expect(result.data!.number).toBe(10);
      expect(result.data!.baseBranch).toBe("main");
      expect(result.data!.headBranch).toBe("feature/new-feature");
      expect(result.data!.mergeCommitSha).toBe("abc123");
    });
  });

  describe("findPRContainingCommit", () => {
    it("コミットSHAからPRを検索する", () => {
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/commits/abc123/pulls",
        200,
        [
          {
            id: 200,
            number: 20,
            title: "Merge to staging",
            state: "closed",
            draft: false,
            created_at: "2024-01-02T14:00:00Z",
            merged_at: "2024-01-02T16:00:00Z",
            user: { login: "developer" },
            base: { ref: "staging" },
            head: { ref: "main" },
            merge_commit_sha: "def456",
          },
        ]
      );

      const result = findPRContainingCommit("test-owner", "test-repo", "abc123", "test-token");

      expect(result.success).toBe(true);
      expect(result.data!.number).toBe(20);
      expect(result.data!.baseBranch).toBe("staging");
    });

    it("コミットがPRに含まれない場合はnullを返す", () => {
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/commits/xyz789/pulls",
        200,
        []
      );

      const result = findPRContainingCommit("test-owner", "test-repo", "xyz789", "test-token");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe("trackToProductionMerge", () => {
    it("単段階でproductionマージを検出する", () => {
      // PR #10: feature -> xxx_production
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls/10",
        200,
        {
          id: 100,
          number: 10,
          title: "Direct to production",
          state: "closed",
          draft: false,
          created_at: "2024-01-01T10:00:00Z",
          merged_at: "2024-01-02T12:00:00Z",
          user: { login: "developer" },
          base: { ref: "xxx_production" },
          head: { ref: "feature/direct" },
          merge_commit_sha: "abc123",
        }
      );

      const result = trackToProductionMerge("test-owner", "test-repo", 10, "test-token", "production");

      expect(result.success).toBe(true);
      expect(result.data!.productionMergedAt).toBe("2024-01-02T12:00:00Z");
      expect(result.data!.prChain).toHaveLength(1);
      expect(result.data!.prChain[0].baseBranch).toBe("xxx_production");
    });

    it("多段階でproductionマージを検出する", () => {
      // PR #10: feature -> main
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls/10",
        200,
        {
          id: 100,
          number: 10,
          title: "Feature to main",
          state: "closed",
          draft: false,
          created_at: "2024-01-01T10:00:00Z",
          merged_at: "2024-01-02T12:00:00Z",
          user: { login: "developer" },
          base: { ref: "main" },
          head: { ref: "feature/new" },
          merge_commit_sha: "commit_a",
        }
      );

      // commit_a が含まれるPR #20: main -> staging
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/commits/commit_a/pulls",
        200,
        [
          {
            id: 200,
            number: 20,
            title: "Main to staging",
            state: "closed",
            draft: false,
            created_at: "2024-01-02T14:00:00Z",
            merged_at: "2024-01-02T16:00:00Z",
            user: { login: "developer" },
            base: { ref: "staging" },
            head: { ref: "main" },
            merge_commit_sha: "commit_b",
          },
        ]
      );

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls/20",
        200,
        {
          id: 200,
          number: 20,
          title: "Main to staging",
          state: "closed",
          draft: false,
          created_at: "2024-01-02T14:00:00Z",
          merged_at: "2024-01-02T16:00:00Z",
          user: { login: "developer" },
          base: { ref: "staging" },
          head: { ref: "main" },
          merge_commit_sha: "commit_b",
        }
      );

      // commit_b が含まれるPR #30: staging -> production
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/commits/commit_b/pulls",
        200,
        [
          {
            id: 300,
            number: 30,
            title: "Staging to production",
            state: "closed",
            draft: false,
            created_at: "2024-01-03T10:00:00Z",
            merged_at: "2024-01-03T12:00:00Z",
            user: { login: "developer" },
            base: { ref: "app_production" },
            head: { ref: "staging" },
            merge_commit_sha: "commit_c",
          },
        ]
      );

      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls/30",
        200,
        {
          id: 300,
          number: 30,
          title: "Staging to production",
          state: "closed",
          draft: false,
          created_at: "2024-01-03T10:00:00Z",
          merged_at: "2024-01-03T12:00:00Z",
          user: { login: "developer" },
          base: { ref: "app_production" },
          head: { ref: "staging" },
          merge_commit_sha: "commit_c",
        }
      );

      const result = trackToProductionMerge("test-owner", "test-repo", 10, "test-token", "production");

      expect(result.success).toBe(true);
      expect(result.data!.productionMergedAt).toBe("2024-01-03T12:00:00Z");
      expect(result.data!.prChain).toHaveLength(3);
      expect(result.data!.prChain[0].prNumber).toBe(10);
      expect(result.data!.prChain[1].prNumber).toBe(20);
      expect(result.data!.prChain[2].prNumber).toBe(30);
    });

    it("productionマージがない場合はnullを返す", () => {
      // PR #10: feature -> main（まだマージされていない）
      container.httpClient.setJsonResponse(
        "https://api.github.com/repos/test-owner/test-repo/pulls/10",
        200,
        {
          id: 100,
          number: 10,
          title: "Feature",
          state: "open",
          draft: false,
          created_at: "2024-01-01T10:00:00Z",
          merged_at: null,
          user: { login: "developer" },
          base: { ref: "main" },
          head: { ref: "feature/wip" },
          merge_commit_sha: null,
        }
      );

      const result = trackToProductionMerge("test-owner", "test-repo", 10, "test-token", "production");

      expect(result.success).toBe(true);
      expect(result.data!.productionMergedAt).toBeNull();
      expect(result.data!.prChain).toHaveLength(1);
    });
  });

  describe("calculateCycleTime", () => {
    it("サイクルタイムを正しく計算する", () => {
      const cycleTimeData: GitHubIssueCycleTime[] = [
        {
          issueNumber: 1,
          issueTitle: "Issue 1",
          repository: "test-owner/test-repo",
          issueCreatedAt: "2024-01-01T00:00:00Z",
          productionMergedAt: "2024-01-03T00:00:00Z", // 48時間後
          cycleTimeHours: 48,
          prChain: [{ prNumber: 10, baseBranch: "production", headBranch: "feature", mergedAt: "2024-01-03T00:00:00Z" }],
        },
        {
          issueNumber: 2,
          issueTitle: "Issue 2",
          repository: "test-owner/test-repo",
          issueCreatedAt: "2024-01-02T00:00:00Z",
          productionMergedAt: "2024-01-05T12:00:00Z", // 84時間後
          cycleTimeHours: 84,
          prChain: [{ prNumber: 20, baseBranch: "production", headBranch: "feature", mergedAt: "2024-01-05T12:00:00Z" }],
        },
        {
          issueNumber: 3,
          issueTitle: "Issue 3 (未完了)",
          repository: "test-owner/test-repo",
          issueCreatedAt: "2024-01-03T00:00:00Z",
          productionMergedAt: null,
          cycleTimeHours: null,
          prChain: [],
        },
      ];

      const result = calculateCycleTime(cycleTimeData, "2024-01");

      expect(result.completedTaskCount).toBe(2); // 完了したIssueのみ
      expect(result.avgCycleTimeHours).toBe(66); // (48 + 84) / 2
      expect(result.medianCycleTimeHours).toBe(66); // (48 + 84) / 2
      expect(result.minCycleTimeHours).toBe(48);
      expect(result.maxCycleTimeHours).toBe(84);
      expect(result.issueDetails).toHaveLength(2);
      expect(result.issueDetails[0].prChainSummary).toBe("#10");
    });

    it("完了したIssueがない場合は空の結果を返す", () => {
      const cycleTimeData: GitHubIssueCycleTime[] = [
        {
          issueNumber: 1,
          issueTitle: "Issue 1 (未完了)",
          repository: "test-owner/test-repo",
          issueCreatedAt: "2024-01-01T00:00:00Z",
          productionMergedAt: null,
          cycleTimeHours: null,
          prChain: [],
        },
      ];

      const result = calculateCycleTime(cycleTimeData, "2024-01");

      expect(result.completedTaskCount).toBe(0);
      expect(result.avgCycleTimeHours).toBeNull();
      expect(result.issueDetails).toHaveLength(0);
    });
  });
});
