/**
 * Slack Webhook クライアント
 *
 * Slack Incoming Webhooksを使用してメッセージを送信
 */

import { CONFIG_KEYS } from '../../config/propertyKeys';
import { getContainer } from '../../container';
import type { HttpClient, SlackClient, SlackMessage } from '../../interfaces';

/**
 * Slack Webhook URLを取得
 */
function getSlackWebhookUrl(): string | null {
  const { storageClient } = getContainer();
  return storageClient.getProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL);
}

/**
 * Slack通知が有効かチェック
 */
export function isSlackNotificationEnabled(): boolean {
  return getSlackWebhookUrl() !== null;
}

/**
 * GAS SlackClient実装
 */
export class GasSlackClient implements SlackClient {
  private httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  sendMessage(message: SlackMessage): void {
    const webhookUrl = getSlackWebhookUrl();
    if (!webhookUrl) {
      const { logger } = getContainer();
      logger.warn('Slack Webhook URL not configured. Skipping notification.');
      return;
    }

    const { logger } = getContainer();

    try {
      const response = this.httpClient.fetch(webhookUrl, {
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
        },
        payload: JSON.stringify(message),
        muteHttpExceptions: true,
      });

      if (response.statusCode !== 200) {
        logger.warn(`Slack notification failed: ${response.statusCode} - ${response.content}`);
      } else {
        logger.debug('Slack notification sent successfully');
      }
    } catch (error) {
      logger.error(`Failed to send Slack notification: ${String(error)}`);
    }
  }
}
