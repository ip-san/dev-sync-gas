/**
 * Slackインシデント日次サマリー機能のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { initializeContainer, resetContainer } from '../../src/container';
import { createMockContainer } from '../mocks';
import {
  createIncidentDailySummaryMessage,
  isIncident,
  type IncidentEvent,
} from '../../src/services/slack/incidents';
import {
  setupIncidentDailySummaryTrigger,
  removeIncidentDailySummaryTrigger,
  showIncidentDailySummaryTrigger,
} from '../../src/functions/slackIncidents';
import { isSlackNotificationEnabled } from '../../src/services/slack/client';
import { CONFIG_KEYS } from '../../src/config/propertyKeys';
import type { IncidentIssue } from '../../src/services/slack/incidents';

describe('Slack Incident Daily Summary', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    initializeContainer(mockContainer);
  });

  afterEach(() => {
    resetContainer();
  });

  describe('isIncident', () => {
    it('should return true when issue has incident label', () => {
      const issue: IncidentIssue = {
        number: 123,
        title: 'Production outage',
        state: 'open',
        user: { login: 'user1' },
        labels: ['incident', 'critical'],
        url: 'https://github.com/owner/repo/issues/123',
        createdAt: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        body: 'Service is down',
      };

      expect(isIncident(issue.labels)).toBe(true);
    });

    it('should return false when issue has no incident label', () => {
      const issue: IncidentIssue = {
        number: 124,
        title: 'Feature request',
        state: 'open',
        user: { login: 'user1' },
        labels: ['enhancement'],
        url: 'https://github.com/owner/repo/issues/124',
        createdAt: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };

      expect(isIncident(issue.labels)).toBe(false);
    });

    it('should be case-insensitive for incident label matching', () => {
      const issue: IncidentIssue = {
        number: 125,
        title: 'Bug',
        state: 'open',
        user: { login: 'user1' },
        labels: ['INCIDENT'],
        url: 'https://github.com/owner/repo/issues/125',
        createdAt: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };

      expect(isIncident(issue.labels)).toBe(true);
    });
  });

  describe('createIncidentDailySummaryMessage', () => {
    it('should create daily summary with opened and closed incidents', () => {
      const openedIncident: IncidentEvent = {
        issue: {
          number: 123,
          title: 'Database outage',
          state: 'open',
          user: { login: 'dev1' },
          labels: ['incident', 'critical'],
          url: 'https://github.com/owner/repo/issues/123',
          createdAt: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
        },
        eventType: 'opened',
        repository: 'owner/repo',
        detectionTime: new Date('2024-01-15T10:00:00Z'),
      };

      const closedIncident: IncidentEvent = {
        issue: {
          number: 120,
          title: 'API latency',
          state: 'closed',
          user: { login: 'dev2' },
          labels: ['incident'],
          url: 'https://github.com/owner/repo/issues/120',
          createdAt: '2024-01-14T10:00:00Z',
          updated_at: '2024-01-15T14:00:00Z',
          closedAt: '2024-01-15T14:00:00Z',
        },
        eventType: 'closed',
        repository: 'owner/repo',
        detectionTime: new Date('2024-01-15T14:00:00Z'),
      };

      const incidents = [openedIncident, closedIncident];
      const date = new Date('2024-01-15');
      const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/test-id';

      const message = createIncidentDailySummaryMessage(incidents, date, spreadsheetUrl);

      expect(message.text).toContain('インシデント日次サマリー');
      expect(message.text).toContain('発生 1件');
      expect(message.text).toContain('解決 1件');

      const blocks = message.blocks!;
      expect(blocks.length).toBeGreaterThan(0);

      // Header
      expect(blocks[0].type).toBe('header');
      expect(blocks[0].text?.text).toContain('インシデント日次サマリー');

      // Summary counts
      const summaryBlock = blocks.find(
        (b) =>
          b.type === 'section' &&
          b.fields?.some((f) => f.text?.includes('発生件数')) &&
          b.fields?.some((f) => f.text?.includes('解決件数'))
      );
      expect(summaryBlock).toBeDefined();
      expect(summaryBlock?.fields?.find((f) => f.text?.includes('発生件数'))?.text).toContain(
        '1件'
      );
      expect(summaryBlock?.fields?.find((f) => f.text?.includes('解決件数'))?.text).toContain(
        '1件'
      );

      // Opened incidents section
      const openedSectionBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('本日発生したインシデント')
      );
      expect(openedSectionBlock).toBeDefined();

      // Check severity emoji for critical incident
      const criticalIncidentBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('Database outage')
      );
      expect(criticalIncidentBlock?.text?.text).toContain(':rotating_light:');

      // Closed incidents section
      const closedSectionBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('本日解決したインシデント')
      );
      expect(closedSectionBlock).toBeDefined();

      // Check MTTR in closed incident
      const closedIncidentBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('API latency')
      );
      expect(closedIncidentBlock?.text?.text).toContain('MTTR:');

      // Spreadsheet button
      const actionsBlock = blocks.find((b) => b.type === 'actions');
      expect(actionsBlock).toBeDefined();
      const button = actionsBlock?.elements?.[0] as { url?: string };
      expect(button?.url).toBe(spreadsheetUrl);
    });

    it('should handle only opened incidents', () => {
      const openedIncident: IncidentEvent = {
        issue: {
          number: 123,
          title: 'New incident',
          state: 'open',
          user: { login: 'dev1' },
          labels: ['incident', 'p1', 'high'],
          url: 'https://github.com/owner/repo/issues/123',
          createdAt: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
        },
        eventType: 'opened',
        repository: 'owner/repo',
        detectionTime: new Date('2024-01-15T10:00:00Z'),
      };

      const message = createIncidentDailySummaryMessage(
        [openedIncident],
        new Date('2024-01-15'),
        'https://example.com'
      );

      expect(message.text).toContain('発生 1件');
      expect(message.text).toContain('解決 0件');

      const blocks = message.blocks!;
      const openedSection = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('本日発生したインシデント')
      );
      expect(openedSection).toBeDefined();

      // Check high severity emoji
      const highIncidentBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('New incident')
      );
      expect(highIncidentBlock?.text?.text).toContain(':warning:');

      // No closed section
      const closedSection = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('本日解決したインシデント')
      );
      expect(closedSection).toBeUndefined();
    });

    it('should handle only closed incidents', () => {
      const closedIncident: IncidentEvent = {
        issue: {
          number: 120,
          title: 'Resolved incident',
          state: 'closed',
          user: { login: 'dev1' },
          labels: ['incident'],
          url: 'https://github.com/owner/repo/issues/120',
          createdAt: '2024-01-14T10:00:00Z',
          updated_at: '2024-01-15T14:00:00Z',
          closedAt: '2024-01-15T14:00:00Z',
        },
        eventType: 'closed',
        repository: 'owner/repo',
        detectionTime: new Date('2024-01-15T14:00:00Z'),
      };

      const message = createIncidentDailySummaryMessage(
        [closedIncident],
        new Date('2024-01-15'),
        'https://example.com'
      );

      expect(message.text).toContain('発生 0件');
      expect(message.text).toContain('解決 1件');

      const blocks = message.blocks!;

      // No opened section
      const openedSection = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('本日発生したインシデント')
      );
      expect(openedSection).toBeUndefined();

      // Closed section exists
      const closedSection = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('本日解決したインシデント')
      );
      expect(closedSection).toBeDefined();

      // Check medium severity emoji (default)
      const mediumIncidentBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('Resolved incident')
      );
      expect(mediumIncidentBlock?.text?.text).toContain('MTTR:');
    });

    it('should handle MTTR calculation for closed incidents', () => {
      const closedIncident: IncidentEvent = {
        issue: {
          number: 120,
          title: 'Test incident',
          state: 'closed',
          user: { login: 'dev1' },
          labels: ['incident'],
          url: 'https://github.com/owner/repo/issues/120',
          createdAt: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T14:00:00Z',
          closedAt: '2024-01-15T14:00:00Z', // 4 hours later
        },
        eventType: 'closed',
        repository: 'owner/repo',
        detectionTime: new Date('2024-01-15T14:00:00Z'),
      };

      const message = createIncidentDailySummaryMessage(
        [closedIncident],
        new Date('2024-01-15'),
        'https://example.com'
      );

      const blocks = message.blocks!;
      const incidentBlock = blocks.find(
        (b) => b.type === 'section' && b.text?.text?.includes('Test incident')
      );

      expect(incidentBlock?.text?.text).toContain('MTTR: 4.0h');
    });
  });

  describe('setupIncidentDailySummaryTrigger', () => {
    it('should create daily trigger for 18:00', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupIncidentDailySummaryTrigger();

      const triggers = mockContainer.triggerClient.getProjectTriggers();
      expect(triggers.length).toBe(1);
      expect(triggers[0].getHandlerFunction()).toBe('sendIncidentDailySummary');
    });

    it('should delete existing trigger before creating new one', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupIncidentDailySummaryTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(1);

      setupIncidentDailySummaryTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(1);
    });

    it('should warn if Slack webhook is not configured', () => {
      setupIncidentDailySummaryTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(logs.some((log: string) => log.includes('Slack Webhook URL is not configured'))).toBe(
        true
      );
    });
  });

  describe('removeIncidentDailySummaryTrigger', () => {
    it('should remove incident daily summary trigger', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupIncidentDailySummaryTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(1);

      removeIncidentDailySummaryTrigger();
      expect(mockContainer.triggerClient.getProjectTriggers().length).toBe(0);
    });

    it('should log info when no trigger exists', () => {
      removeIncidentDailySummaryTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(
        logs.some((log: string) =>
          log.includes('No incident daily summary trigger found to remove')
        )
      ).toBe(true);
    });
  });

  describe('showIncidentDailySummaryTrigger', () => {
    it('should display trigger information when exists', () => {
      const webhookUrl = 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX';
      mockContainer.storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);

      setupIncidentDailySummaryTrigger();
      showIncidentDailySummaryTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(
        logs.some((log: string) => log.includes('Incident daily summary trigger is set up'))
      ).toBe(true);
    });

    it('should display message when no trigger exists', () => {
      showIncidentDailySummaryTrigger();

      const logs = (mockContainer.logger as any).logs;
      expect(
        logs.some((log: string) => log.includes('No incident daily summary trigger found'))
      ).toBe(true);
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
