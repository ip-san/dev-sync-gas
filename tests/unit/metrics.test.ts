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
  calculateCycleTime,
  calculateCodingTime,
  calculateReworkRate,
} from "../../src/utils/metrics";
import type { GitHubPullRequest, GitHubWorkflowRun, GitHubDeployment, GitHubIncident, NotionTask, PRReworkData } from "../../src/types";

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

describe("calculateCycleTime", () => {
  it("タスクがない場合はnullを返す", () => {
    const result = calculateCycleTime([], "2024-01");

    expect(result.completedTaskCount).toBe(0);
    expect(result.avgCycleTimeHours).toBeNull();
    expect(result.medianCycleTimeHours).toBeNull();
    expect(result.minCycleTimeHours).toBeNull();
    expect(result.maxCycleTimeHours).toBeNull();
    expect(result.taskDetails).toHaveLength(0);
  });

  it("着手日がnullのタスクは除外する", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-1",
        title: "Task 1",
        status: "Done",
        createdAt: "2024-01-01T10:00:00Z",
        startedAt: null, // 着手日なし
        completedAt: "2024-01-02T10:00:00Z",
        prUrl: null,
        assignee: "user",
      },
    ];

    const result = calculateCycleTime(tasks, "2024-01");

    expect(result.completedTaskCount).toBe(0);
    expect(result.taskDetails).toHaveLength(0);
  });

  it("完了日がnullのタスクは除外する", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-1",
        title: "Task 1",
        status: "In Progress",
        createdAt: "2024-01-01T10:00:00Z",
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: null, // 完了日なし
        prUrl: null,
        assignee: "user",
      },
    ];

    const result = calculateCycleTime(tasks, "2024-01");

    expect(result.completedTaskCount).toBe(0);
  });

  it("サイクルタイムを正しく計算する（1タスク）", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-1",
        title: "Task 1",
        status: "Done",
        createdAt: "2024-01-01T10:00:00Z",
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-01T14:00:00Z", // 4時間後
        prUrl: null,
        assignee: "user",
      },
    ];

    const result = calculateCycleTime(tasks, "2024-01");

    expect(result.completedTaskCount).toBe(1);
    expect(result.avgCycleTimeHours).toBe(4);
    expect(result.medianCycleTimeHours).toBe(4);
    expect(result.minCycleTimeHours).toBe(4);
    expect(result.maxCycleTimeHours).toBe(4);
    expect(result.taskDetails).toHaveLength(1);
    expect(result.taskDetails[0].cycleTimeHours).toBe(4);
  });

  it("複数タスクの平均・中央値を正しく計算する", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-1",
        title: "Task 1",
        status: "Done",
        createdAt: "2024-01-01T00:00:00Z",
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-01T12:00:00Z", // 2時間
        prUrl: null,
        assignee: "user",
      },
      {
        id: "task-2",
        title: "Task 2",
        status: "Done",
        createdAt: "2024-01-02T00:00:00Z",
        startedAt: "2024-01-02T10:00:00Z",
        completedAt: "2024-01-02T14:00:00Z", // 4時間
        prUrl: null,
        assignee: "user",
      },
      {
        id: "task-3",
        title: "Task 3",
        status: "Done",
        createdAt: "2024-01-03T00:00:00Z",
        startedAt: "2024-01-03T10:00:00Z",
        completedAt: "2024-01-03T16:00:00Z", // 6時間
        prUrl: null,
        assignee: "user",
      },
    ];

    const result = calculateCycleTime(tasks, "2024-01");

    expect(result.completedTaskCount).toBe(3);
    // 平均: (2 + 4 + 6) / 3 = 4
    expect(result.avgCycleTimeHours).toBe(4);
    // 中央値: 4 (ソート後の真ん中)
    expect(result.medianCycleTimeHours).toBe(4);
    expect(result.minCycleTimeHours).toBe(2);
    expect(result.maxCycleTimeHours).toBe(6);
  });

  it("偶数個のタスクで中央値を正しく計算する", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-1",
        title: "Task 1",
        status: "Done",
        createdAt: "2024-01-01T00:00:00Z",
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-01T12:00:00Z", // 2時間
        prUrl: null,
        assignee: "user",
      },
      {
        id: "task-2",
        title: "Task 2",
        status: "Done",
        createdAt: "2024-01-02T00:00:00Z",
        startedAt: "2024-01-02T10:00:00Z",
        completedAt: "2024-01-02T16:00:00Z", // 6時間
        prUrl: null,
        assignee: "user",
      },
    ];

    const result = calculateCycleTime(tasks, "2024-01");

    // 中央値: (2 + 6) / 2 = 4
    expect(result.medianCycleTimeHours).toBe(4);
  });

  it("日をまたぐサイクルタイムを正しく計算する", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-1",
        title: "Task 1",
        status: "Done",
        createdAt: "2024-01-01T00:00:00Z",
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-02T10:00:00Z", // 24時間後（1日）
        prUrl: null,
        assignee: "user",
      },
    ];

    const result = calculateCycleTime(tasks, "2024-01");

    expect(result.avgCycleTimeHours).toBe(24);
  });

  it("期間文字列を正しく設定する", () => {
    const tasks: NotionTask[] = [];
    const period = "2024-01-01〜2024-01-31";

    const result = calculateCycleTime(tasks, period);

    expect(result.period).toBe(period);
  });

  it("タスク詳細に正しい情報を含む", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-123",
        title: "Implement feature X",
        status: "Done",
        createdAt: "2024-01-01T00:00:00Z",
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-01T14:00:00Z",
        prUrl: null,
        assignee: "user",
      },
    ];

    const result = calculateCycleTime(tasks, "2024-01");

    expect(result.taskDetails[0]).toEqual({
      taskId: "task-123",
      title: "Implement feature X",
      startedAt: "2024-01-01T10:00:00Z",
      completedAt: "2024-01-01T14:00:00Z",
      cycleTimeHours: 4,
    });
  });
});

describe("calculateCodingTime", () => {
  it("タスクがない場合はnullを返す", () => {
    const result = calculateCodingTime([], new Map(), "2024-01");

    expect(result.taskCount).toBe(0);
    expect(result.avgCodingTimeHours).toBeNull();
    expect(result.medianCodingTimeHours).toBeNull();
    expect(result.minCodingTimeHours).toBeNull();
    expect(result.maxCodingTimeHours).toBeNull();
    expect(result.taskDetails).toHaveLength(0);
  });

  it("PRマップが空の場合は0を返す", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-1",
        title: "Task 1",
        status: "Done",
        createdAt: "2024-01-01T10:00:00Z",
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-02T10:00:00Z",
        prUrl: "https://github.com/owner/repo/pull/1",
        assignee: "user",
      },
    ];

    const result = calculateCodingTime(tasks, new Map(), "2024-01");

    expect(result.taskCount).toBe(0);
  });

  it("着手日がnullのタスクは除外する", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-1",
        title: "Task 1",
        status: "Done",
        createdAt: "2024-01-01T10:00:00Z",
        startedAt: null, // 着手日なし
        completedAt: "2024-01-02T10:00:00Z",
        prUrl: "https://github.com/owner/repo/pull/1",
        assignee: "user",
      },
    ];

    const prMap = new Map<string, GitHubPullRequest>([
      ["task-1", {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed",
        createdAt: "2024-01-01T12:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        closedAt: "2024-01-01T14:00:00Z",
        author: "user",
        repository: "owner/repo",
      }],
    ]);

    const result = calculateCodingTime(tasks, prMap, "2024-01");

    expect(result.taskCount).toBe(0);
  });

  it("PR URLがnullのタスクは除外する", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-1",
        title: "Task 1",
        status: "Done",
        createdAt: "2024-01-01T10:00:00Z",
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-02T10:00:00Z",
        prUrl: null, // PR URLなし
        assignee: "user",
      },
    ];

    const prMap = new Map<string, GitHubPullRequest>([
      ["task-1", {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed",
        createdAt: "2024-01-01T12:00:00Z",
        mergedAt: "2024-01-01T14:00:00Z",
        closedAt: "2024-01-01T14:00:00Z",
        author: "user",
        repository: "owner/repo",
      }],
    ]);

    const result = calculateCodingTime(tasks, prMap, "2024-01");

    expect(result.taskCount).toBe(0);
  });

  it("コーディング時間を正しく計算する（1タスク）", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-1",
        title: "Task 1",
        status: "Done",
        createdAt: "2024-01-01T10:00:00Z",
        startedAt: "2024-01-01T10:00:00Z", // 10:00
        completedAt: "2024-01-02T10:00:00Z",
        prUrl: "https://github.com/owner/repo/pull/1",
        assignee: "user",
      },
    ];

    const prMap = new Map<string, GitHubPullRequest>([
      ["task-1", {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed",
        createdAt: "2024-01-01T14:00:00Z", // 14:00 (4時間後)
        mergedAt: "2024-01-01T16:00:00Z",
        closedAt: "2024-01-01T16:00:00Z",
        author: "user",
        repository: "owner/repo",
      }],
    ]);

    const result = calculateCodingTime(tasks, prMap, "2024-01");

    expect(result.taskCount).toBe(1);
    expect(result.avgCodingTimeHours).toBe(4);
    expect(result.medianCodingTimeHours).toBe(4);
    expect(result.minCodingTimeHours).toBe(4);
    expect(result.maxCodingTimeHours).toBe(4);
    expect(result.taskDetails).toHaveLength(1);
    expect(result.taskDetails[0].codingTimeHours).toBe(4);
  });

  it("複数タスクの平均・中央値を正しく計算する", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-1",
        title: "Task 1",
        status: "Done",
        createdAt: "2024-01-01T00:00:00Z",
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-02T10:00:00Z",
        prUrl: "https://github.com/owner/repo/pull/1",
        assignee: "user",
      },
      {
        id: "task-2",
        title: "Task 2",
        status: "Done",
        createdAt: "2024-01-02T00:00:00Z",
        startedAt: "2024-01-02T10:00:00Z",
        completedAt: "2024-01-03T10:00:00Z",
        prUrl: "https://github.com/owner/repo/pull/2",
        assignee: "user",
      },
      {
        id: "task-3",
        title: "Task 3",
        status: "Done",
        createdAt: "2024-01-03T00:00:00Z",
        startedAt: "2024-01-03T10:00:00Z",
        completedAt: "2024-01-04T10:00:00Z",
        prUrl: "https://github.com/owner/repo/pull/3",
        assignee: "user",
      },
    ];

    const prMap = new Map<string, GitHubPullRequest>([
      ["task-1", {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed",
        createdAt: "2024-01-01T12:00:00Z", // 2時間後
        mergedAt: "2024-01-01T14:00:00Z",
        closedAt: "2024-01-01T14:00:00Z",
        author: "user",
        repository: "owner/repo",
      }],
      ["task-2", {
        id: 2,
        number: 2,
        title: "PR 2",
        state: "closed",
        createdAt: "2024-01-02T14:00:00Z", // 4時間後
        mergedAt: "2024-01-02T16:00:00Z",
        closedAt: "2024-01-02T16:00:00Z",
        author: "user",
        repository: "owner/repo",
      }],
      ["task-3", {
        id: 3,
        number: 3,
        title: "PR 3",
        state: "closed",
        createdAt: "2024-01-03T16:00:00Z", // 6時間後
        mergedAt: "2024-01-03T18:00:00Z",
        closedAt: "2024-01-03T18:00:00Z",
        author: "user",
        repository: "owner/repo",
      }],
    ]);

    const result = calculateCodingTime(tasks, prMap, "2024-01");

    expect(result.taskCount).toBe(3);
    // 平均: (2 + 4 + 6) / 3 = 4
    expect(result.avgCodingTimeHours).toBe(4);
    // 中央値: 4
    expect(result.medianCodingTimeHours).toBe(4);
    expect(result.minCodingTimeHours).toBe(2);
    expect(result.maxCodingTimeHours).toBe(6);
  });

  it("負のコーディング時間（PR作成後に着手）はスキップする", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-1",
        title: "Task 1",
        status: "Done",
        createdAt: "2024-01-01T10:00:00Z",
        startedAt: "2024-01-01T14:00:00Z", // PR作成後に着手日を設定
        completedAt: "2024-01-02T10:00:00Z",
        prUrl: "https://github.com/owner/repo/pull/1",
        assignee: "user",
      },
    ];

    const prMap = new Map<string, GitHubPullRequest>([
      ["task-1", {
        id: 1,
        number: 1,
        title: "PR 1",
        state: "closed",
        createdAt: "2024-01-01T10:00:00Z", // 着手前にPR作成
        mergedAt: "2024-01-01T16:00:00Z",
        closedAt: "2024-01-01T16:00:00Z",
        author: "user",
        repository: "owner/repo",
      }],
    ]);

    const result = calculateCodingTime(tasks, prMap, "2024-01");

    expect(result.taskCount).toBe(0);
  });

  it("タスク詳細に正しい情報を含む", () => {
    const tasks: NotionTask[] = [
      {
        id: "task-123",
        title: "Implement feature X",
        status: "Done",
        createdAt: "2024-01-01T00:00:00Z",
        startedAt: "2024-01-01T10:00:00Z",
        completedAt: "2024-01-01T18:00:00Z",
        prUrl: "https://github.com/owner/repo/pull/42",
        assignee: "user",
      },
    ];

    const prMap = new Map<string, GitHubPullRequest>([
      ["task-123", {
        id: 42,
        number: 42,
        title: "Feature X implementation",
        state: "closed",
        createdAt: "2024-01-01T14:00:00Z",
        mergedAt: "2024-01-01T16:00:00Z",
        closedAt: "2024-01-01T16:00:00Z",
        author: "user",
        repository: "owner/repo",
      }],
    ]);

    const result = calculateCodingTime(tasks, prMap, "2024-01");

    expect(result.taskDetails[0]).toEqual({
      taskId: "task-123",
      title: "Implement feature X",
      startedAt: "2024-01-01T10:00:00Z",
      prCreatedAt: "2024-01-01T14:00:00Z",
      prUrl: "https://github.com/owner/repo/pull/42",
      codingTimeHours: 4,
    });
  });

  it("期間文字列を正しく設定する", () => {
    const result = calculateCodingTime([], new Map(), "〜2024-01-31");

    expect(result.period).toBe("〜2024-01-31");
  });
});

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
