/**
 * metrics.ts のユニットテスト
 * 純粋関数なので外部依存なしでテスト可能
 */

import { describe, it, expect } from "bun:test";
import {
  calculateLeadTime,
  calculateDeploymentFrequency,
  calculateChangeFailureRate,
  calculateMTTR,
  calculateMetricsForRepository,
} from "../../src/utils/metrics";
import type { GitHubPullRequest, GitHubWorkflowRun } from "../../src/types";

describe("calculateLeadTime", () => {
  it("マージされたPRがない場合は0を返す", () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: "Test PR",
        state: "open",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: null,
        closedAt: null,
        author: "user",
        repository: "owner/repo",
      },
    ];

    expect(calculateLeadTime(prs)).toBe(0);
  });

  it("マージされたPRのリードタイムを正しく計算する", () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T12:00:00Z", // 2時間後
        closedAt: "2024-01-01T12:00:00Z",
        author: "user",
        repository: "owner/repo",
      },
      {
        id: 2,
        number: 2,
        title: "PR 2",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z", // 4時間後
        closedAt: "2024-01-01T14:00:00Z",
        author: "user",
        repository: "owner/repo",
      },
    ];

    // 平均: (2 + 4) / 2 = 3時間
    expect(calculateLeadTime(prs)).toBe(3);
  });

  it("空の配列の場合は0を返す", () => {
    expect(calculateLeadTime([])).toBe(0);
  });
});

describe("calculateDeploymentFrequency", () => {
  it("デプロイがない場合はyearlyを返す", () => {
    const runs: GitHubWorkflowRun[] = [];
    const result = calculateDeploymentFrequency(runs, 30);

    expect(result.count).toBe(0);
    expect(result.frequency).toBe("yearly");
  });

  it("毎日デプロイがある場合はdailyを返す", () => {
    const runs: GitHubWorkflowRun[] = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      name: "Deploy to Production",
      status: "completed",
      conclusion: "success",
      createdAt: `2024-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      updatedAt: `2024-01-${String(i + 1).padStart(2, "0")}T10:05:00Z`,
      repository: "owner/repo",
    }));

    const result = calculateDeploymentFrequency(runs, 30);
    expect(result.count).toBe(30);
    expect(result.frequency).toBe("daily");
  });

  it("週1回程度のデプロイはweeklyを返す", () => {
    // 5 deployments in 30 days = 5/30 ≈ 0.167/day ≈ 1.17/week >= 1/7
    const runs: GitHubWorkflowRun[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: "Deploy",
      status: "completed",
      conclusion: "success",
      createdAt: `2024-01-${String((i + 1) * 6).padStart(2, "0")}T10:00:00Z`,
      updatedAt: `2024-01-${String((i + 1) * 6).padStart(2, "0")}T10:05:00Z`,
      repository: "owner/repo",
    }));

    const result = calculateDeploymentFrequency(runs, 30);
    expect(result.count).toBe(5);
    expect(result.frequency).toBe("weekly");
  });

  it("デプロイ以外のワークフローはカウントしない", () => {
    const runs: GitHubWorkflowRun[] = [
      {
        id: 1,
        name: "CI Test",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        repository: "owner/repo",
      },
      {
        id: 2,
        name: "Deploy to Staging",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        repository: "owner/repo",
      },
    ];

    const result = calculateDeploymentFrequency(runs, 30);
    expect(result.count).toBe(1); // Deployのみカウント
  });

  it("失敗したデプロイはカウントしない", () => {
    const runs: GitHubWorkflowRun[] = [
      {
        id: 1,
        name: "Deploy",
        status: "completed",
        conclusion: "failure",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        repository: "owner/repo",
      },
      {
        id: 2,
        name: "Deploy",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        repository: "owner/repo",
      },
    ];

    const result = calculateDeploymentFrequency(runs, 30);
    expect(result.count).toBe(1);
  });
});

describe("calculateChangeFailureRate", () => {
  it("デプロイがない場合は0%を返す", () => {
    const runs: GitHubWorkflowRun[] = [];
    const result = calculateChangeFailureRate(runs);

    expect(result.total).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.rate).toBe(0);
  });

  it("失敗率を正しく計算する", () => {
    const runs: GitHubWorkflowRun[] = [
      {
        id: 1,
        name: "Deploy",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        repository: "owner/repo",
      },
      {
        id: 2,
        name: "Deploy",
        status: "completed",
        conclusion: "failure",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        repository: "owner/repo",
      },
      {
        id: 3,
        name: "Deploy",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-03T10:00:00Z",
        updatedAt: "2024-01-03T10:05:00Z",
        repository: "owner/repo",
      },
      {
        id: 4,
        name: "Deploy",
        status: "completed",
        conclusion: "failure",
        createdAt: "2024-01-04T10:00:00Z",
        updatedAt: "2024-01-04T10:05:00Z",
        repository: "owner/repo",
      },
    ];

    const result = calculateChangeFailureRate(runs);
    expect(result.total).toBe(4);
    expect(result.failed).toBe(2);
    expect(result.rate).toBe(50);
  });

  it("デプロイ以外のワークフローは対象外", () => {
    const runs: GitHubWorkflowRun[] = [
      {
        id: 1,
        name: "CI Test",
        status: "completed",
        conclusion: "failure",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        repository: "owner/repo",
      },
      {
        id: 2,
        name: "Deploy",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        repository: "owner/repo",
      },
    ];

    const result = calculateChangeFailureRate(runs);
    expect(result.total).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.rate).toBe(0);
  });
});

describe("calculateMTTR", () => {
  it("障害がない場合はnullを返す", () => {
    const runs: GitHubWorkflowRun[] = [
      {
        id: 1,
        name: "Deploy",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        repository: "owner/repo",
      },
    ];

    expect(calculateMTTR(runs)).toBeNull();
  });

  it("復旧時間を正しく計算する", () => {
    const runs: GitHubWorkflowRun[] = [
      {
        id: 1,
        name: "Deploy",
        status: "completed",
        conclusion: "failure",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        repository: "owner/repo",
      },
      {
        id: 2,
        name: "Deploy",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-01T12:00:00Z", // 2時間後に復旧
        updatedAt: "2024-01-01T12:05:00Z",
        repository: "owner/repo",
      },
    ];

    expect(calculateMTTR(runs)).toBe(2);
  });

  it("複数の障害の平均復旧時間を計算する", () => {
    const runs: GitHubWorkflowRun[] = [
      {
        id: 1,
        name: "Deploy",
        status: "completed",
        conclusion: "failure",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        repository: "owner/repo",
      },
      {
        id: 2,
        name: "Deploy",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-01T12:00:00Z", // 2時間後に復旧
        updatedAt: "2024-01-01T12:05:00Z",
        repository: "owner/repo",
      },
      {
        id: 3,
        name: "Deploy",
        status: "completed",
        conclusion: "failure",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        repository: "owner/repo",
      },
      {
        id: 4,
        name: "Deploy",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-02T14:00:00Z", // 4時間後に復旧
        updatedAt: "2024-01-02T14:05:00Z",
        repository: "owner/repo",
      },
    ];

    // 平均: (2 + 4) / 2 = 3時間
    expect(calculateMTTR(runs)).toBe(3);
  });

  it("未復旧の障害はカウントしない", () => {
    const runs: GitHubWorkflowRun[] = [
      {
        id: 1,
        name: "Deploy",
        status: "completed",
        conclusion: "failure",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        repository: "owner/repo",
      },
      {
        id: 2,
        name: "Deploy",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-01T12:00:00Z",
        updatedAt: "2024-01-01T12:05:00Z",
        repository: "owner/repo",
      },
      {
        id: 3,
        name: "Deploy",
        status: "completed",
        conclusion: "failure",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        repository: "owner/repo",
      },
      // 復旧なし
    ];

    expect(calculateMTTR(runs)).toBe(2); // 最初の障害の復旧時間のみ
  });
});

describe("calculateMetricsForRepository", () => {
  it("リポジトリ別にメトリクスを計算する", () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: "PR for repo1",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T12:00:00Z",
        closedAt: "2024-01-01T12:00:00Z",
        author: "user",
        repository: "owner/repo1",
      },
      {
        id: 2,
        number: 2,
        title: "PR for repo2",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        closedAt: "2024-01-01T14:00:00Z",
        author: "user",
        repository: "owner/repo2",
      },
    ];

    const runs: GitHubWorkflowRun[] = [
      {
        id: 1,
        name: "Deploy",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-01T12:00:00Z",
        updatedAt: "2024-01-01T12:05:00Z",
        repository: "owner/repo1",
      },
      {
        id: 2,
        name: "Deploy",
        status: "completed",
        conclusion: "failure",
        createdAt: "2024-01-01T13:00:00Z",
        updatedAt: "2024-01-01T13:05:00Z",
        repository: "owner/repo2",
      },
    ];

    const metrics1 = calculateMetricsForRepository("owner/repo1", prs, runs, 30);
    expect(metrics1.repository).toBe("owner/repo1");
    expect(metrics1.leadTimeForChangesHours).toBe(2);
    expect(metrics1.totalDeployments).toBe(1);
    expect(metrics1.failedDeployments).toBe(0);

    const metrics2 = calculateMetricsForRepository("owner/repo2", prs, runs, 30);
    expect(metrics2.repository).toBe("owner/repo2");
    expect(metrics2.leadTimeForChangesHours).toBe(4);
    expect(metrics2.totalDeployments).toBe(1);
    expect(metrics2.failedDeployments).toBe(1);
  });

  it("該当リポジトリのデータがない場合も正常に動作する", () => {
    const prs: GitHubPullRequest[] = [];
    const runs: GitHubWorkflowRun[] = [];

    const metrics = calculateMetricsForRepository("owner/empty-repo", prs, runs, 30);
    expect(metrics.repository).toBe("owner/empty-repo");
    expect(metrics.deploymentCount).toBe(0);
    expect(metrics.leadTimeForChangesHours).toBe(0);
    expect(metrics.changeFailureRate).toBe(0);
    expect(metrics.meanTimeToRecoveryHours).toBeNull();
  });
});
