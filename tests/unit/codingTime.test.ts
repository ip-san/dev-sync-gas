/**
 * コーディング時間計算のテスト
 */

import { describe, it, expect } from 'bun:test';
import { calculateCodingTime } from '../../src/utils/metrics/codingTime';
import type { IssueCodingTime } from '../../src/types';

describe('calculateCodingTime', () => {
  const period = '2024-01';

  it('正常系: コーディング時間を正しく計算する', () => {
    const data: IssueCodingTime[] = [
      {
        issueNumber: 1,
        issueTitle: 'Feature A',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-01T00:00:00Z',
        prCreatedAt: '2024-01-01T10:00:00Z',
        prNumber: 10,
        codingTimeHours: 10,
      },
      {
        issueNumber: 2,
        issueTitle: 'Feature B',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-02T00:00:00Z',
        prCreatedAt: '2024-01-02T20:00:00Z',
        prNumber: 11,
        codingTimeHours: 20,
      },
    ];

    const result = calculateCodingTime(data, period);

    expect(result.period).toBe(period);
    expect(result.issueCount).toBe(2);
    expect(result.avgCodingTimeHours).toBe(15);
    expect(result.medianCodingTimeHours).toBe(15);
    expect(result.minCodingTimeHours).toBe(10);
    expect(result.maxCodingTimeHours).toBe(20);
    expect(result.issueDetails).toHaveLength(2);
    expect(result.issueDetails[0].issueNumber).toBe(1);
    expect(result.issueDetails[0].codingTimeHours).toBe(10);
  });

  it('空配列の場合はnullを返す', () => {
    const result = calculateCodingTime([], period);

    expect(result.period).toBe(period);
    expect(result.issueCount).toBe(0);
    expect(result.avgCodingTimeHours).toBeNull();
    expect(result.medianCodingTimeHours).toBeNull();
    expect(result.minCodingTimeHours).toBeNull();
    expect(result.maxCodingTimeHours).toBeNull();
    expect(result.issueDetails).toEqual([]);
  });

  it('PRがリンクされていないIssueは除外する', () => {
    const data: IssueCodingTime[] = [
      {
        issueNumber: 1,
        issueTitle: 'Feature A',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-01T00:00:00Z',
        prCreatedAt: '2024-01-01T10:00:00Z',
        prNumber: 10,
        codingTimeHours: 10,
      },
      {
        issueNumber: 2,
        issueTitle: 'Feature B (no PR)',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-02T00:00:00Z',
        prCreatedAt: null,
        prNumber: null,
        codingTimeHours: null,
      },
    ];

    const result = calculateCodingTime(data, period);

    expect(result.issueCount).toBe(1);
    expect(result.avgCodingTimeHours).toBe(10);
    expect(result.issueDetails).toHaveLength(1);
    expect(result.issueDetails[0].issueNumber).toBe(1);
  });

  it('負のコーディング時間は除外する', () => {
    const data: IssueCodingTime[] = [
      {
        issueNumber: 1,
        issueTitle: 'Feature A',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-01T10:00:00Z',
        prCreatedAt: '2024-01-01T00:00:00Z', // Issue作成前にPR作成（異常）
        prNumber: 10,
        codingTimeHours: -10,
      },
      {
        issueNumber: 2,
        issueTitle: 'Feature B',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-02T00:00:00Z',
        prCreatedAt: '2024-01-02T20:00:00Z',
        prNumber: 11,
        codingTimeHours: 20,
      },
    ];

    const result = calculateCodingTime(data, period);

    expect(result.issueCount).toBe(1);
    expect(result.avgCodingTimeHours).toBe(20);
  });

  it('単一のIssueの場合も正しく計算する', () => {
    const data: IssueCodingTime[] = [
      {
        issueNumber: 1,
        issueTitle: 'Feature A',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-01T00:00:00Z',
        prCreatedAt: '2024-01-01T05:00:00Z',
        prNumber: 10,
        codingTimeHours: 5,
      },
    ];

    const result = calculateCodingTime(data, period);

    expect(result.issueCount).toBe(1);
    expect(result.avgCodingTimeHours).toBe(5);
    expect(result.medianCodingTimeHours).toBe(5);
    expect(result.minCodingTimeHours).toBe(5);
    expect(result.maxCodingTimeHours).toBe(5);
  });

  it('0時間のコーディング時間も有効とする', () => {
    const data: IssueCodingTime[] = [
      {
        issueNumber: 1,
        issueTitle: 'Quick Fix',
        repository: 'owner/repo',
        issueCreatedAt: '2024-01-01T00:00:00Z',
        prCreatedAt: '2024-01-01T00:00:00Z',
        prNumber: 10,
        codingTimeHours: 0,
      },
    ];

    const result = calculateCodingTime(data, period);

    expect(result.issueCount).toBe(1);
    expect(result.avgCodingTimeHours).toBe(0);
  });
});
