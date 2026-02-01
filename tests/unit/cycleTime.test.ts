/**
 * サイクルタイム計算のテスト
 */

import { describe, it, expect } from 'bun:test';
import { calculateCycleTime } from '../../src/utils/metrics/cycleTime';
import type { IssueCycleTime } from '../../src/types';

describe('calculateCycleTime', () => {
  const period = '2024-01';

  it('正常系: サイクルタイムを正しく計算する', () => {
    const data: IssueCycleTime[] = [
      {
        issueNumber: 1,
        issueTitle: 'Feature A',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-01T00:00:00Z',
        productionMergedAt: '2024-01-02T00:00:00Z',
        cycleTimeHours: 24,
        prChain: [{ prNumber: 10, mergedAt: '2024-01-02T00:00:00Z' }],
      },
      {
        issueNumber: 2,
        issueTitle: 'Feature B',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-03T00:00:00Z',
        productionMergedAt: '2024-01-05T00:00:00Z',
        cycleTimeHours: 48,
        prChain: [{ prNumber: 11, mergedAt: '2024-01-05T00:00:00Z' }],
      },
    ];

    const result = calculateCycleTime(data, period);

    expect(result.period).toBe(period);
    expect(result.completedTaskCount).toBe(2);
    expect(result.avgCycleTimeHours).toBe(36);
    expect(result.medianCycleTimeHours).toBe(36);
    expect(result.minCycleTimeHours).toBe(24);
    expect(result.maxCycleTimeHours).toBe(48);
    expect(result.issueDetails).toHaveLength(2);
    expect(result.issueDetails[0].issueNumber).toBe(1);
    expect(result.issueDetails[0].cycleTimeHours).toBe(24);
  });

  it('空配列の場合はnullを返す', () => {
    const result = calculateCycleTime([], period);

    expect(result.period).toBe(period);
    expect(result.completedTaskCount).toBe(0);
    expect(result.avgCycleTimeHours).toBeNull();
    expect(result.medianCycleTimeHours).toBeNull();
    expect(result.minCycleTimeHours).toBeNull();
    expect(result.maxCycleTimeHours).toBeNull();
    expect(result.issueDetails).toEqual([]);
  });

  it('productionマージが完了していないIssueは除外する', () => {
    const data: IssueCycleTime[] = [
      {
        issueNumber: 1,
        issueTitle: 'Feature A',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-01T00:00:00Z',
        productionMergedAt: '2024-01-02T00:00:00Z',
        cycleTimeHours: 24,
        prChain: [{ prNumber: 10, mergedAt: '2024-01-02T00:00:00Z' }],
      },
      {
        issueNumber: 2,
        issueTitle: 'Feature B (in progress)',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-03T00:00:00Z',
        productionMergedAt: null,
        cycleTimeHours: null,
        prChain: [],
      },
    ];

    const result = calculateCycleTime(data, period);

    expect(result.completedTaskCount).toBe(1);
    expect(result.avgCycleTimeHours).toBe(24);
    expect(result.issueDetails).toHaveLength(1);
    expect(result.issueDetails[0].issueNumber).toBe(1);
  });

  it('PRチェーンのサマリーを正しく生成する', () => {
    const data: IssueCycleTime[] = [
      {
        issueNumber: 1,
        issueTitle: 'Feature with multiple PRs',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-01T00:00:00Z',
        productionMergedAt: '2024-01-03T00:00:00Z',
        cycleTimeHours: 48,
        prChain: [
          { prNumber: 10, mergedAt: '2024-01-02T00:00:00Z' },
          { prNumber: 11, mergedAt: '2024-01-02T12:00:00Z' },
          { prNumber: 12, mergedAt: '2024-01-03T00:00:00Z' },
        ],
      },
    ];

    const result = calculateCycleTime(data, period);

    expect(result.issueDetails[0].prChainSummary).toBe('#10→#11→#12');
  });

  it('単一のIssueの場合も正しく計算する', () => {
    const data: IssueCycleTime[] = [
      {
        issueNumber: 1,
        issueTitle: 'Feature A',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-01T00:00:00Z',
        productionMergedAt: '2024-01-01T12:00:00Z',
        cycleTimeHours: 12,
        prChain: [{ prNumber: 10, mergedAt: '2024-01-01T12:00:00Z' }],
      },
    ];

    const result = calculateCycleTime(data, period);

    expect(result.completedTaskCount).toBe(1);
    expect(result.avgCycleTimeHours).toBe(12);
    expect(result.medianCycleTimeHours).toBe(12);
    expect(result.minCycleTimeHours).toBe(12);
    expect(result.maxCycleTimeHours).toBe(12);
  });

  it('PRチェーンが空の場合も処理できる', () => {
    const data: IssueCycleTime[] = [
      {
        issueNumber: 1,
        issueTitle: 'Direct merge',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-01T00:00:00Z',
        productionMergedAt: '2024-01-01T12:00:00Z',
        cycleTimeHours: 12,
        prChain: [],
      },
    ];

    const result = calculateCycleTime(data, period);

    expect(result.completedTaskCount).toBe(1);
    expect(result.issueDetails[0].prChainSummary).toBe('');
  });

  it('複数リポジトリのIssueを集計できる', () => {
    const data: IssueCycleTime[] = [
      {
        issueNumber: 1,
        issueTitle: 'Feature A',
        repository: 'owner/repo-a',
        issueCreatedAt: '2024-01-01T00:00:00Z',
        productionMergedAt: '2024-01-02T00:00:00Z',
        cycleTimeHours: 24,
        prChain: [{ prNumber: 10, mergedAt: '2024-01-02T00:00:00Z' }],
      },
      {
        issueNumber: 2,
        issueTitle: 'Feature B',
        repository: 'owner/repo-b',
        issueCreatedAt: '2024-01-03T00:00:00Z',
        productionMergedAt: '2024-01-05T00:00:00Z',
        cycleTimeHours: 48,
        prChain: [{ prNumber: 11, mergedAt: '2024-01-05T00:00:00Z' }],
      },
    ];

    const result = calculateCycleTime(data, period);

    expect(result.completedTaskCount).toBe(2);
    expect(result.issueDetails[0].repository).toBe('owner/repo-a');
    expect(result.issueDetails[1].repository).toBe('owner/repo-b');
  });
});
