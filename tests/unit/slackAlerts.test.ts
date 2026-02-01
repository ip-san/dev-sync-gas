/**
 * Slackアラート通知機能のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { initializeContainer, resetContainer } from '../../src/container';
import { createMockContainer, MockSlackClient } from '../mocks';
import {
  checkAndSendAlerts,
  setupAlertTrigger,
  removeAlertTrigger,
  showAlertTrigger,
} from '../../src/functions/slackAlerts';
import { detectAlerts, createAlertMessage, type Alert } from '../../src/services/slack/alerts';
import { isSlackNotificationEnabled } from '../../src/services/slack/client';
import { CONFIG_KEYS } from '../../src/config/propertyKeys';
import type { DevOpsMetrics } from '../../src/types';

describe('Slack Alerts', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    initializeContainer(mockContainer);
  });

  afterEach(() => {
    resetContainer();
  });

  describe('detectAlerts', () => {
    it('should detect no alerts when all metrics are within normal ranges', () => {
      const metrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '5.0', // Good
          leadTimeForChangesHours: 10.0, // Good
          changeFailureRate: 3.0, // Good
          meanTimeToRecoveryHours: 1.0,
          cycleTimeHours: 30.0, // Good
          codingTimeHours: 8.0,
          timeToFirstReviewHours: 2.0,
          reviewDurationHours: 4.0,
          avgLinesOfCode: 100,
          avgAdditionalCommits: 0.5,
          avgForcePushCount: 0.1,
        },
      ];

      const alerts = detectAlerts(metrics);
      expect(alerts.length).toBe(0);
    });

    it('should detect critical alert for high lead time', () => {
      const metrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '2.0',
          leadTimeForChangesHours: 400.0, // Critical (> 336 = 168*2)
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 2.0,
          cycleTimeHours: 50.0,
          codingTimeHours: 10.0,
          timeToFirstReviewHours: 3.0,
          reviewDurationHours: 5.0,
          avgLinesOfCode: 150,
          avgAdditionalCommits: 0.5,
          avgForcePushCount: 0.2,
        },
      ];

      const alerts = detectAlerts(metrics);
      expect(alerts.length).toBeGreaterThan(0);

      const leadTimeAlert = alerts.find((a) => a.type === 'high_lead_time');
      expect(leadTimeAlert).toBeDefined();
      expect(leadTimeAlert?.severity).toBe('critical');
      expect(leadTimeAlert?.repository).toBe('owner/repo1');
    });

    it('should detect warning alert for moderately high lead time', () => {
      const metrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '2.0',
          leadTimeForChangesHours: 200.0, // Warning (> 168)
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 2.0,
          cycleTimeHours: 50.0,
          codingTimeHours: 10.0,
          timeToFirstReviewHours: 3.0,
          reviewDurationHours: 5.0,
          avgLinesOfCode: 150,
          avgAdditionalCommits: 0.5,
          avgForcePushCount: 0.2,
        },
      ];

      const alerts = detectAlerts(metrics);

      const leadTimeAlert = alerts.find((a) => a.type === 'high_lead_time');
      expect(leadTimeAlert).toBeDefined();
      expect(leadTimeAlert?.severity).toBe('warning');
    });

    it('should detect critical alert for high failure rate', () => {
      const metrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '2.0',
          leadTimeForChangesHours: 24.0,
          changeFailureRate: 25.0, // Critical (> 22.5 = 15*1.5)
          meanTimeToRecoveryHours: 2.0,
          cycleTimeHours: 50.0,
          codingTimeHours: 10.0,
          timeToFirstReviewHours: 3.0,
          reviewDurationHours: 5.0,
          avgLinesOfCode: 150,
          avgAdditionalCommits: 0.5,
          avgForcePushCount: 0.2,
        },
      ];

      const alerts = detectAlerts(metrics);

      const failureRateAlert = alerts.find((a) => a.type === 'high_failure_rate');
      expect(failureRateAlert).toBeDefined();
      expect(failureRateAlert?.severity).toBe('critical');
    });

    it('should detect warning alert for low deployment frequency', () => {
      const metrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '0.7', // Warning (< 1.0)
          leadTimeForChangesHours: 24.0,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 2.0,
          cycleTimeHours: 50.0,
          codingTimeHours: 10.0,
          timeToFirstReviewHours: 3.0,
          reviewDurationHours: 5.0,
          avgLinesOfCode: 150,
          avgAdditionalCommits: 0.5,
          avgForcePushCount: 0.2,
        },
      ];

      const alerts = detectAlerts(metrics);

      const deploymentFreqAlert = alerts.find((a) => a.type === 'low_deployment_frequency');
      expect(deploymentFreqAlert).toBeDefined();
      expect(deploymentFreqAlert?.severity).toBe('warning');
    });

    it('should detect critical alert for very low deployment frequency', () => {
      const metrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '0.3', // Critical (< 0.5)
          leadTimeForChangesHours: 24.0,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 2.0,
          cycleTimeHours: 50.0,
          codingTimeHours: 10.0,
          timeToFirstReviewHours: 3.0,
          reviewDurationHours: 5.0,
          avgLinesOfCode: 150,
          avgAdditionalCommits: 0.5,
          avgForcePushCount: 0.2,
        },
      ];

      const alerts = detectAlerts(metrics);

      const deploymentFreqAlert = alerts.find((a) => a.type === 'low_deployment_frequency');
      expect(deploymentFreqAlert).toBeDefined();
      expect(deploymentFreqAlert?.severity).toBe('critical');
    });

    it('should detect multiple alerts for a single repository', () => {
      const metrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '0.3', // Critical
          leadTimeForChangesHours: 400.0, // Critical (> 336)
          changeFailureRate: 25.0, // Critical (> 22.5)
          meanTimeToRecoveryHours: 2.0,
          cycleTimeHours: 300.0,
          codingTimeHours: 10.0,
          timeToFirstReviewHours: 3.0,
          reviewDurationHours: 5.0,
          avgLinesOfCode: 150,
          avgAdditionalCommits: 0.5,
          avgForcePushCount: 0.2,
        },
      ];

      const alerts = detectAlerts(metrics);
      expect(alerts.length).toBeGreaterThan(2); // At least 3 alerts (deployment, lead time, failure rate)
      expect(alerts.every((a) => a.repository === 'owner/repo1')).toBe(true);
    });

    it('should detect alerts across multiple repositories', () => {
      const metrics: DevOpsMetrics[] = [
        {
          repository: 'owner/repo1',
          date: '2024-01-15',
          deploymentFrequency: '0.3',
          leadTimeForChangesHours: 200.0,
          changeFailureRate: 5.0,
          meanTimeToRecoveryHours: 2.0,
          cycleTimeHours: 50.0,
          codingTimeHours: 10.0,
          timeToFirstReviewHours: 3.0,
          reviewDurationHours: 5.0,
          avgLinesOfCode: 150,
          avgAdditionalCommits: 0.5,
          avgForcePushCount: 0.2,
        },
        {
          repository: 'owner/repo2',
          date: '2024-01-15',
          deploymentFrequency: '2.0',
          leadTimeForChangesHours: 24.0,
          changeFailureRate: 20.0, // Warning (> 15)
          meanTimeToRecoveryHours: 2.0,
          cycleTimeHours: 50.0,
          codingTimeHours: 10.0,
          timeToFirstReviewHours: 3.0,
          reviewDurationHours: 5.0,
          avgLinesOfCode: 150,
          avgAdditionalCommits: 0.5,
          avgForcePushCount: 0.2,
        },
      ];

      const alerts = detectAlerts(metrics);
      expect(alerts.length).toBeGreaterThan(0);

      const repo1Alerts = alerts.filter((a) => a.repository === 'owner/repo1');
      const repo2Alerts = alerts.filter((a) => a.repository === 'owner/repo2');

      expect(repo1Alerts.length).toBeGreaterThan(0);
      expect(repo2Alerts.length).toBeGreaterThan(0);
    });
  });

  describe('createAlertMessage', () => {
    it('should create message when no alerts', () => {
      const message = createAlertMessage([], 'https://example.com/spreadsheet');

      expect(message.text).toContain('No issues detected');
      expect(message.blocks).toBeDefined();
      expect(message.blocks?.length).toBeGreaterThan(0);
    });

    it('should create message with critical alerts', () => {
      const alerts: Alert[] = [
        {
          type: 'high_lead_time',
          repository: 'owner/repo1',
          metric: 'リードタイム',
          value: '200.0時間',
          threshold: '168時間',
          severity: 'critical',
        },
      ];

      const message = createAlertMessage(alerts, 'https://docs.google.com/spreadsheets/d/test-id');

      expect(message.text).toContain('1件のアラート検出');
      expect(message.blocks).toBeDefined();

      const blocks = message.blocks!;

      // Should contain Critical Alerts section
      const criticalSection = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes(':rotating_light: Critical Alerts')
      );
      expect(criticalSection).toBeDefined();
    });

    it('should create message with warning alerts', () => {
      const alerts: Alert[] = [
        {
          type: 'high_lead_time',
          repository: 'owner/repo1',
          metric: 'リードタイム',
          value: '50.0時間',
          threshold: '48時間',
          severity: 'warning',
        },
      ];

      const message = createAlertMessage(alerts, 'https://docs.google.com/spreadsheets/d/test-id');

      expect(message.text).toContain('1件のアラート検出');

      const blocks = message.blocks!;

      // Should contain Warning Alerts section
      const warningSection = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes(':warning: Warning Alerts')
      );
      expect(warningSection).toBeDefined();
    });

    it('should separate critical and warning alerts', () => {
      const alerts: Alert[] = [
        {
          type: 'high_lead_time',
          repository: 'owner/repo1',
          metric: 'リードタイム',
          value: '200.0時間',
          threshold: '168時間',
          severity: 'critical',
        },
        {
          type: 'high_failure_rate',
          repository: 'owner/repo2',
          metric: '変更障害率',
          value: '8.0%',
          threshold: '5%',
          severity: 'warning',
        },
      ];

      const message = createAlertMessage(alerts, 'https://docs.google.com/spreadsheets/d/test-id');

      expect(message.text).toContain('2件のアラート検出');

      const blocks = message.blocks!;
      const headerBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('検出されたアラート')
      );
      expect(headerBlock?.text?.text).toContain('1件（Critical）');
      expect(headerBlock?.text?.text).toContain('1件（Warning）');
    });

    it('should include spreadsheet URL in action button', () => {
      const alerts: Alert[] = [
        {
          type: 'high_lead_time',
          repository: 'owner/repo1',
          metric: 'リードタイム',
          value: '200.0時間',
          threshold: '168時間',
          severity: 'critical',
        },
      ];

      const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/test-spreadsheet-id';
      const message = createAlertMessage(alerts, spreadsheetUrl);

      const actionsBlock = message.blocks?.find((b) => b.type === 'actions');
      expect(actionsBlock).toBeDefined();
      expect(actionsBlock?.elements).toBeDefined();

      const button = actionsBlock?.elements?.[0] as { url?: string };
      expect(button?.url).toBe(spreadsheetUrl);
    });
  });

  describe('setupAlertTrigger', () => {
    it('should create daily trigger at 10am', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupAlertTrigger();

      const triggers = mockContainer.triggerClient.getProjectTriggers();
      expect(triggers.length).toBe(1);
      expect(triggers[0].getHandlerFunction()).toBe('checkAndSendAlerts');
    });

    it('should delete existing trigger before creating new one', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupAlertTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(1);

      setupAlertTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(1);
    });

    it('should warn if Slack webhook is not configured', () => {
      setupAlertTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(logs.some((log: string) => log.includes('Slack Webhook URL is not configured'))).toBe(
        true
      );
    });
  });

  describe('removeAlertTrigger', () => {
    it('should remove alert trigger', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupAlertTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(1);

      removeAlertTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(0);
    });

    it('should log info when no trigger exists', () => {
      removeAlertTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(logs.some((log: string) => log.includes('No alert trigger found to remove'))).toBe(
        true
      );
    });
  });

  describe('showAlertTrigger', () => {
    it('should display trigger information when exists', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupAlertTrigger();
      showAlertTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(logs.some((log: string) => log.includes('Alert trigger is set up'))).toBe(true);
    });

    it('should display message when no trigger exists', () => {
      showAlertTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(logs.some((log: string) => log.includes('No alert trigger found'))).toBe(true);
    });
  });
});
