/**
 * Slackインシデント日次サマリー送信機能
 *
 * リアルタイム通知は他ツール（PagerDuty/OpsGenie等）が担当。
 * 本機能は振り返り用の日次サマリーのみ提供。
 */

import { getConfig } from '../config/settings';
import { isSlackNotificationEnabled } from '../services/slack/client';
import {
  createIncidentDailySummaryMessage,
  isIncident,
  toIncidentIssue,
  type IncidentEvent,
} from '../services/slack/incidents';
import { getIssuesGraphQL } from '../services/github/graphql/issues';
import { getContainer } from '../container';

/**
 * 今日のインシデント一覧をチェックして日次サマリーを送信
 */
export function sendIncidentDailySummary(): void {
  const { logger, slackClient } = getContainer();

  if (!isSlackNotificationEnabled()) {
    logger.warn('Slack Webhook URL not configured. Skipping incident daily summary.');
    return;
  }

  try {
    const config = getConfig();
    const spreadsheet = config.spreadsheet;

    // 今日の日付範囲
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = today.toISOString();
    const tomorrowStr = tomorrow.toISOString();

    // 全リポジトリのインシデントを収集
    const incidents: IncidentEvent[] = [];

    for (const repo of config.github.repositories) {
      const repository = `${repo.owner}/${repo.name}`;

      // Issueを取得
      const response = getIssuesGraphQL(repo, config.github.token ?? '');
      if (!response.success || !response.data) {
        logger.warn(`Failed to fetch issues for ${repository}`);
        continue;
      }

      for (const githubIssue of response.data) {
        const incidentIssue = toIncidentIssue(githubIssue, repo.owner, repo.name);

        // インシデントラベルがないものはスキップ
        if (!isIncident(incidentIssue.labels)) {
          continue;
        }

        // 今日作成されたインシデント
        if (
          incidentIssue.createdAt &&
          incidentIssue.createdAt >= todayStr &&
          incidentIssue.createdAt < tomorrowStr
        ) {
          incidents.push({
            issue: incidentIssue,
            eventType: 'opened',
            repository,
            detectionTime: new Date(incidentIssue.createdAt),
          });
        }

        // 今日クローズされたインシデント
        if (
          incidentIssue.state === 'closed' &&
          incidentIssue.closedAt &&
          incidentIssue.closedAt >= todayStr &&
          incidentIssue.closedAt < tomorrowStr
        ) {
          incidents.push({
            issue: incidentIssue,
            eventType: 'closed',
            repository,
            detectionTime: new Date(incidentIssue.closedAt),
          });
        }
      }
    }

    if (incidents.length === 0) {
      logger.info('No incidents today. Skipping daily summary.');
      return;
    }

    // 日次サマリーメッセージを生成
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheet.id}`;
    const message = createIncidentDailySummaryMessage(incidents, today, spreadsheetUrl);

    // Slackに送信
    slackClient.sendMessage(message);
    logger.info(`📢 Slack incident daily summary sent: ${incidents.length} incidents`);
  } catch (error) {
    logger.error(`Failed to send Slack incident daily summary: ${String(error)}`);
    throw error;
  }
}

/**
 * インシデント日次サマリー用のトリガーを設定
 *
 * 毎日18時に実行
 */
export function setupIncidentDailySummaryTrigger(): void {
  const { triggerClient, logger } = getContainer();

  if (!isSlackNotificationEnabled()) {
    logger.warn('Slack Webhook URL is not configured. Please configure it first.');
    return;
  }

  // 既存のトリガーを削除
  const triggers = triggerClient.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'sendIncidentDailySummary') {
      triggerClient.deleteTrigger(trigger);
      logger.info('Deleted existing incident daily summary trigger');
    }
  }

  // 新しいトリガーを作成（毎日18:00）
  triggerClient.newTrigger('sendIncidentDailySummary').timeBased().everyDays(1).atHour(18).create();

  logger.info('✅ Incident daily summary trigger set up successfully (Every day at 18:00)');
}

/**
 * インシデント日次サマリー用のトリガーを削除
 */
export function removeIncidentDailySummaryTrigger(): void {
  const { triggerClient, logger } = getContainer();

  const triggers = triggerClient.getProjectTriggers();
  let removed = false;

  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'sendIncidentDailySummary') {
      triggerClient.deleteTrigger(trigger);
      removed = true;
    }
  }

  if (removed) {
    logger.info('🗑️ Incident daily summary trigger removed');
  } else {
    logger.info('No incident daily summary trigger found to remove');
  }
}

/**
 * インシデント日次サマリートリガーの状態を表示
 */
export function showIncidentDailySummaryTrigger(): void {
  const { triggerClient, logger } = getContainer();

  const triggers = triggerClient.getProjectTriggers();
  const incidentTriggers = triggers.filter(
    (t) => t.getHandlerFunction() === 'sendIncidentDailySummary'
  );

  if (incidentTriggers.length > 0) {
    logger.log('Incident daily summary trigger is set up (Every day at 18:00)');
  } else {
    logger.log('No incident daily summary trigger found');
  }
}
