/**
 * Slack通知設定関数
 *
 * Slack Webhook URLの設定・管理機能
 */

import { CONFIG_KEYS } from '../config/propertyKeys';
import { getContainer } from '../container';
import { ErrorCode, ValidationError } from '../utils/errors';

/**
 * Slack Webhook URLを設定
 *
 * @param webhookUrl - Slack Incoming Webhook URL
 */
export function configureSlackWebhook(webhookUrl: string): void {
  const { storageClient, logger } = getContainer();

  // バリデーション
  if (!webhookUrl || webhookUrl.trim() === '') {
    throw new ValidationError('Webhook URL cannot be empty', {
      code: ErrorCode.VALIDATION_FAILED,
    });
  }

  if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
    throw new ValidationError(
      'Invalid Slack Webhook URL format. Must start with "https://hooks.slack.com/"',
      {
        code: ErrorCode.VALIDATION_FAILED,
        context: { providedUrl: webhookUrl },
      }
    );
  }

  storageClient.setProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL, webhookUrl);
  logger.info('✅ Slack Webhook URL configured successfully');
}

/**
 * Slack Webhook URL設定を削除
 */
export function removeSlackWebhook(): void {
  const { storageClient, logger } = getContainer();

  storageClient.deleteProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL);
  logger.info('🗑️ Slack Webhook URL removed');
}

/**
 * 現在のSlack設定を表示
 */
export function showSlackConfig(): void {
  const { storageClient, logger } = getContainer();

  const webhookUrl = storageClient.getProperty(CONFIG_KEYS.SLACK.WEBHOOK_URL);

  if (webhookUrl) {
    // セキュリティのため、URLの一部のみ表示
    const maskedUrl = `${webhookUrl.substring(0, 30)}...`;
    logger.log(`📢 Slack通知: 有効 (${maskedUrl})`);
  } else {
    logger.log('📢 Slack通知: 無効（Webhook URLが未設定）');
  }
}
