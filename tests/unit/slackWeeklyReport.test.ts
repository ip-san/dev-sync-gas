/**
 * Slack週次レポート機能のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { initializeContainer, resetContainer } from '../../src/container';
import { createMockContainer, MockSlackClient } from '../mocks';
import {
  sendWeeklyReport,
  setupWeeklyReportTrigger,
  removeWeeklyReportTrigger,
  showWeeklyReportTrigger,
} from '../../src/functions/slackWeekly';
import { createWeeklyReportMessage } from '../../src/services/slack/weeklyReport';
import { isSlackNotificationEnabled } from '../../src/services/slack/client';
import { CONFIG_KEYS } from '../../src/config/propertyKeys';
import type { DevOpsMetrics, WeeklyTrendData } from '../../src/types';

describe('Slack Weekly Report', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    initializeContainer(mockContainer);
  });

  afterEach(() => {
    resetContainer();
  });

  describe('createWeeklyReportMessage', () => {
    it('should create message with no data', () => {
      const message = createWeeklyReportMessage([], [], [], 'https://example.com/spreadsheet');

      expect(message.text).toContain('週次レポート - データなし');
      expect(message.blocks).toBeDefined();
      expect(message.blocks?.length).toBeGreaterThan(0);
    });

    it('should create message with current week metrics only', () => {
      const currentWeekMetrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '2.5',
          leadTimeForChangesHours: 24.5,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 3.2,
          cycleTimeHours: 48.0,
          codingTimeHours: 12.0,
          timeToFirstReviewHours: 4.0,
          reviewDurationHours: 8.0,
          avgLinesOfCode: 150,
          avgAdditionalCommits: 0.8,
          avgForcePushCount: 0.2,
        },
      ];

      const message = createWeeklyReportMessage(
        currentWeekMetrics,
        [],
        [],
        'https://docs.google.com/spreadsheets/d/test-id'
      );

      expect(message.text).toContain('週次レポート');
      expect(message.blocks).toBeDefined();

      const blocks = message.blocks!;
      expect(blocks.length).toBeGreaterThan(0);

      // Header block
      expect(blocks[0].type).toBe('header');
      expect(blocks[0].text?.text).toContain('週次レポート');

      // Section block with status
      expect(blocks[1].type).toBe('section');
      expect(blocks[1].text?.text).toContain('総合ステータス');

      // Divider block
      expect(blocks[2].type).toBe('divider');

      // Section block with metrics header
      expect(blocks[3].type).toBe('section');
      expect(blocks[3].text?.text).toContain('今週の指標');

      // Section block with metrics fields
      expect(blocks[4].type).toBe('section');
      expect(blocks[4].fields).toBeDefined();
      expect(blocks[4].fields?.length).toBe(4);
    });

    it('should show week-over-week comparison when previous week data exists', () => {
      const currentWeekMetrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '3.0',
          leadTimeForChangesHours: 20.0,
          changeFailureRate: 4.0,
          meanTimeToRecoveryHours: 2.0,
          cycleTimeHours: 40.0,
          codingTimeHours: 10.0,
          timeToFirstReviewHours: 3.0,
          reviewDurationHours: 7.0,
          avgLinesOfCode: 120,
          avgAdditionalCommits: 0.5,
          avgForcePushCount: 0.1,
        },
      ];

      const previousWeekMetrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-08',
          deploymentFrequency: '2.0',
          leadTimeForChangesHours: 25.0,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 3.0,
          cycleTimeHours: 50.0,
          codingTimeHours: 12.0,
          timeToFirstReviewHours: 4.0,
          reviewDurationHours: 8.0,
          avgLinesOfCode: 150,
          avgAdditionalCommits: 0.8,
          avgForcePushCount: 0.2,
        },
      ];

      const message = createWeeklyReportMessage(
        currentWeekMetrics,
        previousWeekMetrics,
        [],
        'https://docs.google.com/spreadsheets/d/test-id'
      );

      expect(message.text).toContain('週次レポート');

      const metricsBlock = message.blocks?.find(
        (b) => b.type === 'section' && b.fields !== undefined && b.fields.length === 4
      );
      expect(metricsBlock).toBeDefined();

      const fieldTexts = metricsBlock?.fields?.map((f) => f.text).join(' ') ?? '';
      // Should contain Slack emoji trend indicators
      expect(fieldTexts).toMatch(
        /:(chart_with_upwards_trend|chart_with_downwards_trend|heavy_minus_sign):/
      );
    });

    it('should include weekly trends when provided', () => {
      const currentWeekMetrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '2.5',
          leadTimeForChangesHours: 24.5,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 3.2,
          cycleTimeHours: 48.0,
          codingTimeHours: 12.0,
          timeToFirstReviewHours: 4.0,
          reviewDurationHours: 8.0,
          avgLinesOfCode: 150,
          avgAdditionalCommits: 0.8,
          avgForcePushCount: 0.2,
        },
      ];

      const weeklyTrends: WeeklyTrendData[] = [
        {
          weekStart: '2024-01-01',
          weekEnd: '2024-01-07',
          avgDeploymentFrequency: 2.0,
          avgLeadTimeHours: 25.0,
          avgChangeFailureRate: 5.0,
          avgMeanTimeToRecoveryHours: 3.0,
          avgCycleTimeHours: 50.0,
        },
        {
          weekStart: '2024-01-08',
          weekEnd: '2024-01-14',
          avgDeploymentFrequency: 2.5,
          avgLeadTimeHours: 24.5,
          avgChangeFailureRate: 5.0,
          avgMeanTimeToRecoveryHours: 3.2,
          avgCycleTimeHours: 48.0,
        },
      ];

      const message = createWeeklyReportMessage(
        currentWeekMetrics,
        [],
        weeklyTrends,
        'https://docs.google.com/spreadsheets/d/test-id'
      );

      expect(message.blocks).toBeDefined();

      // Should have a context block with trend information
      const contextBlock = message.blocks?.find((b) => b.type === 'context');
      expect(contextBlock).toBeDefined();
    });

    it('should handle null values in metrics', () => {
      const currentWeekMetrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '2.0',
          leadTimeForChangesHours: null,
          changeFailureRate: null,
          meanTimeToRecoveryHours: null,
          cycleTimeHours: null,
          codingTimeHours: null,
          timeToFirstReviewHours: null,
          reviewDurationHours: null,
          avgLinesOfCode: null,
          avgAdditionalCommits: null,
          avgForcePushCount: null,
        },
      ];

      const message = createWeeklyReportMessage(
        currentWeekMetrics,
        [],
        [],
        'https://docs.google.com/spreadsheets/d/test-id'
      );

      expect(message.text).toContain('週次レポート');

      const metricsBlock = message.blocks?.find(
        (b) => b.type === 'section' && b.fields !== undefined
      );
      expect(metricsBlock).toBeDefined();

      const fieldTexts = metricsBlock?.fields?.map((f) => f.text).join(' ') ?? '';
      expect(fieldTexts).toContain('N/A');
    });

    it('should include spreadsheet URL in action button', () => {
      const currentWeekMetrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '2.0',
          leadTimeForChangesHours: 20.0,
          changeFailureRate: 4.0,
          meanTimeToRecoveryHours: 2.0,
          cycleTimeHours: 40.0,
          codingTimeHours: 10.0,
          timeToFirstReviewHours: 4.0,
          reviewDurationHours: 6.0,
          avgLinesOfCode: 150,
          avgAdditionalCommits: 0.5,
          avgForcePushCount: 0.2,
        },
      ];

      const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/test-spreadsheet-id';
      const message = createWeeklyReportMessage(currentWeekMetrics, [], [], spreadsheetUrl);

      const actionsBlock = message.blocks?.find((b) => b.type === 'actions');
      expect(actionsBlock).toBeDefined();
      expect(actionsBlock?.elements).toBeDefined();

      const button = actionsBlock?.elements?.[0] as {
        url?: string;
      };
      expect(button?.url).toBe(spreadsheetUrl);
    });
  });

  describe('setupWeeklyReportTrigger', () => {
    it('should create weekly trigger for Monday at 9am', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupWeeklyReportTrigger();

      const triggers = mockContainer.triggerClient.getProjectTriggers();
      expect(triggers.length).toBe(1);
      expect(triggers[0].getHandlerFunction()).toBe('sendWeeklyReport');
    });

    it('should delete existing trigger before creating new one', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      // Create first trigger
      setupWeeklyReportTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(1);

      // Create second trigger - should replace first
      setupWeeklyReportTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(1);
    });

    it('should warn if Slack webhook is not configured', () => {
      setupWeeklyReportTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(logs.some((log: string) => log.includes('Slack Webhook URL is not configured'))).toBe(
        true
      );
    });
  });

  describe('removeWeeklyReportTrigger', () => {
    it('should remove weekly report trigger', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupWeeklyReportTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(1);

      removeWeeklyReportTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(0);
    });

    it('should log info when no trigger exists', () => {
      removeWeeklyReportTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(
        logs.some((log: string) => log.includes('No weekly report trigger found to remove'))
      ).toBe(true);
    });
  });

  describe('showWeeklyReportTrigger', () => {
    it('should display trigger information when exists', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupWeeklyReportTrigger();
      showWeeklyReportTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(logs.some((log: string) => log.includes('Weekly report trigger is set up'))).toBe(
        true
      );
    });

    it('should display message when no trigger exists', () => {
      showWeeklyReportTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(logs.some((log: string) => log.includes('No weekly report trigger found'))).toBe(true);
    });
  });

  describe('isSlackNotificationEnabled', () => {
    it('should return true when webhook URL is configured', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      expect(isSlackNotificationEnabled()).toBe(true);
    });

    it('should return false when webhook URL is not configured', () => {
      expect(isSlackNotificationEnabled()).toBe(false);
    });
  });
});
