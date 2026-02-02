/**
 * Slack月次レポート機能のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { initializeContainer, resetContainer } from '../../src/container';
import { createMockContainer, MockSlackClient } from '../mocks';
import {
  sendMonthlyReport,
  setupMonthlyReportTrigger,
  removeMonthlyReportTrigger,
  showMonthlyReportTrigger,
} from '../../src/functions/slackMonthly';
import { createMonthlyReportMessage } from '../../src/services/slack/monthlyReport';
import { isSlackNotificationEnabled } from '../../src/services/slack/client';
import { CONFIG_KEYS } from '../../src/config/propertyKeys';
import type { DevOpsMetrics } from '../../src/types';

describe('Slack Monthly Report', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    initializeContainer(mockContainer);
  });

  afterEach(() => {
    resetContainer();
  });

  describe('createMonthlyReportMessage', () => {
    it('should create message with no data', () => {
      const message = createMonthlyReportMessage([], [], 'https://example.com/spreadsheet');

      expect(message.text).toContain('月次レポート - データなし');
      expect(message.blocks).toBeDefined();
      expect(message.blocks?.length).toBeGreaterThan(0);
    });

    it('should create message with current month metrics only', () => {
      const currentMonthMetrics: DevOpsMetrics[] = [
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

      const message = createMonthlyReportMessage(
        currentMonthMetrics,
        [],
        'https://docs.google.com/spreadsheets/d/test-id'
      );

      expect(message.text).toContain('月次レポート');
      expect(message.blocks).toBeDefined();

      const blocks = message.blocks!;
      expect(blocks.length).toBeGreaterThan(0);

      // Header block
      expect(blocks[0].type).toBe('header');
      expect(blocks[0].text?.text).toContain('月次レポート');

      // Section block with status
      expect(blocks[1].type).toBe('section');
      expect(blocks[1].text?.text).toContain('総合ステータス');

      // Divider block
      expect(blocks[2].type).toBe('divider');

      // Section block with metrics header
      expect(blocks[3].type).toBe('section');
      expect(blocks[3].text?.text).toContain('今月の指標');

      // Section block with metrics fields
      expect(blocks[4].type).toBe('section');
      expect(blocks[4].fields).toBeDefined();
      expect(blocks[4].fields?.length).toBe(4);
    });

    it('should show month-over-month comparison when previous month data exists', () => {
      const currentMonthMetrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-02-15',
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

      const previousMonthMetrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
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

      const message = createMonthlyReportMessage(
        currentMonthMetrics,
        previousMonthMetrics,
        'https://docs.google.com/spreadsheets/d/test-id'
      );

      expect(message.text).toContain('月次レポート');

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

    it('should handle null values in metrics', () => {
      const currentMonthMetrics: DevOpsMetrics[] = [
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

      const message = createMonthlyReportMessage(
        currentMonthMetrics,
        [],
        'https://docs.google.com/spreadsheets/d/test-id'
      );

      expect(message.text).toContain('月次レポート');

      const metricsBlock = message.blocks?.find(
        (b) => b.type === 'section' && b.fields !== undefined
      );
      expect(metricsBlock).toBeDefined();

      const fieldTexts = metricsBlock?.fields?.map((f) => f.text).join(' ') ?? '';
      expect(fieldTexts).toContain('N/A');
    });

    it('should include spreadsheet URL in action button', () => {
      const currentMonthMetrics: DevOpsMetrics[] = [
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
      const message = createMonthlyReportMessage(currentMonthMetrics, [], spreadsheetUrl);

      const actionsBlock = message.blocks?.find((b) => b.type === 'actions');
      expect(actionsBlock).toBeDefined();
      expect(actionsBlock?.elements).toBeDefined();

      const button = actionsBlock?.elements?.[0] as {
        url?: string;
      };
      expect(button?.url).toBe(spreadsheetUrl);
    });
  });

  describe('setupMonthlyReportTrigger', () => {
    it('should create daily trigger for 9am', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupMonthlyReportTrigger();

      const triggers = mockContainer.triggerClient.getProjectTriggers();
      expect(triggers.length).toBe(1);
      expect(triggers[0].getHandlerFunction()).toBe('sendMonthlyReport');
    });

    it('should delete existing trigger before creating new one', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      // Create first trigger
      setupMonthlyReportTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(1);

      // Create second trigger - should replace first
      setupMonthlyReportTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(1);
    });

    it('should warn if Slack webhook is not configured', () => {
      setupMonthlyReportTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(logs.some((log: string) => log.includes('Slack Webhook URL is not configured'))).toBe(
        true
      );
    });
  });

  describe('removeMonthlyReportTrigger', () => {
    it('should remove monthly report trigger', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupMonthlyReportTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(1);

      removeMonthlyReportTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(0);
    });

    it('should log info when no trigger exists', () => {
      removeMonthlyReportTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(
        logs.some((log: string) => log.includes('No monthly report trigger found to remove'))
      ).toBe(true);
    });
  });

  describe('showMonthlyReportTrigger', () => {
    it('should display trigger information when exists', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupMonthlyReportTrigger();
      showMonthlyReportTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(logs.some((log: string) => log.includes('Monthly report trigger is set up'))).toBe(
        true
      );
    });

    it('should display message when no trigger exists', () => {
      showMonthlyReportTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(logs.some((log: string) => log.includes('No monthly report trigger found'))).toBe(
        true
      );
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
