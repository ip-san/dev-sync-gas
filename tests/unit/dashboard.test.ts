/**
 * Dashboard集計のユニットテスト
 *
 * Dashboard表示用のデータ集計・週次トレンド計算をテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { initializeContainer, resetContainer } from '../../src/container';
import { createMockContainer } from '../mocks';
import {
  extractLatestMetricsByRepository,
  calculateWeeklyTrends,
  determineHealthStatus,
  enrichWithExtendedMetrics,
  type WeeklyTrendData,
} from '../../src/services/spreadsheet/dashboard';
import type { DevOpsMetrics, HealthStatus } from '../../src/types';

describe('Dashboard Aggregation', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    initializeContainer(mockContainer);
  });

  afterEach(() => {
    resetContainer();
  });

  describe('extractLatestMetricsByRepository', () => {
    it('should extract latest metrics for each repository', () => {
      const metrics: DevOpsMetrics[] = [
        {
          date: '2024-01-01',
          repository: 'owner/repo1',
          deploymentFrequency: '1.5',
          leadTimeForChangesHours: 24.5,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 3.2,
          deploymentCount: 3,
          periodStart: '2023-12-25',
          periodEnd: '2024-01-01',
        },
        {
          date: '2024-01-02',
          repository: 'owner/repo1',
          deploymentFrequency: '2.0',
          leadTimeForChangesHours: 20.0,
          changeFailureRate: 3.0,
          meanTimeToRecoveryHours: 2.5,
          deploymentCount: 4,
          periodStart: '2023-12-26',
          periodEnd: '2024-01-02',
        },
        {
          date: '2024-01-01',
          repository: 'owner/repo2',
          deploymentFrequency: '3.0',
          leadTimeForChangesHours: 15.0,
          changeFailureRate: 2.0,
          meanTimeToRecoveryHours: 1.5,
          deploymentCount: 6,
          periodStart: '2023-12-25',
          periodEnd: '2024-01-01',
        },
      ];

      const result = extractLatestMetricsByRepository(metrics);

      expect(result.size).toBe(2);

      // repo1は最新日付(2024-01-02)のデータ
      const repo1 = result.get('owner/repo1');
      expect(repo1?.latestDate).toBe('2024-01-02');
      expect(repo1?.leadTimeHours).toBe(20.0);
      expect(repo1?.deploymentFrequency).toBe('2.0');

      // repo2は唯一のデータ
      const repo2 = result.get('owner/repo2');
      expect(repo2?.latestDate).toBe('2024-01-01');
      expect(repo2?.leadTimeHours).toBe(15.0);
      expect(repo2?.deploymentFrequency).toBe('3.0');
    });

    it('should handle single repository', () => {
      const metrics: DevOpsMetrics[] = [
        {
          date: '2024-01-01',
          repository: 'owner/repo',
          deploymentFrequency: '1.0',
          leadTimeForChangesHours: 10.0,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 2.0,
          deploymentCount: 2,
          periodStart: '2023-12-25',
          periodEnd: '2024-01-01',
        },
      ];

      const result = extractLatestMetricsByRepository(metrics);

      expect(result.size).toBe(1);
      expect(result.get('owner/repo')?.leadTimeHours).toBe(10.0);
    });

    it('should handle empty metrics', () => {
      const result = extractLatestMetricsByRepository([]);
      expect(result.size).toBe(0);
    });

    it('should initialize extended metrics as null', () => {
      const metrics: DevOpsMetrics[] = [
        {
          date: '2024-01-01',
          repository: 'owner/repo',
          deploymentFrequency: '1.0',
          leadTimeForChangesHours: 10.0,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 2.0,
          deploymentCount: 2,
          periodStart: '2023-12-25',
          periodEnd: '2024-01-01',
        },
      ];

      const result = extractLatestMetricsByRepository(metrics);
      const data = result.get('owner/repo');

      expect(data?.cycleTimeHours).toBeNull();
      expect(data?.codingTimeHours).toBeNull();
      expect(data?.timeToFirstReviewHours).toBeNull();
      expect(data?.reviewDurationHours).toBeNull();
      expect(data?.avgLinesOfCode).toBeNull();
      expect(data?.avgAdditionalCommits).toBeNull();
      expect(data?.avgForcePushCount).toBeNull();
    });
  });

  describe('determineHealthStatus', () => {
    it('should return "good" when all metrics are within thresholds', () => {
      const status = determineHealthStatus(
        10.0, // leadTime < 24
        2.0, // changeFailureRate < 5
        15.0, // cycleTime < 48
        2.0 // timeToFirstReview < 24
      );

      expect(status).toBe('good');
    });

    it('should return "warning" when one metric is in warning range', () => {
      const status = determineHealthStatus(
        30.0, // leadTime 24-72 (warning)
        2.0, // changeFailureRate < 5 (good)
        15.0, // cycleTime < 48 (good)
        2.0 // timeToFirstReview < 24 (good)
      );

      expect(status).toBe('warning');
    });

    it('should return "critical" when one metric exceeds thresholds', () => {
      const status = determineHealthStatus(
        200.0, // leadTime > 168 (critical)
        2.0,
        15.0,
        2.0
      );

      expect(status).toBe('critical');
    });

    it('should select worst status when multiple metrics are problematic', () => {
      const status = determineHealthStatus(
        30.0, // warning
        8.0, // changeFailureRate > 5 (warning)
        15.0,
        2.0
      );

      expect(status).toBe('warning');
    });

    it('should handle null values gracefully', () => {
      const status = determineHealthStatus(null, null, null, null);

      // null値は評価されず、デフォルトで"good"
      expect(status).toBe('good');
    });

    it('should prioritize critical over warning', () => {
      const status = determineHealthStatus(
        30.0, // warning
        20.0, // changeFailureRate > 15 (critical)
        15.0,
        2.0
      );

      expect(status).toBe('critical');
    });
  });

  describe('calculateWeeklyTrends', () => {
    it('should calculate weekly trends from metrics', () => {
      const metrics: DevOpsMetrics[] = [
        // Week 1 (2024-01-01 = Mon)
        {
          date: '2024-01-01',
          repository: 'owner/repo1',
          deploymentFrequency: '1.0',
          leadTimeForChangesHours: 24.0,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 2.0,
          deploymentCount: 2,
          periodStart: '2023-12-25',
          periodEnd: '2024-01-01',
        },
        {
          date: '2024-01-02',
          repository: 'owner/repo2',
          deploymentFrequency: '2.0',
          leadTimeForChangesHours: 30.0,
          changeFailureRate: 3.0,
          meanTimeToRecoveryHours: 1.5,
          deploymentCount: 4,
          periodStart: '2023-12-26',
          periodEnd: '2024-01-02',
        },
        // Week 2 (2024-01-08)
        {
          date: '2024-01-08',
          repository: 'owner/repo1',
          deploymentFrequency: '1.5',
          leadTimeForChangesHours: 20.0,
          changeFailureRate: 2.0,
          meanTimeToRecoveryHours: 1.0,
          deploymentCount: 3,
          periodStart: '2024-01-01',
          periodEnd: '2024-01-08',
        },
      ];

      const trends = calculateWeeklyTrends(metrics, 4);

      expect(trends.length).toBeGreaterThanOrEqual(2);

      // 週ごとに平均値が計算される
      const week1 = trends.find((t) => t.week.includes('2024-W01'));
      expect(week1).toBeDefined();
      expect(week1?.totalDeployments).toBe(6); // 2 + 4
      expect(week1?.avgLeadTimeHours).toBe(27.0); // (24 + 30) / 2
      expect(week1?.avgChangeFailureRate).toBe(4.0); // (5 + 3) / 2
    });

    it('should handle empty metrics', () => {
      const trends = calculateWeeklyTrends([], 4);

      // 空の場合は空配列を返す
      expect(trends.length).toBe(0);
    });

    it('should handle single metric', () => {
      const metrics: DevOpsMetrics[] = [
        {
          date: '2024-01-01',
          repository: 'owner/repo',
          deploymentFrequency: '1.0',
          leadTimeForChangesHours: 10.0,
          changeFailureRate: 2.0,
          meanTimeToRecoveryHours: 1.0,
          deploymentCount: 2,
          periodStart: '2023-12-25',
          periodEnd: '2024-01-01',
        },
      ];

      const trends = calculateWeeklyTrends(metrics, 2);

      expect(trends.length).toBe(1);
      expect(trends[0].totalDeployments).toBe(2);
      expect(trends[0].avgLeadTimeHours).toBe(10.0);
      expect(trends[0].avgChangeFailureRate).toBe(2.0);
    });

    it('should limit to specified week count', () => {
      const metrics: DevOpsMetrics[] = [
        {
          date: '2024-01-01',
          repository: 'owner/repo',
          deploymentFrequency: '1.0',
          leadTimeForChangesHours: 10.0,
          changeFailureRate: 2.0,
          meanTimeToRecoveryHours: 1.0,
          deploymentCount: 2,
          periodStart: '2023-12-25',
          periodEnd: '2024-01-01',
        },
      ];

      const trends2 = calculateWeeklyTrends(metrics, 2);
      const trends8 = calculateWeeklyTrends(metrics, 8);

      expect(trends2.length).toBeLessThanOrEqual(2);
      expect(trends8.length).toBeLessThanOrEqual(8);
    });
  });

  describe('enrichWithExtendedMetrics', () => {
    it('should enrich with extended metrics from repository sheets', () => {
      const latestByRepo = new Map();
      latestByRepo.set('owner/repo', {
        repository: 'owner/repo',
        latestDate: '2024-01-01',
        deploymentFrequency: '1.0',
        leadTimeHours: 24.0,
        changeFailureRate: 5.0,
        mttrHours: 2.0,
        cycleTimeHours: null,
        codingTimeHours: null,
        timeToFirstReviewHours: null,
        reviewDurationHours: null,
        avgLinesOfCode: null,
        avgAdditionalCommits: null,
        avgForcePushCount: null,
      });

      // モックスプレッドシートに拡張指標シートを作成（集計シート形式）
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as import('../mocks').MockSpreadsheet;
      spreadsheet.addSheet('owner/repo - コーディング時間', [
        [
          '日付',
          '完了Issue数',
          '平均コーディング時間 (時間)',
          '平均コーディング時間 (日)',
          '中央値 (時間)',
          '最小 (時間)',
          '最大 (時間)',
        ],
        ['2024-01-01', 1, 10.5, 0.4, 10.5, 10.5, 10.5],
        ['2024-01-02', 1, 15.0, 0.6, 15.0, 15.0, 15.0],
      ]);

      // 拡張指標を統合
      enrichWithExtendedMetrics(mockContainer.spreadsheetId, latestByRepo);

      const data = latestByRepo.get('owner/repo');

      // コーディング時間の平均が計算される (10.5 + 15.0) / 2 = 12.75
      expect(data?.codingTimeHours).toBe(12.75);
    });

    it('should handle missing extended metric sheets gracefully', () => {
      const latestByRepo = new Map();
      latestByRepo.set('owner/repo', {
        repository: 'owner/repo',
        latestDate: '2024-01-01',
        deploymentFrequency: '1.0',
        leadTimeHours: 24.0,
        changeFailureRate: 5.0,
        mttrHours: 2.0,
        cycleTimeHours: null,
        codingTimeHours: null,
        timeToFirstReviewHours: null,
        reviewDurationHours: null,
        avgLinesOfCode: null,
        avgAdditionalCommits: null,
        avgForcePushCount: null,
      });

      // シートが存在しない場合
      enrichWithExtendedMetrics(mockContainer.spreadsheetId, latestByRepo);

      const data = latestByRepo.get('owner/repo');

      // null のまま
      expect(data?.cycleTimeHours).toBeNull();
      expect(data?.codingTimeHours).toBeNull();
    });

    it('should handle empty sheets', () => {
      const latestByRepo = new Map();
      latestByRepo.set('owner/repo', {
        repository: 'owner/repo',
        latestDate: '2024-01-01',
        deploymentFrequency: '1.0',
        leadTimeHours: 24.0,
        changeFailureRate: 5.0,
        mttrHours: 2.0,
        cycleTimeHours: null,
        codingTimeHours: null,
        timeToFirstReviewHours: null,
        reviewDurationHours: null,
        avgLinesOfCode: null,
        avgAdditionalCommits: null,
        avgForcePushCount: null,
      });

      // 空のシート（ヘッダーのみ）
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as import('../mocks').MockSpreadsheet;
      spreadsheet.addSheet('owner/repo/コーディング時間', [
        [
          'Issue番号',
          'タイトル',
          'Issue作成日時',
          'PR作成日時',
          'PR番号',
          'コーディング時間 (時間)',
          'コーディング時間 (日)',
        ],
      ]);

      enrichWithExtendedMetrics(mockContainer.spreadsheetId, latestByRepo);

      const data = latestByRepo.get('owner/repo');

      // 空シートはnull
      expect(data?.codingTimeHours).toBeNull();
    });

    it('should handle numeric values as strings from spreadsheet', () => {
      const latestByRepo = new Map();
      latestByRepo.set('owner/repo', {
        repository: 'owner/repo',
        latestDate: '2024-01-01',
        deploymentFrequency: '1.0',
        leadTimeHours: 24.0,
        changeFailureRate: 5.0,
        mttrHours: 2.0,
        cycleTimeHours: null,
        codingTimeHours: null,
        timeToFirstReviewHours: null,
        reviewDurationHours: null,
        avgLinesOfCode: null,
        avgAdditionalCommits: null,
        avgForcePushCount: null,
      });

      // スプレッドシートから取得した数値が文字列として返される場合
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as import('../mocks').MockSpreadsheet;
      spreadsheet.addSheet('owner/repo - サイクルタイム', [
        [
          '日付',
          '完了Issue数',
          '平均サイクルタイム (時間)',
          '平均サイクルタイム (日)',
          '中央値 (時間)',
          '最小 (時間)',
          '最大 (時間)',
        ],
        ['2024-01-01', '2', '24.5', '1.0', '24.5', '20.0', '30.0'], // 文字列として返される
        ['2024-01-02', '3', '36.0', '1.5', '35.0', '25.0', '45.0'], // 文字列として返される
      ]);

      enrichWithExtendedMetrics(mockContainer.spreadsheetId, latestByRepo);

      const data = latestByRepo.get('owner/repo');

      // 文字列を数値に変換して平均計算: (24.5 + 36.0) / 2 = 30.25
      expect(data?.cycleTimeHours).toBe(30.25);
    });
  });
});
