/**
 * 日別バックフィル機能のユニットテスト
 */

import { describe, it, expect } from 'bun:test';
import {
  calculateDailyMetrics,
  calculateMetricsForDate,
  generateDateRange,
  isOnDate,
} from '../../src/utils/metrics/dora';
import type {
  GitHubPullRequest,
  GitHubWorkflowRun,
  GitHubDeployment,
} from '../../src/types';

describe('generateDateRange', () => {
  it('同じ日付の場合は1要素を返す', () => {
    const since = new Date('2024-01-15');
    const until = new Date('2024-01-15');

    const result = generateDateRange(since, until);

    expect(result).toHaveLength(1);
    expect(result[0].toISOString().split('T')[0]).toBe('2024-01-15');
  });

  it('3日間の範囲を正しく生成する', () => {
    const since = new Date('2024-01-15');
    const until = new Date('2024-01-17');

    const result = generateDateRange(since, until);

    expect(result).toHaveLength(3);
    expect(result[0].toISOString().split('T')[0]).toBe('2024-01-15');
    expect(result[1].toISOString().split('T')[0]).toBe('2024-01-16');
    expect(result[2].toISOString().split('T')[0]).toBe('2024-01-17');
  });

  it('月をまたぐ範囲を正しく生成する', () => {
    const since = new Date('2024-01-30');
    const until = new Date('2024-02-02');

    const result = generateDateRange(since, until);

    expect(result).toHaveLength(4);
    expect(result[0].toISOString().split('T')[0]).toBe('2024-01-30');
    expect(result[1].toISOString().split('T')[0]).toBe('2024-01-31');
    expect(result[2].toISOString().split('T')[0]).toBe('2024-02-01');
    expect(result[3].toISOString().split('T')[0]).toBe('2024-02-02');
  });
});

describe('isOnDate', () => {
  it('同じ日付の場合はtrueを返す', () => {
    const target = new Date('2024-01-15T10:30:00Z');
    const date = new Date('2024-01-15T00:00:00Z');

    expect(isOnDate(target, date)).toBe(true);
  });

  it('異なる日付の場合はfalseを返す', () => {
    const target = new Date('2024-01-15T10:30:00Z');
    const date = new Date('2024-01-16T00:00:00Z');

    expect(isOnDate(target, date)).toBe(false);
  });

  it('時刻が異なっても同じ日付ならtrueを返す', () => {
    const target = new Date('2024-01-15T23:59:59Z');
    const date = new Date('2024-01-15T00:00:00Z');

    expect(isOnDate(target, date)).toBe(true);
  });
});

describe('calculateMetricsForDate', () => {
  it('PRがない場合はゼロ値を返す', () => {
    const result = calculateMetricsForDate('owner/repo', '2024-01-15', [], [], []);

    expect(result.date).toBe('2024-01-15');
    expect(result.repository).toBe('owner/repo');
    expect(result.deploymentCount).toBe(0);
    expect(result.leadTimeForChangesHours).toBe(0);
    expect(result.totalDeployments).toBe(0);
    expect(result.failedDeployments).toBe(0);
    expect(result.changeFailureRate).toBe(0);
  });

  it('指定日付でメトリクスを計算する', () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: 'PR 1',
        state: 'closed',
        createdAt: '2024-01-15T08:00:00Z',
        mergedAt: '2024-01-15T10:00:00Z', // PR作成から2時間後
        closedAt: '2024-01-15T10:00:00Z',
        author: 'user',
        repository: 'owner/repo',
      },
    ];

    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: 'abc123',
        environment: 'production',
        createdAt: '2024-01-15T11:00:00Z', // PR作成から3時間後（マージから1時間後）
        updatedAt: '2024-01-15T11:05:00Z',
        status: 'success',
        repository: 'owner/repo',
      },
    ];

    const result = calculateMetricsForDate('owner/repo', '2024-01-15', prs, [], deployments);

    expect(result.date).toBe('2024-01-15');
    expect(result.repository).toBe('owner/repo');
    expect(result.deploymentCount).toBe(1);
    expect(result.leadTimeForChangesHours).toBe(3); // PR作成からデプロイまで3時間
    expect(result.totalDeployments).toBe(1);
    expect(result.failedDeployments).toBe(0);
    expect(result.changeFailureRate).toBe(0);
  });
});

describe('calculateDailyMetrics', () => {
  const repositories = [{ fullName: 'owner/repo' }];

  it('マージ日でグループ化される', () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: 'PR 1',
        state: 'closed',
        createdAt: '2024-01-14T08:00:00Z',
        mergedAt: '2024-01-15T10:00:00Z', // 1月15日にマージ
        closedAt: '2024-01-15T10:00:00Z',
        author: 'user',
        repository: 'owner/repo',
      },
      {
        id: 2,
        number: 2,
        title: 'PR 2',
        state: 'closed',
        createdAt: '2024-01-14T09:00:00Z',
        mergedAt: '2024-01-15T14:00:00Z', // 1月15日にマージ
        closedAt: '2024-01-15T14:00:00Z',
        author: 'user',
        repository: 'owner/repo',
      },
      {
        id: 3,
        number: 3,
        title: 'PR 3',
        state: 'closed',
        createdAt: '2024-01-15T08:00:00Z',
        mergedAt: '2024-01-16T09:00:00Z', // 1月16日にマージ
        closedAt: '2024-01-16T09:00:00Z',
        author: 'user',
        repository: 'owner/repo',
      },
    ];

    const result = calculateDailyMetrics(
      repositories,
      prs,
      [],
      [],
      { since: new Date('2024-01-15'), until: new Date('2024-01-16') }
    );

    expect(result).toHaveLength(2);

    // 1月15日: 2つのPR
    const jan15 = result.find((m) => m.date === '2024-01-15');
    expect(jan15).toBeDefined();
    // Lead time計算（PR作成→マージ）
    expect(jan15!.leadTimeForChangesHours).toBeGreaterThan(0);

    // 1月16日: 1つのPR
    const jan16 = result.find((m) => m.date === '2024-01-16');
    expect(jan16).toBeDefined();
  });

  it('リポジトリごとに分離される', () => {
    const multiRepoRepositories = [
      { fullName: 'owner/repo1' },
      { fullName: 'owner/repo2' },
    ];

    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: 'PR for repo1',
        state: 'closed',
        createdAt: '2024-01-15T08:00:00Z',
        mergedAt: '2024-01-15T10:00:00Z',
        closedAt: '2024-01-15T10:00:00Z',
        author: 'user',
        repository: 'owner/repo1',
      },
      {
        id: 2,
        number: 2,
        title: 'PR for repo2',
        state: 'closed',
        createdAt: '2024-01-15T08:00:00Z',
        mergedAt: '2024-01-15T12:00:00Z',
        closedAt: '2024-01-15T12:00:00Z',
        author: 'user',
        repository: 'owner/repo2',
      },
    ];

    const result = calculateDailyMetrics(
      multiRepoRepositories,
      prs,
      [],
      [],
      { since: new Date('2024-01-15'), until: new Date('2024-01-15') }
    );

    // 同じ日付でもリポジトリごとに別レコード
    expect(result).toHaveLength(2);

    const repo1 = result.find((m) => m.repository === 'owner/repo1');
    const repo2 = result.find((m) => m.repository === 'owner/repo2');

    expect(repo1).toBeDefined();
    expect(repo2).toBeDefined();
    expect(repo1!.date).toBe('2024-01-15');
    expect(repo2!.date).toBe('2024-01-15');
  });

  it('30日分で30×リポジトリ数のレコードを生成する', () => {
    const result = calculateDailyMetrics(
      repositories,
      [],
      [],
      [],
      { since: new Date('2024-01-01'), until: new Date('2024-01-30') }
    );

    // 30日間 × 1リポジトリ = 30レコード
    expect(result).toHaveLength(30);
  });

  it('複数リポジトリで30日分の場合、30×リポジトリ数のレコードを生成する', () => {
    const threeRepos = [
      { fullName: 'owner/repo1' },
      { fullName: 'owner/repo2' },
      { fullName: 'owner/repo3' },
    ];

    const result = calculateDailyMetrics(
      threeRepos,
      [],
      [],
      [],
      { since: new Date('2024-01-01'), until: new Date('2024-01-30') }
    );

    // 30日間 × 3リポジトリ = 90レコード
    expect(result).toHaveLength(90);
  });

  it('未マージのPRはカウントされない', () => {
    const prs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: 'Open PR',
        state: 'open',
        createdAt: '2024-01-15T08:00:00Z',
        mergedAt: null, // 未マージ
        closedAt: null,
        author: 'user',
        repository: 'owner/repo',
      },
    ];

    const result = calculateDailyMetrics(
      repositories,
      prs,
      [],
      [],
      { since: new Date('2024-01-15'), until: new Date('2024-01-15') }
    );

    expect(result).toHaveLength(1);
    expect(result[0].leadTimeForChangesHours).toBe(0);
  });

  it('デプロイメントを日付でフィルタリングする', () => {
    const deployments: GitHubDeployment[] = [
      {
        id: 1,
        sha: 'abc123',
        environment: 'production',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:05:00Z',
        status: 'success',
        repository: 'owner/repo',
      },
      {
        id: 2,
        sha: 'def456',
        environment: 'production',
        createdAt: '2024-01-16T10:00:00Z',
        updatedAt: '2024-01-16T10:05:00Z',
        status: 'success',
        repository: 'owner/repo',
      },
    ];

    const result = calculateDailyMetrics(
      repositories,
      [],
      [],
      deployments,
      { since: new Date('2024-01-15'), until: new Date('2024-01-16') }
    );

    const jan15 = result.find((m) => m.date === '2024-01-15');
    const jan16 = result.find((m) => m.date === '2024-01-16');

    expect(jan15!.deploymentCount).toBe(1);
    expect(jan16!.deploymentCount).toBe(1);
  });

  it('ワークフロー実行を日付でフィルタリングする', () => {
    const runs: GitHubWorkflowRun[] = [
      {
        id: 1,
        name: 'Deploy',
        status: 'completed',
        conclusion: 'success',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:05:00Z',
        repository: 'owner/repo',
      },
      {
        id: 2,
        name: 'Deploy',
        status: 'completed',
        conclusion: 'failure',
        createdAt: '2024-01-15T14:00:00Z',
        updatedAt: '2024-01-15T14:05:00Z',
        repository: 'owner/repo',
      },
      {
        id: 3,
        name: 'Deploy',
        status: 'completed',
        conclusion: 'success',
        createdAt: '2024-01-16T10:00:00Z',
        updatedAt: '2024-01-16T10:05:00Z',
        repository: 'owner/repo',
      },
    ];

    const result = calculateDailyMetrics(
      repositories,
      [],
      runs,
      [],
      { since: new Date('2024-01-15'), until: new Date('2024-01-16') }
    );

    const jan15 = result.find((m) => m.date === '2024-01-15');
    const jan16 = result.find((m) => m.date === '2024-01-16');

    // 1月15日: 成功1、失敗1
    expect(jan15!.totalDeployments).toBe(2);
    expect(jan15!.failedDeployments).toBe(1);
    expect(jan15!.changeFailureRate).toBe(50);

    // 1月16日: 成功1
    expect(jan16!.totalDeployments).toBe(1);
    expect(jan16!.failedDeployments).toBe(0);
    expect(jan16!.changeFailureRate).toBe(0);
  });
});
