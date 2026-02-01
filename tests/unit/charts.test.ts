/**
 * チャート生成機能のユニットテスト
 *
 * Note: チャート生成はGAS固有APIを使用するため、テスト環境ではモックチャートを使用
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { initializeContainer, resetContainer } from '../../src/container';
import { createMockContainer, MockSpreadsheet } from '../mocks';
import {
  addWeeklyTrendLineChart,
  addDeploymentFrequencyBarChart,
  addLeadTimeBarChart,
  addChangeFailureRateBarChart,
  addCycleTimeBarChart,
  addAllDashboardCharts,
  addTrendCharts,
} from '../../src/services/spreadsheet/charts';
import type {
  WeeklyTrendData,
  RepositoryLatestData,
} from '../../src/services/spreadsheet/dashboard';

describe('Dashboard Charts', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    initializeContainer(mockContainer);
  });

  afterEach(() => {
    resetContainer();
  });

  describe('addWeeklyTrendLineChart', () => {
    it('should skip empty trends', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const sheet = spreadsheet.insertSheet('Test Sheet');

      addWeeklyTrendLineChart(sheet, []);

      const charts = sheet.getCharts();
      expect(charts.length).toBe(0);
    });

    it('should add mock chart for test environment', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const sheet = spreadsheet.insertSheet('Trend Sheet');

      const trends: WeeklyTrendData[] = [
        {
          week: '2024-W01',
          totalDeployments: 10,
          avgLeadTimeHours: 24.5,
          avgChangeFailureRate: 5.0,
          avgCycleTimeHours: 48.0,
        },
        {
          week: '2024-W02',
          totalDeployments: 12,
          avgLeadTimeHours: 20.0,
          avgChangeFailureRate: 3.0,
          avgCycleTimeHours: 40.0,
        },
      ];

      addWeeklyTrendLineChart(sheet, trends);

      const charts = sheet.getCharts();
      expect(charts.length).toBe(1);
      expect(charts[0].getChartId()).toBe(1);
    });

    it('should clear existing charts before adding new one', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const sheet = spreadsheet.insertSheet('Trend Sheet');

      const trends: WeeklyTrendData[] = [
        {
          week: '2024-W01',
          totalDeployments: 10,
          avgLeadTimeHours: 24.5,
          avgChangeFailureRate: 5.0,
          avgCycleTimeHours: 48.0,
        },
      ];

      // 最初のチャート追加
      addWeeklyTrendLineChart(sheet, trends);
      expect(sheet.getCharts().length).toBe(1);

      // 2回目のチャート追加（既存チャートをクリア）
      addWeeklyTrendLineChart(sheet, trends);
      expect(sheet.getCharts().length).toBe(1);
    });
  });

  describe('addDeploymentFrequencyBarChart', () => {
    it('should skip empty repository data', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const sheet = spreadsheet.insertSheet('Dashboard');

      addDeploymentFrequencyBarChart(sheet, []);

      const charts = sheet.getCharts();
      expect(charts.length).toBe(0);
    });

    it('should add mock chart for test environment', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const sheet = spreadsheet.insertSheet('Dashboard');

      const repoDataList: RepositoryLatestData[] = [
        {
          repository: 'owner/repo1',
          latestDate: '2024-01-01',
          deploymentFrequency: '1.5',
          leadTimeHours: 24.5,
          changeFailureRate: 5.0,
          mttrHours: 3.2,
          cycleTimeHours: 48.0,
          codingTimeHours: null,
          timeToFirstReviewHours: null,
          reviewDurationHours: null,
          avgLinesOfCode: null,
          avgAdditionalCommits: null,
          avgForcePushCount: null,
        },
      ];

      addDeploymentFrequencyBarChart(sheet, repoDataList);

      const charts = sheet.getCharts();
      expect(charts.length).toBe(1);
    });
  });

  describe('addLeadTimeBarChart', () => {
    it('should add mock chart for test environment', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const sheet = spreadsheet.insertSheet('Dashboard');

      const repoDataList: RepositoryLatestData[] = [
        {
          repository: 'owner/repo1',
          latestDate: '2024-01-01',
          deploymentFrequency: '1.5',
          leadTimeHours: 24.5,
          changeFailureRate: 5.0,
          mttrHours: 3.2,
          cycleTimeHours: 48.0,
          codingTimeHours: null,
          timeToFirstReviewHours: null,
          reviewDurationHours: null,
          avgLinesOfCode: null,
          avgAdditionalCommits: null,
          avgForcePushCount: null,
        },
      ];

      addLeadTimeBarChart(sheet, repoDataList);

      const charts = sheet.getCharts();
      expect(charts.length).toBe(1);
    });
  });

  describe('addChangeFailureRateBarChart', () => {
    it('should add mock chart for test environment', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const sheet = spreadsheet.insertSheet('Dashboard');

      const repoDataList: RepositoryLatestData[] = [
        {
          repository: 'owner/repo1',
          latestDate: '2024-01-01',
          deploymentFrequency: '1.5',
          leadTimeHours: 24.5,
          changeFailureRate: 5.0,
          mttrHours: 3.2,
          cycleTimeHours: 48.0,
          codingTimeHours: null,
          timeToFirstReviewHours: null,
          reviewDurationHours: null,
          avgLinesOfCode: null,
          avgAdditionalCommits: null,
          avgForcePushCount: null,
        },
      ];

      addChangeFailureRateBarChart(sheet, repoDataList);

      const charts = sheet.getCharts();
      expect(charts.length).toBe(1);
    });
  });

  describe('addCycleTimeBarChart', () => {
    it('should skip when all cycle times are null', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const sheet = spreadsheet.insertSheet('Dashboard');

      const repoDataList: RepositoryLatestData[] = [
        {
          repository: 'owner/repo1',
          latestDate: '2024-01-01',
          deploymentFrequency: '1.5',
          leadTimeHours: 24.5,
          changeFailureRate: 5.0,
          mttrHours: 3.2,
          cycleTimeHours: null, // null
          codingTimeHours: null,
          timeToFirstReviewHours: null,
          reviewDurationHours: null,
          avgLinesOfCode: null,
          avgAdditionalCommits: null,
          avgForcePushCount: null,
        },
      ];

      addCycleTimeBarChart(sheet, repoDataList);

      const charts = sheet.getCharts();
      expect(charts.length).toBe(0);
    });

    it('should add mock chart when cycle time is available', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const sheet = spreadsheet.insertSheet('Dashboard');

      const repoDataList: RepositoryLatestData[] = [
        {
          repository: 'owner/repo1',
          latestDate: '2024-01-01',
          deploymentFrequency: '1.5',
          leadTimeHours: 24.5,
          changeFailureRate: 5.0,
          mttrHours: 3.2,
          cycleTimeHours: 48.0,
          codingTimeHours: null,
          timeToFirstReviewHours: null,
          reviewDurationHours: null,
          avgLinesOfCode: null,
          avgAdditionalCommits: null,
          avgForcePushCount: null,
        },
      ];

      addCycleTimeBarChart(sheet, repoDataList);

      const charts = sheet.getCharts();
      expect(charts.length).toBe(1);
    });
  });

  describe('addAllDashboardCharts', () => {
    it('should add all repository comparison charts', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const sheet = spreadsheet.insertSheet('Dashboard');

      const repoDataList: RepositoryLatestData[] = [
        {
          repository: 'owner/repo1',
          latestDate: '2024-01-01',
          deploymentFrequency: '1.5',
          leadTimeHours: 24.5,
          changeFailureRate: 5.0,
          mttrHours: 3.2,
          cycleTimeHours: 48.0,
          codingTimeHours: null,
          timeToFirstReviewHours: null,
          reviewDurationHours: null,
          avgLinesOfCode: null,
          avgAdditionalCommits: null,
          avgForcePushCount: null,
        },
        {
          repository: 'owner/repo2',
          latestDate: '2024-01-01',
          deploymentFrequency: '2.0',
          leadTimeHours: 20.0,
          changeFailureRate: 3.0,
          mttrHours: 2.5,
          cycleTimeHours: 40.0,
          codingTimeHours: null,
          timeToFirstReviewHours: null,
          reviewDurationHours: null,
          avgLinesOfCode: null,
          avgAdditionalCommits: null,
          avgForcePushCount: null,
        },
      ];

      addAllDashboardCharts(sheet, repoDataList);

      // デプロイ頻度、リードタイム、変更障害率、サイクルタイムの4つ
      const charts = sheet.getCharts();
      expect(charts.length).toBe(4);
    });
  });

  describe('addTrendCharts', () => {
    it('should add trend line chart', () => {
      const spreadsheet = mockContainer.spreadsheetClient.openById(
        mockContainer.spreadsheetId
      ) as MockSpreadsheet;
      const sheet = spreadsheet.insertSheet('Trend Sheet');

      const trends: WeeklyTrendData[] = [
        {
          week: '2024-W01',
          totalDeployments: 10,
          avgLeadTimeHours: 24.5,
          avgChangeFailureRate: 5.0,
          avgCycleTimeHours: 48.0,
        },
      ];

      addTrendCharts(sheet, trends);

      const charts = sheet.getCharts();
      expect(charts.length).toBe(1);
    });
  });
});
