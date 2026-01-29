/**
 * metrics.ts のユニットテスト
 * DORA metrics計算のテスト
 */

import { describe, it, expect } from "bun:test";
import {
  calculateLeadTime,
  calculateLeadTimeDetailed,
  calculateDeploymentFrequency,
  calculateChangeFailureRate,
  calculateMTTR,
  calculateMetricsForRepository,
  calculateIncidentMetrics,
  calculateGitHubCycleTime,
  calculateCodingTime,
  calculateReworkRate,
  calculateReviewEfficiency,
  calculatePRSize,
  aggregateMultiRepoMetrics,
} from "../../src/utils/metrics";
import type { GitHubPullRequest, GitHubWorkflowRun, GitHubDeployment, GitHubIncident, PRReworkData, PRReviewData, PRSizeData, DevOpsMetrics } from "../../src/types";

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

    expect(calculateLeadTime(prs, [])).toBe(0);
  });

  it("デプロイメントがない場合はPRマージまでの時間を返す", () => {
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
    expect(calculateLeadTime(prs, [])).toBe(3);
  });

  it("デプロイメントがある場合はマージからデプロイまでの時間を返す", () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T12:00:00Z",
        closedAt: "2024-01-01T12:00:00Z",
        author: "user",
        repository: "owner/repo",
      },
    ];

    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "abc123",
        environment: "production",
        createdAt: "2024-01-01T13:00:00Z", // マージから1時間後
        updatedAt: "2024-01-01T13:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
    ];

    expect(calculateLeadTime(prs, deployments)).toBe(1);
  });

  it("マージ後24時間以上経過したデプロイは関連付けしない", () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T12:00:00Z", // 2時間でマージ
        closedAt: "2024-01-01T12:00:00Z",
        author: "user",
        repository: "owner/repo",
      },
    ];

    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "abc123",
        environment: "production",
        createdAt: "2024-01-03T12:00:00Z", // 48時間後
        updatedAt: "2024-01-03T12:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
    ];

    // フォールバック: PR作成からマージまでの時間 = 2時間
    expect(calculateLeadTime(prs, deployments)).toBe(2);
  });

  it("空の配列の場合は0を返す", () => {
    expect(calculateLeadTime([], [])).toBe(0);
  });

  it("デプロイメントのstatusがnullの場合はフォールバック", () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T12:00:00Z",
        closedAt: "2024-01-01T12:00:00Z",
        author: "user",
        repository: "owner/repo",
      },
    ];

    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "abc123",
        environment: "production",
        createdAt: "2024-01-01T13:00:00Z",
        updatedAt: "2024-01-01T13:05:00Z",
        status: null, // skipStatusFetch=true の場合
        repository: "owner/repo",
      },
    ];

    // status=nullのデプロイメントは無視され、フォールバック
    // PR作成→マージ = 2時間
    expect(calculateLeadTime(prs, deployments)).toBe(2);
  });
});

describe("calculateLeadTimeDetailed", () => {
  it("測定方法の内訳を返す", () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T12:00:00Z",
        closedAt: "2024-01-01T12:00:00Z",
        author: "user",
        repository: "owner/repo",
      },
      {
        id: 2,
        number: 2,
        title: "PR 2",
        state: "closed",
        createdAt: "2024-01-02T10:00:00Z",
        mergedAt: "2024-01-02T14:00:00Z", // 4時間でマージ
        closedAt: "2024-01-02T14:00:00Z",
        author: "user",
        repository: "owner/repo",
      },
    ];

    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "abc123",
        environment: "production",
        createdAt: "2024-01-01T13:00:00Z", // PR1のマージから1時間後
        updatedAt: "2024-01-01T13:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
      // PR2に対応するデプロイなし
    ];

    const result = calculateLeadTimeDetailed(prs, deployments);

    expect(result.mergeToDeployCount).toBe(1); // PR1
    expect(result.createToMergeCount).toBe(1); // PR2
    // 平均: (1 + 4) / 2 = 2.5時間
    expect(result.hours).toBe(2.5);
  });

  it("デプロイメントがない場合はすべてフォールバック", () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T12:00:00Z",
        closedAt: "2024-01-01T12:00:00Z",
        author: "user",
        repository: "owner/repo",
      },
    ];

    const result = calculateLeadTimeDetailed(prs, []);

    expect(result.mergeToDeployCount).toBe(0);
    expect(result.createToMergeCount).toBe(1);
    expect(result.hours).toBe(2);
  });
});

describe("calculateDeploymentFrequency", () => {
  it("デプロイがない場合はyearlyを返す", () => {
    const result = calculateDeploymentFrequency([], [], 30);

    expect(result.count).toBe(0);
    expect(result.frequency).toBe("yearly");
  });

  it("GitHub Deploymentsを優先して使用する", () => {
    const deployments: GitHubDeployment[] = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      sha: `sha${i}`,
      environment: "production",
      createdAt: `2024-01-${String(i + 1).padStart(2, "0")}T10:00:00Z`,
      updatedAt: `2024-01-${String(i + 1).padStart(2, "0")}T10:05:00Z`,
      status: "success" as const,
      repository: "owner/repo",
    }));

    const runs: GitHubWorkflowRun[] = []; // ワークフローがなくてもデプロイメントから計算

    const result = calculateDeploymentFrequency(deployments, runs, 30);
    expect(result.count).toBe(30);
    expect(result.frequency).toBe("daily");
  });

  it("デプロイメントがない場合はワークフローにフォールバック", () => {
    const runs: GitHubWorkflowRun[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: "Deploy to Production",
      status: "completed",
      conclusion: "success",
      createdAt: `2024-01-${String((i + 1) * 6).padStart(2, "0")}T10:00:00Z`,
      updatedAt: `2024-01-${String((i + 1) * 6).padStart(2, "0")}T10:05:00Z`,
      repository: "owner/repo",
    }));

    const result = calculateDeploymentFrequency([], runs, 30);
    expect(result.count).toBe(5);
    expect(result.frequency).toBe("weekly");
  });

  it("デプロイメントがある場合はワークフローを使用しない", () => {
    // 環境フィルタはgetDeployments()で適用済みと想定
    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
    ];

    const runs: GitHubWorkflowRun[] = [
      {
        id: 1,
        name: "Deploy",
        status: "completed",
        conclusion: "success",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        repository: "owner/repo",
      },
    ];

    // deploymentsがあればrunsは無視される
    const result = calculateDeploymentFrequency(deployments, runs, 30);
    expect(result.count).toBe(1);
  });

  it("成功したデプロイのみカウントする", () => {
    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
      {
        id: 2,
        sha: "sha2",
        environment: "production",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        status: "failure",
        repository: "owner/repo",
      },
    ];

    const result = calculateDeploymentFrequency(deployments, [], 30);
    expect(result.count).toBe(1);
  });

  it("デプロイメントのstatusがすべてnullの場合はワークフローにフォールバック", () => {
    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        status: null, // skipStatusFetch=true の場合
        repository: "owner/repo",
      },
    ];

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

    // status=nullは成功としてカウントされないので、ワークフローにフォールバック
    const result = calculateDeploymentFrequency(deployments, runs, 30);
    expect(result.count).toBe(1);
  });
});

describe("calculateChangeFailureRate", () => {
  it("デプロイがない場合は0%を返す", () => {
    const result = calculateChangeFailureRate([], []);

    expect(result.total).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.rate).toBe(0);
  });

  it("GitHub Deploymentsから失敗率を計算する", () => {
    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
      {
        id: 2,
        sha: "sha2",
        environment: "production",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        status: "failure",
        repository: "owner/repo",
      },
      {
        id: 3,
        sha: "sha3",
        environment: "production",
        createdAt: "2024-01-03T10:00:00Z",
        updatedAt: "2024-01-03T10:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
      {
        id: 4,
        sha: "sha4",
        environment: "production",
        createdAt: "2024-01-04T10:00:00Z",
        updatedAt: "2024-01-04T10:05:00Z",
        status: "error",
        repository: "owner/repo",
      },
    ];

    const result = calculateChangeFailureRate(deployments, []);
    expect(result.total).toBe(4);
    expect(result.failed).toBe(2);
    expect(result.rate).toBe(50);
  });

  it("デプロイメントがない場合はワークフローにフォールバック", () => {
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
    ];

    const result = calculateChangeFailureRate([], runs);
    expect(result.total).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.rate).toBe(50);
  });

  it("デプロイメントがある場合はワークフローを使用しない", () => {
    // 環境フィルタはgetDeployments()で適用済みと想定
    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
    ];

    const runs: GitHubWorkflowRun[] = [
      {
        id: 1,
        name: "Deploy",
        status: "completed",
        conclusion: "failure",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        repository: "owner/repo",
      },
    ];

    // deploymentsがあればrunsは無視される
    const result = calculateChangeFailureRate(deployments, runs);
    expect(result.total).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.rate).toBe(0);
  });

  it("デプロイメントのstatusがすべてnullの場合はワークフローにフォールバック", () => {
    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        status: null, // skipStatusFetch=true の場合
        repository: "owner/repo",
      },
      {
        id: 2,
        sha: "sha2",
        environment: "production",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        status: null,
        repository: "owner/repo",
      },
    ];

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
    ];

    // status=nullのデプロイメントは無視され、ワークフローにフォールバック
    const result = calculateChangeFailureRate(deployments, runs);
    expect(result.total).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.rate).toBe(50);
  });
});

describe("calculateMTTR", () => {
  it("障害がない場合はnullを返す", () => {
    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
    ];

    expect(calculateMTTR(deployments, [])).toBeNull();
  });

  it("復旧時間を正しく計算する", () => {
    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        status: "failure",
        repository: "owner/repo",
      },
      {
        id: 2,
        sha: "sha2",
        environment: "production",
        createdAt: "2024-01-01T12:00:00Z", // 2時間後に復旧
        updatedAt: "2024-01-01T12:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
    ];

    expect(calculateMTTR(deployments, [])).toBe(2);
  });

  it("複数の障害の平均復旧時間を計算する", () => {
    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        status: "failure",
        repository: "owner/repo",
      },
      {
        id: 2,
        sha: "sha2",
        environment: "production",
        createdAt: "2024-01-01T12:00:00Z", // 2時間後に復旧
        updatedAt: "2024-01-01T12:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
      {
        id: 3,
        sha: "sha3",
        environment: "production",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        status: "failure",
        repository: "owner/repo",
      },
      {
        id: 4,
        sha: "sha4",
        environment: "production",
        createdAt: "2024-01-02T14:00:00Z", // 4時間後に復旧
        updatedAt: "2024-01-02T14:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
    ];

    // 平均: (2 + 4) / 2 = 3時間
    expect(calculateMTTR(deployments, [])).toBe(3);
  });

  it("未復旧の障害はカウントしない", () => {
    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        status: "failure",
        repository: "owner/repo",
      },
      {
        id: 2,
        sha: "sha2",
        environment: "production",
        createdAt: "2024-01-01T12:00:00Z",
        updatedAt: "2024-01-01T12:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
      {
        id: 3,
        sha: "sha3",
        environment: "production",
        createdAt: "2024-01-02T10:00:00Z",
        updatedAt: "2024-01-02T10:05:00Z",
        status: "failure",
        repository: "owner/repo",
      },
      // 復旧なし
    ];

    expect(calculateMTTR(deployments, [])).toBe(2); // 最初の障害の復旧時間のみ
  });

  it("デプロイメントがない場合はワークフローにフォールバック", () => {
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
    ];

    expect(calculateMTTR([], runs)).toBe(2);
  });

  it("デプロイメントのstatusがすべてnullの場合はワークフローにフォールバック", () => {
    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T10:00:00Z",
        updatedAt: "2024-01-01T10:05:00Z",
        status: null,
        repository: "owner/repo",
      },
      {
        id: 2,
        sha: "sha2",
        environment: "production",
        createdAt: "2024-01-01T12:00:00Z",
        updatedAt: "2024-01-01T12:05:00Z",
        status: null,
        repository: "owner/repo",
      },
    ];
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
        createdAt: "2024-01-01T13:00:00Z", // 3時間後に復旧
        updatedAt: "2024-01-01T13:05:00Z",
        repository: "owner/repo",
      },
    ];

    expect(calculateMTTR(deployments, runs)).toBe(3);
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

    const metrics1 = calculateMetricsForRepository("owner/repo1", prs, runs, [], 30);
    expect(metrics1.repository).toBe("owner/repo1");
    expect(metrics1.leadTimeForChangesHours).toBe(2);
    expect(metrics1.totalDeployments).toBe(1);
    expect(metrics1.failedDeployments).toBe(0);

    const metrics2 = calculateMetricsForRepository("owner/repo2", prs, runs, [], 30);
    expect(metrics2.repository).toBe("owner/repo2");
    expect(metrics2.leadTimeForChangesHours).toBe(4);
    expect(metrics2.totalDeployments).toBe(1);
    expect(metrics2.failedDeployments).toBe(1);
  });

  it("該当リポジトリのデータがない場合も正常に動作する", () => {
    const prs: GitHubPullRequest[] = [];
    const runs: GitHubWorkflowRun[] = [];

    const metrics = calculateMetricsForRepository("owner/empty-repo", prs, runs, [], 30);
    expect(metrics.repository).toBe("owner/empty-repo");
    expect(metrics.deploymentCount).toBe(0);
    expect(metrics.leadTimeForChangesHours).toBe(0);
    expect(metrics.changeFailureRate).toBe(0);
    expect(metrics.meanTimeToRecoveryHours).toBeNull();
  });

  it("デプロイメントデータがある場合はそれを優先使用", () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: "PR",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T12:00:00Z",
        closedAt: "2024-01-01T12:00:00Z",
        author: "user",
        repository: "owner/repo",
      },
    ];

    const runs: GitHubWorkflowRun[] = [];

    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T13:00:00Z", // マージから1時間後
        updatedAt: "2024-01-01T13:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
    ];

    const metrics = calculateMetricsForRepository("owner/repo", prs, runs, deployments, 30);
    expect(metrics.leadTimeForChangesHours).toBe(1); // マージからデプロイまで1時間
    expect(metrics.deploymentCount).toBe(1);
  });

  it("leadTimeMeasurementに測定方法の内訳を含む", () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T12:00:00Z",
        closedAt: "2024-01-01T12:00:00Z",
        author: "user",
        repository: "owner/repo",
      },
      {
        id: 2,
        number: 2,
        title: "PR 2",
        state: "closed",
        createdAt: "2024-01-02T10:00:00Z",
        mergedAt: "2024-01-02T14:00:00Z",
        closedAt: "2024-01-02T14:00:00Z",
        author: "user",
        repository: "owner/repo",
      },
    ];

    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: "sha1",
        environment: "production",
        createdAt: "2024-01-01T13:00:00Z", // PR1のマージから1時間後
        updatedAt: "2024-01-01T13:05:00Z",
        status: "success",
        repository: "owner/repo",
      },
    ];

    const metrics = calculateMetricsForRepository("owner/repo", prs, [], deployments, 30);

    expect(metrics.leadTimeMeasurement).toBeDefined();
    expect(metrics.leadTimeMeasurement!.mergeToDeployCount).toBe(1);
    expect(metrics.leadTimeMeasurement!.createToMergeCount).toBe(1);
  });

  it("インシデントデータがある場合はincidentMetricsを含む", () => {
    const prs: GitHubPullRequest[] = [];
    const runs: GitHubWorkflowRun[] = [];
    const deployments: GitHubDeployment[] = [];

    const incidents: GitHubIncident[] = [
      {
        id: 1,
        number: 1,
        title: "[Incident] DB connection error",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        closedAt: "2024-01-01T12:00:00Z", // 2時間後に解決
        labels: ["incident"],
        repository: "owner/repo",
      },
    ];

    const metrics = calculateMetricsForRepository("owner/repo", prs, runs, deployments, 30, incidents);

    expect(metrics.incidentMetrics).toBeDefined();
    expect(metrics.incidentMetrics!.incidentCount).toBe(1);
    expect(metrics.incidentMetrics!.openIncidents).toBe(0);
    expect(metrics.incidentMetrics!.mttrHours).toBe(2);
  });
});

describe("calculateIncidentMetrics", () => {
  it("インシデントがない場合はnullのMTTRを返す", () => {
    const result = calculateIncidentMetrics([]);

    expect(result.incidentCount).toBe(0);
    expect(result.openIncidents).toBe(0);
    expect(result.mttrHours).toBeNull();
  });

  it("解決済みインシデントのMTTRを計算する", () => {
    const incidents: GitHubIncident[] = [
      {
        id: 1,
        number: 1,
        title: "[Incident] Server error",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        closedAt: "2024-01-01T12:00:00Z", // 2時間後
        labels: ["incident"],
        repository: "owner/repo",
      },
    ];

    const result = calculateIncidentMetrics(incidents);

    expect(result.incidentCount).toBe(1);
    expect(result.openIncidents).toBe(0);
    expect(result.mttrHours).toBe(2);
  });

  it("複数インシデントの平均MTTRを計算する", () => {
    const incidents: GitHubIncident[] = [
      {
        id: 1,
        number: 1,
        title: "[Incident] Error 1",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        closedAt: "2024-01-01T12:00:00Z", // 2時間
        labels: ["incident"],
        repository: "owner/repo",
      },
      {
        id: 2,
        number: 2,
        title: "[Incident] Error 2",
        state: "closed",
        createdAt: "2024-01-02T10:00:00Z",
        closedAt: "2024-01-02T14:00:00Z", // 4時間
        labels: ["incident"],
        repository: "owner/repo",
      },
    ];

    const result = calculateIncidentMetrics(incidents);

    expect(result.incidentCount).toBe(2);
    expect(result.mttrHours).toBe(3); // (2 + 4) / 2
  });

  it("未解決インシデントをカウントする", () => {
    const incidents: GitHubIncident[] = [
      {
        id: 1,
        number: 1,
        title: "[Incident] Resolved",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z",
        closedAt: "2024-01-01T12:00:00Z",
        labels: ["incident"],
        repository: "owner/repo",
      },
      {
        id: 2,
        number: 2,
        title: "[Incident] Still open",
        state: "open",
        createdAt: "2024-01-02T10:00:00Z",
        closedAt: null,
        labels: ["incident"],
        repository: "owner/repo",
      },
    ];

    const result = calculateIncidentMetrics(incidents);

    expect(result.incidentCount).toBe(2);
    expect(result.openIncidents).toBe(1);
    expect(result.mttrHours).toBe(2); // 解決済みのみ計算
  });

  it("すべて未解決の場合はnullのMTTRを返す", () => {
    const incidents: GitHubIncident[] = [
      {
        id: 1,
        number: 1,
        title: "[Incident] Open 1",
        state: "open",
        createdAt: "2024-01-01T10:00:00Z",
        closedAt: null,
        labels: ["incident"],
        repository: "owner/repo",
      },
      {
        id: 2,
        number: 2,
        title: "[Incident] Open 2",
        state: "open",
        createdAt: "2024-01-02T10:00:00Z",
        closedAt: null,
        labels: ["incident"],
        repository: "owner/repo",
      },
    ];

    const result = calculateIncidentMetrics(incidents);

    expect(result.incidentCount).toBe(2);
    expect(result.openIncidents).toBe(2);
    expect(result.mttrHours).toBeNull();
  });
});

// calculateCycleTime のテストは tests/unit/githubCycleTime.test.ts に移動
// calculateCodingTime のテストは tests/unit/githubCodingTime.test.ts に移動

describe("calculateReworkRate", () => {
  it("PRがない場合はnullを返す", () => {
    const result = calculateReworkRate([], "2024-01");

    expect(result.prCount).toBe(0);
    expect(result.additionalCommits.total).toBe(0);
    expect(result.additionalCommits.avgPerPr).toBeNull();
    expect(result.additionalCommits.median).toBeNull();
    expect(result.additionalCommits.max).toBeNull();
    expect(result.forcePushes.total).toBe(0);
    expect(result.forcePushes.avgPerPr).toBeNull();
    expect(result.forcePushes.prsWithForcePush).toBe(0);
    expect(result.forcePushes.forcePushRate).toBeNull();
    expect(result.prDetails).toHaveLength(0);
  });

  it("手戻り率を正しく計算する（1PR）", () => {
    const reworkData: PRReworkData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        additionalCommits: 3,
        forcePushCount: 1,
        totalCommits: 5,
      },
    ];

    const result = calculateReworkRate(reworkData, "2024-01");

    expect(result.prCount).toBe(1);
    expect(result.additionalCommits.total).toBe(3);
    expect(result.additionalCommits.avgPerPr).toBe(3);
    expect(result.additionalCommits.median).toBe(3);
    expect(result.additionalCommits.max).toBe(3);
    expect(result.forcePushes.total).toBe(1);
    expect(result.forcePushes.avgPerPr).toBe(1);
    expect(result.forcePushes.prsWithForcePush).toBe(1);
    expect(result.forcePushes.forcePushRate).toBe(100);
  });

  it("複数PRの平均・中央値を正しく計算する", () => {
    const reworkData: PRReworkData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        additionalCommits: 2,
        forcePushCount: 0,
        totalCommits: 3,
      },
      {
        prNumber: 2,
        title: "PR 2",
        repository: "owner/repo",
        createdAt: "2024-01-02T10:00:00Z",
        mergedAt: "2024-01-02T14:00:00Z",
        additionalCommits: 4,
        forcePushCount: 1,
        totalCommits: 5,
      },
      {
        prNumber: 3,
        title: "PR 3",
        repository: "owner/repo",
        createdAt: "2024-01-03T10:00:00Z",
        mergedAt: "2024-01-03T14:00:00Z",
        additionalCommits: 6,
        forcePushCount: 2,
        totalCommits: 8,
      },
    ];

    const result = calculateReworkRate(reworkData, "2024-01");

    expect(result.prCount).toBe(3);
    // 追加コミット: 2 + 4 + 6 = 12, avg = 4, median = 4
    expect(result.additionalCommits.total).toBe(12);
    expect(result.additionalCommits.avgPerPr).toBe(4);
    expect(result.additionalCommits.median).toBe(4);
    expect(result.additionalCommits.max).toBe(6);
    // Force Push: 0 + 1 + 2 = 3, avg = 1, 2/3 PRs with force push
    expect(result.forcePushes.total).toBe(3);
    expect(result.forcePushes.avgPerPr).toBe(1);
    expect(result.forcePushes.prsWithForcePush).toBe(2);
    expect(result.forcePushes.forcePushRate).toBe(66.7);
  });

  it("偶数個のPRで中央値を正しく計算する", () => {
    const reworkData: PRReworkData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        additionalCommits: 2,
        forcePushCount: 0,
        totalCommits: 3,
      },
      {
        prNumber: 2,
        title: "PR 2",
        repository: "owner/repo",
        createdAt: "2024-01-02T10:00:00Z",
        mergedAt: "2024-01-02T14:00:00Z",
        additionalCommits: 6,
        forcePushCount: 0,
        totalCommits: 7,
      },
    ];

    const result = calculateReworkRate(reworkData, "2024-01");

    // 中央値: (2 + 6) / 2 = 4
    expect(result.additionalCommits.median).toBe(4);
  });

  it("Force Pushが0のPRをカウントしない", () => {
    const reworkData: PRReworkData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        additionalCommits: 2,
        forcePushCount: 0,
        totalCommits: 3,
      },
      {
        prNumber: 2,
        title: "PR 2",
        repository: "owner/repo",
        createdAt: "2024-01-02T10:00:00Z",
        mergedAt: "2024-01-02T14:00:00Z",
        additionalCommits: 3,
        forcePushCount: 0,
        totalCommits: 4,
      },
    ];

    const result = calculateReworkRate(reworkData, "2024-01");

    expect(result.forcePushes.prsWithForcePush).toBe(0);
    expect(result.forcePushes.forcePushRate).toBe(0);
  });

  it("追加コミット0のPRを正しく処理する", () => {
    const reworkData: PRReworkData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        additionalCommits: 0,
        forcePushCount: 0,
        totalCommits: 1,
      },
    ];

    const result = calculateReworkRate(reworkData, "2024-01");

    expect(result.additionalCommits.total).toBe(0);
    expect(result.additionalCommits.avgPerPr).toBe(0);
    expect(result.additionalCommits.median).toBe(0);
    expect(result.additionalCommits.max).toBe(0);
  });

  it("期間文字列を正しく設定する", () => {
    const result = calculateReworkRate([], "2024-01-01〜2024-01-31");

    expect(result.period).toBe("2024-01-01〜2024-01-31");
  });

  it("未マージのPRを正しく処理する", () => {
    const reworkData: PRReworkData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: null, // 未マージ
        additionalCommits: 5,
        forcePushCount: 2,
        totalCommits: 8,
      },
    ];

    const result = calculateReworkRate(reworkData, "2024-01");

    expect(result.prCount).toBe(1);
    expect(result.prDetails[0].mergedAt).toBeNull();
  });

  it("PR詳細に正しい情報を含む", () => {
    const reworkData: PRReworkData[] = [
      {
        prNumber: 42,
        title: "Feature X implementation",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        additionalCommits: 3,
        forcePushCount: 1,
        totalCommits: 5,
      },
    ];

    const result = calculateReworkRate(reworkData, "2024-01");

    expect(result.prDetails[0]).toEqual({
      prNumber: 42,
      title: "Feature X implementation",
      repository: "owner/repo",
      createdAt: "2024-01-01T10:00:00Z",
      mergedAt: "2024-01-01T14:00:00Z",
      additionalCommits: 3,
      forcePushCount: 1,
      totalCommits: 5,
    });
  });
});

describe("calculateReviewEfficiency", () => {
  it("PRがない場合はnullを返す", () => {
    const result = calculateReviewEfficiency([], "2024-01");

    expect(result.prCount).toBe(0);
    expect(result.timeToFirstReview.avgHours).toBeNull();
    expect(result.timeToFirstReview.medianHours).toBeNull();
    expect(result.timeToFirstReview.minHours).toBeNull();
    expect(result.timeToFirstReview.maxHours).toBeNull();
    expect(result.reviewDuration.avgHours).toBeNull();
    expect(result.reviewDuration.minHours).toBeNull();
    expect(result.timeToMerge.avgHours).toBeNull();
    expect(result.timeToMerge.minHours).toBeNull();
    expect(result.totalTime.avgHours).toBeNull();
    expect(result.totalTime.minHours).toBeNull();
    expect(result.prDetails).toHaveLength(0);
  });

  it("レビュー効率を正しく計算する（1PR）", () => {
    const reviewData: PRReviewData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        readyForReviewAt: "2024-01-01T10:00:00Z",
        firstReviewAt: "2024-01-01T12:00:00Z",     // 2時間後
        approvedAt: "2024-01-01T14:00:00Z",        // さらに2時間後
        mergedAt: "2024-01-01T15:00:00Z",          // さらに1時間後
        timeToFirstReviewHours: 2,
        reviewDurationHours: 2,
        timeToMergeHours: 1,
        totalTimeHours: 5,
      },
    ];

    const result = calculateReviewEfficiency(reviewData, "2024-01");

    expect(result.prCount).toBe(1);
    expect(result.timeToFirstReview.avgHours).toBe(2);
    expect(result.timeToFirstReview.medianHours).toBe(2);
    expect(result.timeToFirstReview.minHours).toBe(2);
    expect(result.timeToFirstReview.maxHours).toBe(2);
    expect(result.reviewDuration.avgHours).toBe(2);
    expect(result.reviewDuration.medianHours).toBe(2);
    expect(result.reviewDuration.minHours).toBe(2);
    expect(result.reviewDuration.maxHours).toBe(2);
    expect(result.timeToMerge.avgHours).toBe(1);
    expect(result.timeToMerge.minHours).toBe(1);
    expect(result.timeToMerge.maxHours).toBe(1);
    expect(result.totalTime.avgHours).toBe(5);
    expect(result.totalTime.minHours).toBe(5);
    expect(result.totalTime.maxHours).toBe(5);
  });

  it("複数PRの平均・中央値を正しく計算する", () => {
    const reviewData: PRReviewData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        readyForReviewAt: "2024-01-01T10:00:00Z",
        firstReviewAt: "2024-01-01T12:00:00Z",
        approvedAt: "2024-01-01T14:00:00Z",
        mergedAt: "2024-01-01T15:00:00Z",
        timeToFirstReviewHours: 2,
        reviewDurationHours: 2,
        timeToMergeHours: 1,
        totalTimeHours: 5,
      },
      {
        prNumber: 2,
        title: "PR 2",
        repository: "owner/repo",
        createdAt: "2024-01-02T10:00:00Z",
        readyForReviewAt: "2024-01-02T10:00:00Z",
        firstReviewAt: "2024-01-02T14:00:00Z",
        approvedAt: "2024-01-02T18:00:00Z",
        mergedAt: "2024-01-02T20:00:00Z",
        timeToFirstReviewHours: 4,
        reviewDurationHours: 4,
        timeToMergeHours: 2,
        totalTimeHours: 10,
      },
      {
        prNumber: 3,
        title: "PR 3",
        repository: "owner/repo",
        createdAt: "2024-01-03T10:00:00Z",
        readyForReviewAt: "2024-01-03T10:00:00Z",
        firstReviewAt: "2024-01-03T16:00:00Z",
        approvedAt: "2024-01-03T22:00:00Z",
        mergedAt: "2024-01-04T01:00:00Z",
        timeToFirstReviewHours: 6,
        reviewDurationHours: 6,
        timeToMergeHours: 3,
        totalTimeHours: 15,
      },
    ];

    const result = calculateReviewEfficiency(reviewData, "2024-01");

    expect(result.prCount).toBe(3);
    // 平均: (2 + 4 + 6) / 3 = 4
    expect(result.timeToFirstReview.avgHours).toBe(4);
    // 中央値: 4
    expect(result.timeToFirstReview.medianHours).toBe(4);
    expect(result.timeToFirstReview.minHours).toBe(2);
    expect(result.timeToFirstReview.maxHours).toBe(6);
    // reviewDuration
    expect(result.reviewDuration.avgHours).toBe(4);
    expect(result.reviewDuration.medianHours).toBe(4);
    expect(result.reviewDuration.minHours).toBe(2);
    expect(result.reviewDuration.maxHours).toBe(6);
    // timeToMerge: (1 + 2 + 3) / 3 = 2
    expect(result.timeToMerge.avgHours).toBe(2);
    expect(result.timeToMerge.minHours).toBe(1);
    expect(result.timeToMerge.maxHours).toBe(3);
    // totalTime: (5 + 10 + 15) / 3 = 10
    expect(result.totalTime.avgHours).toBe(10);
    expect(result.totalTime.minHours).toBe(5);
    expect(result.totalTime.maxHours).toBe(15);
  });

  it("偶数個のPRで中央値を正しく計算する", () => {
    const reviewData: PRReviewData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        readyForReviewAt: "2024-01-01T10:00:00Z",
        firstReviewAt: "2024-01-01T12:00:00Z",
        approvedAt: "2024-01-01T14:00:00Z",
        mergedAt: "2024-01-01T15:00:00Z",
        timeToFirstReviewHours: 2,
        reviewDurationHours: 2,
        timeToMergeHours: 1,
        totalTimeHours: 5,
      },
      {
        prNumber: 2,
        title: "PR 2",
        repository: "owner/repo",
        createdAt: "2024-01-02T10:00:00Z",
        readyForReviewAt: "2024-01-02T10:00:00Z",
        firstReviewAt: "2024-01-02T16:00:00Z",
        approvedAt: "2024-01-02T22:00:00Z",
        mergedAt: "2024-01-03T01:00:00Z",
        timeToFirstReviewHours: 6,
        reviewDurationHours: 6,
        timeToMergeHours: 3,
        totalTimeHours: 15,
      },
    ];

    const result = calculateReviewEfficiency(reviewData, "2024-01");

    // 中央値: (2 + 6) / 2 = 4
    expect(result.timeToFirstReview.medianHours).toBe(4);
    expect(result.timeToFirstReview.minHours).toBe(2);
    expect(result.timeToFirstReview.maxHours).toBe(6);
    expect(result.reviewDuration.medianHours).toBe(4);
    expect(result.reviewDuration.minHours).toBe(2);
    expect(result.reviewDuration.maxHours).toBe(6);
    // timeToMerge中央値: (1 + 3) / 2 = 2
    expect(result.timeToMerge.medianHours).toBe(2);
    expect(result.timeToMerge.minHours).toBe(1);
    expect(result.timeToMerge.maxHours).toBe(3);
  });

  it("最初のレビューがないPRを正しく処理する", () => {
    const reviewData: PRReviewData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        readyForReviewAt: "2024-01-01T10:00:00Z",
        firstReviewAt: null,  // レビューなし
        approvedAt: null,
        mergedAt: "2024-01-01T12:00:00Z",
        timeToFirstReviewHours: null,
        reviewDurationHours: null,
        timeToMergeHours: null,
        totalTimeHours: 2,
      },
    ];

    const result = calculateReviewEfficiency(reviewData, "2024-01");

    expect(result.prCount).toBe(1);
    expect(result.timeToFirstReview.avgHours).toBeNull();
    expect(result.timeToFirstReview.minHours).toBeNull();
    expect(result.timeToFirstReview.maxHours).toBeNull();
    expect(result.reviewDuration.avgHours).toBeNull();
    expect(result.reviewDuration.minHours).toBeNull();
    expect(result.timeToMerge.avgHours).toBeNull();
    expect(result.timeToMerge.minHours).toBeNull();
    expect(result.totalTime.avgHours).toBe(2);
    expect(result.totalTime.minHours).toBe(2);
    expect(result.totalTime.maxHours).toBe(2);
  });

  it("承認なしでマージされたPRを正しく処理する", () => {
    const reviewData: PRReviewData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        readyForReviewAt: "2024-01-01T10:00:00Z",
        firstReviewAt: "2024-01-01T12:00:00Z",
        approvedAt: null,  // 承認なし（CHANGES_REQUESTEDのままマージなど）
        mergedAt: "2024-01-01T14:00:00Z",
        timeToFirstReviewHours: 2,
        reviewDurationHours: null,
        timeToMergeHours: null,
        totalTimeHours: 4,
      },
    ];

    const result = calculateReviewEfficiency(reviewData, "2024-01");

    expect(result.prCount).toBe(1);
    expect(result.timeToFirstReview.avgHours).toBe(2);
    expect(result.timeToFirstReview.minHours).toBe(2);
    expect(result.timeToFirstReview.maxHours).toBe(2);
    expect(result.reviewDuration.avgHours).toBeNull();
    expect(result.reviewDuration.minHours).toBeNull();
    expect(result.reviewDuration.maxHours).toBeNull();
    expect(result.timeToMerge.avgHours).toBeNull();
    expect(result.timeToMerge.minHours).toBeNull();
    expect(result.timeToMerge.maxHours).toBeNull();
    expect(result.totalTime.avgHours).toBe(4);
    expect(result.totalTime.minHours).toBe(4);
    expect(result.totalTime.maxHours).toBe(4);
  });

  it("期間文字列を正しく設定する", () => {
    const result = calculateReviewEfficiency([], "2024-01-01〜2024-01-31");

    expect(result.period).toBe("2024-01-01〜2024-01-31");
  });

  it("PR詳細に正しい情報を含む", () => {
    const reviewData: PRReviewData[] = [
      {
        prNumber: 42,
        title: "Feature X implementation",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        readyForReviewAt: "2024-01-01T11:00:00Z",
        firstReviewAt: "2024-01-01T13:00:00Z",
        approvedAt: "2024-01-01T15:00:00Z",
        mergedAt: "2024-01-01T16:00:00Z",
        timeToFirstReviewHours: 2,
        reviewDurationHours: 2,
        timeToMergeHours: 1,
        totalTimeHours: 5,
      },
    ];

    const result = calculateReviewEfficiency(reviewData, "2024-01");

    expect(result.prDetails[0]).toEqual({
      prNumber: 42,
      title: "Feature X implementation",
      repository: "owner/repo",
      createdAt: "2024-01-01T10:00:00Z",
      readyForReviewAt: "2024-01-01T11:00:00Z",
      firstReviewAt: "2024-01-01T13:00:00Z",
      approvedAt: "2024-01-01T15:00:00Z",
      mergedAt: "2024-01-01T16:00:00Z",
      timeToFirstReviewHours: 2,
      reviewDurationHours: 2,
      timeToMergeHours: 1,
      totalTimeHours: 5,
    });
  });

  it("一部のPRにのみ値がある場合、その値のみで統計を計算する", () => {
    const reviewData: PRReviewData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        readyForReviewAt: "2024-01-01T10:00:00Z",
        firstReviewAt: "2024-01-01T12:00:00Z",
        approvedAt: "2024-01-01T14:00:00Z",
        mergedAt: "2024-01-01T15:00:00Z",
        timeToFirstReviewHours: 2,
        reviewDurationHours: 2,
        timeToMergeHours: 1,
        totalTimeHours: 5,
      },
      {
        prNumber: 2,
        title: "PR 2",
        repository: "owner/repo",
        createdAt: "2024-01-02T10:00:00Z",
        readyForReviewAt: "2024-01-02T10:00:00Z",
        firstReviewAt: null,
        approvedAt: null,
        mergedAt: "2024-01-02T12:00:00Z",
        timeToFirstReviewHours: null,
        reviewDurationHours: null,
        timeToMergeHours: null,
        totalTimeHours: 2,
      },
    ];

    const result = calculateReviewEfficiency(reviewData, "2024-01");

    expect(result.prCount).toBe(2);
    // timeToFirstReviewは1つのPRのみ有効
    expect(result.timeToFirstReview.avgHours).toBe(2);
    expect(result.reviewDuration.avgHours).toBe(2);
    expect(result.timeToMerge.avgHours).toBe(1);
    // totalTimeは両方有効: (5 + 2) / 2 = 3.5
    expect(result.totalTime.avgHours).toBe(3.5);
  });
});

describe("calculatePRSize", () => {
  it("PRがない場合はnullを返す", () => {
    const result = calculatePRSize([], "2024-01");

    expect(result.prCount).toBe(0);
    expect(result.linesOfCode.total).toBe(0);
    expect(result.linesOfCode.avg).toBeNull();
    expect(result.linesOfCode.median).toBeNull();
    expect(result.linesOfCode.min).toBeNull();
    expect(result.linesOfCode.max).toBeNull();
    expect(result.filesChanged.total).toBe(0);
    expect(result.filesChanged.avg).toBeNull();
    expect(result.filesChanged.median).toBeNull();
    expect(result.filesChanged.min).toBeNull();
    expect(result.filesChanged.max).toBeNull();
    expect(result.prDetails).toHaveLength(0);
  });

  it("PRサイズを正しく計算する（1PR）", () => {
    const sizeData: PRSizeData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        additions: 100,
        deletions: 50,
        linesOfCode: 150,
        filesChanged: 5,
      },
    ];

    const result = calculatePRSize(sizeData, "2024-01");

    expect(result.prCount).toBe(1);
    expect(result.linesOfCode.total).toBe(150);
    expect(result.linesOfCode.avg).toBe(150);
    expect(result.linesOfCode.median).toBe(150);
    expect(result.linesOfCode.min).toBe(150);
    expect(result.linesOfCode.max).toBe(150);
    expect(result.filesChanged.total).toBe(5);
    expect(result.filesChanged.avg).toBe(5);
    expect(result.filesChanged.median).toBe(5);
    expect(result.filesChanged.min).toBe(5);
    expect(result.filesChanged.max).toBe(5);
    expect(result.prDetails).toHaveLength(1);
  });

  it("複数PRの平均・中央値を正しく計算する", () => {
    const sizeData: PRSizeData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        additions: 50,
        deletions: 50,
        linesOfCode: 100,
        filesChanged: 2,
      },
      {
        prNumber: 2,
        title: "PR 2",
        repository: "owner/repo",
        createdAt: "2024-01-02T10:00:00Z",
        mergedAt: "2024-01-02T14:00:00Z",
        additions: 150,
        deletions: 50,
        linesOfCode: 200,
        filesChanged: 4,
      },
      {
        prNumber: 3,
        title: "PR 3",
        repository: "owner/repo",
        createdAt: "2024-01-03T10:00:00Z",
        mergedAt: "2024-01-03T14:00:00Z",
        additions: 200,
        deletions: 100,
        linesOfCode: 300,
        filesChanged: 6,
      },
    ];

    const result = calculatePRSize(sizeData, "2024-01");

    expect(result.prCount).toBe(3);
    // linesOfCode: 100 + 200 + 300 = 600, avg = 200, median = 200
    expect(result.linesOfCode.total).toBe(600);
    expect(result.linesOfCode.avg).toBe(200);
    expect(result.linesOfCode.median).toBe(200);
    expect(result.linesOfCode.min).toBe(100);
    expect(result.linesOfCode.max).toBe(300);
    // filesChanged: 2 + 4 + 6 = 12, avg = 4, median = 4
    expect(result.filesChanged.total).toBe(12);
    expect(result.filesChanged.avg).toBe(4);
    expect(result.filesChanged.median).toBe(4);
    expect(result.filesChanged.min).toBe(2);
    expect(result.filesChanged.max).toBe(6);
  });

  it("偶数個のPRで中央値を正しく計算する", () => {
    const sizeData: PRSizeData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        additions: 50,
        deletions: 50,
        linesOfCode: 100,
        filesChanged: 2,
      },
      {
        prNumber: 2,
        title: "PR 2",
        repository: "owner/repo",
        createdAt: "2024-01-02T10:00:00Z",
        mergedAt: "2024-01-02T14:00:00Z",
        additions: 200,
        deletions: 100,
        linesOfCode: 300,
        filesChanged: 6,
      },
    ];

    const result = calculatePRSize(sizeData, "2024-01");

    // 中央値: (100 + 300) / 2 = 200
    expect(result.linesOfCode.median).toBe(200);
    expect(result.linesOfCode.min).toBe(100);
    expect(result.linesOfCode.max).toBe(300);
    // filesChanged中央値: (2 + 6) / 2 = 4
    expect(result.filesChanged.median).toBe(4);
    expect(result.filesChanged.min).toBe(2);
    expect(result.filesChanged.max).toBe(6);
  });

  it("未マージのPRを正しく処理する", () => {
    const sizeData: PRSizeData[] = [
      {
        prNumber: 1,
        title: "PR 1",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: null, // 未マージ
        additions: 100,
        deletions: 50,
        linesOfCode: 150,
        filesChanged: 5,
      },
    ];

    const result = calculatePRSize(sizeData, "2024-01");

    expect(result.prCount).toBe(1);
    expect(result.prDetails[0].mergedAt).toBeNull();
  });

  it("0行の変更を正しく処理する", () => {
    const sizeData: PRSizeData[] = [
      {
        prNumber: 1,
        title: "PR 1 (empty)",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        additions: 0,
        deletions: 0,
        linesOfCode: 0,
        filesChanged: 0,
      },
    ];

    const result = calculatePRSize(sizeData, "2024-01");

    expect(result.prCount).toBe(1);
    expect(result.linesOfCode.total).toBe(0);
    expect(result.linesOfCode.avg).toBe(0);
    expect(result.linesOfCode.median).toBe(0);
    expect(result.linesOfCode.min).toBe(0);
    expect(result.linesOfCode.max).toBe(0);
    expect(result.filesChanged.total).toBe(0);
    expect(result.filesChanged.avg).toBe(0);
    expect(result.filesChanged.median).toBe(0);
    expect(result.filesChanged.min).toBe(0);
    expect(result.filesChanged.max).toBe(0);
  });

  it("期間文字列を正しく設定する", () => {
    const result = calculatePRSize([], "2024-01-01〜2024-01-31");

    expect(result.period).toBe("2024-01-01〜2024-01-31");
  });

  it("PR詳細に正しい情報を含む", () => {
    const sizeData: PRSizeData[] = [
      {
        prNumber: 42,
        title: "Feature X implementation",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        additions: 200,
        deletions: 50,
        linesOfCode: 250,
        filesChanged: 8,
      },
    ];

    const result = calculatePRSize(sizeData, "2024-01");

    expect(result.prDetails[0]).toEqual({
      prNumber: 42,
      title: "Feature X implementation",
      repository: "owner/repo",
      createdAt: "2024-01-01T10:00:00Z",
      mergedAt: "2024-01-01T14:00:00Z",
      additions: 200,
      deletions: 50,
      linesOfCode: 250,
      filesChanged: 8,
    });
  });

  it("大きなPRと小さなPRが混在する場合の統計を正しく計算する", () => {
    const sizeData: PRSizeData[] = [
      {
        prNumber: 1,
        title: "Small PR",
        repository: "owner/repo",
        createdAt: "2024-01-01T10:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        additions: 5,
        deletions: 2,
        linesOfCode: 7,
        filesChanged: 1,
      },
      {
        prNumber: 2,
        title: "Large PR",
        repository: "owner/repo",
        createdAt: "2024-01-02T10:00:00Z",
        mergedAt: "2024-01-02T14:00:00Z",
        additions: 500,
        deletions: 200,
        linesOfCode: 700,
        filesChanged: 25,
      },
    ];

    const result = calculatePRSize(sizeData, "2024-01");

    expect(result.prCount).toBe(2);
    // linesOfCode: total = 707, avg = 353.5
    expect(result.linesOfCode.total).toBe(707);
    expect(result.linesOfCode.avg).toBe(353.5);
    expect(result.linesOfCode.min).toBe(7);
    expect(result.linesOfCode.max).toBe(700);
    // filesChanged: total = 26, avg = 13
    expect(result.filesChanged.total).toBe(26);
    expect(result.filesChanged.avg).toBe(13);
    expect(result.filesChanged.min).toBe(1);
    expect(result.filesChanged.max).toBe(25);
  });
});

describe("aggregateMultiRepoMetrics", () => {
  it("空の配列の場合は空のサマリーを返す", () => {
    const result = aggregateMultiRepoMetrics([]);

    expect(result.repositorySummaries).toEqual([]);
    expect(result.overallSummary.totalRepositories).toBe(0);
    expect(result.overallSummary.avgDeploymentCount).toBe(0);
    expect(result.overallSummary.avgLeadTimeHours).toBe(0);
    expect(result.overallSummary.avgChangeFailureRate).toBe(0);
    expect(result.overallSummary.avgMttrHours).toBeNull();
  });

  it("単一リポジトリの場合は正しく集計する", () => {
    const metrics: DevOpsMetrics[] = [
      {
        date: "2024-01-01",
        repository: "owner/repo1",
        deploymentCount: 5,
        deploymentFrequency: "daily",
        leadTimeForChangesHours: 10,
        totalDeployments: 5,
        failedDeployments: 1,
        changeFailureRate: 20,
        meanTimeToRecoveryHours: 2,
      },
      {
        date: "2024-01-02",
        repository: "owner/repo1",
        deploymentCount: 3,
        deploymentFrequency: "daily",
        leadTimeForChangesHours: 14,
        totalDeployments: 3,
        failedDeployments: 0,
        changeFailureRate: 0,
        meanTimeToRecoveryHours: null,
      },
    ];

    const result = aggregateMultiRepoMetrics(metrics);

    expect(result.repositorySummaries.length).toBe(1);
    expect(result.repositorySummaries[0].repository).toBe("owner/repo1");
    expect(result.repositorySummaries[0].dataPointCount).toBe(2);
    expect(result.repositorySummaries[0].avgDeploymentCount).toBe(4); // (5+3)/2
    expect(result.repositorySummaries[0].avgLeadTimeHours).toBe(12); // (10+14)/2
    expect(result.repositorySummaries[0].avgChangeFailureRate).toBe(10); // (20+0)/2
    expect(result.repositorySummaries[0].avgMttrHours).toBe(2); // MTTRがあるのは1件のみ
    expect(result.repositorySummaries[0].lastUpdated).toBe("2024-01-02");

    // 単一リポジトリなので全体平均も同じ
    expect(result.overallSummary.totalRepositories).toBe(1);
    expect(result.overallSummary.avgDeploymentCount).toBe(4);
    expect(result.overallSummary.avgLeadTimeHours).toBe(12);
  });

  it("複数リポジトリの場合はリポジトリごとと全体を集計する", () => {
    const metrics: DevOpsMetrics[] = [
      {
        date: "2024-01-01",
        repository: "owner/repo1",
        deploymentCount: 10,
        deploymentFrequency: "daily",
        leadTimeForChangesHours: 8,
        totalDeployments: 10,
        failedDeployments: 2,
        changeFailureRate: 20,
        meanTimeToRecoveryHours: 4,
      },
      {
        date: "2024-01-01",
        repository: "owner/repo2",
        deploymentCount: 6,
        deploymentFrequency: "daily",
        leadTimeForChangesHours: 16,
        totalDeployments: 6,
        failedDeployments: 0,
        changeFailureRate: 0,
        meanTimeToRecoveryHours: null,
      },
      {
        date: "2024-01-02",
        repository: "owner/repo1",
        deploymentCount: 8,
        deploymentFrequency: "daily",
        leadTimeForChangesHours: 12,
        totalDeployments: 8,
        failedDeployments: 1,
        changeFailureRate: 12.5,
        meanTimeToRecoveryHours: 2,
      },
    ];

    const result = aggregateMultiRepoMetrics(metrics);

    expect(result.repositorySummaries.length).toBe(2);

    // repo1: deploymentCount=(10+8)/2=9, leadTime=(8+12)/2=10, cfr=(20+12.5)/2=16.25, mttr=(4+2)/2=3
    const repo1 = result.repositorySummaries.find(s => s.repository === "owner/repo1")!;
    expect(repo1.dataPointCount).toBe(2);
    expect(repo1.avgDeploymentCount).toBe(9);
    expect(repo1.avgLeadTimeHours).toBe(10);
    expect(repo1.avgChangeFailureRate).toBe(16.3); // 四捨五入
    expect(repo1.avgMttrHours).toBe(3);

    // repo2: 1件のみなのでそのまま
    const repo2 = result.repositorySummaries.find(s => s.repository === "owner/repo2")!;
    expect(repo2.dataPointCount).toBe(1);
    expect(repo2.avgDeploymentCount).toBe(6);
    expect(repo2.avgLeadTimeHours).toBe(16);
    expect(repo2.avgChangeFailureRate).toBe(0);
    expect(repo2.avgMttrHours).toBeNull();

    // 全体平均: リポジトリ平均の平均
    // deploymentCount=(9+6)/2=7.5, leadTime=(10+16)/2=13, cfr=(16.3+0)/2=8.15
    expect(result.overallSummary.totalRepositories).toBe(2);
    expect(result.overallSummary.avgDeploymentCount).toBe(7.5);
    expect(result.overallSummary.avgLeadTimeHours).toBe(13);
    expect(result.overallSummary.avgChangeFailureRate).toBe(8.2); // 四捨五入
    // MTTRはrepo1のみ有効なので3
    expect(result.overallSummary.avgMttrHours).toBe(3);
  });

  it("全てのMTTRがnullの場合は全体平均もnull", () => {
    const metrics: DevOpsMetrics[] = [
      {
        date: "2024-01-01",
        repository: "owner/repo1",
        deploymentCount: 5,
        deploymentFrequency: "daily",
        leadTimeForChangesHours: 10,
        totalDeployments: 5,
        failedDeployments: 0,
        changeFailureRate: 0,
        meanTimeToRecoveryHours: null,
      },
    ];

    const result = aggregateMultiRepoMetrics(metrics);

    expect(result.repositorySummaries[0].avgMttrHours).toBeNull();
    expect(result.overallSummary.avgMttrHours).toBeNull();
  });
});
