/**
 * Slack アラート通知機能
 */

import { getConfig } from '../config/settings';
import { getContainer } from '../container';
import { createAlertMessage, detectAlerts } from '../services/slack/alerts';
import { isSlackNotificationEnabled } from '../services/slack/client';
import { readMetricsFromAllRepositorySheets } from '../services/spreadsheet/repositorySheet';

/**
 * 最新のメトリクスをチェックしてアラートを送信
 *
 * 各リポジトリの最新メトリクスが閾値を超えている場合にアラートを送信します。
 */
export function checkAndSendAlerts(): void {
  const { logger, slackClient } = getContainer();

  if (!isSlackNotificationEnabled()) {
    logger.warn('Slack Webhook URL not configured. Skipping alert check.');
    return;
  }

  try {
    const config = getConfig();
    const spreadsheet = config.spreadsheet;

    // 全リポジトリのメトリクスを収集
    const repositories = config.github.repositories.map((repo) => `${repo.owner}/${repo.name}`);
    const allMetrics = readMetricsFromAllRepositorySheets(spreadsheet.id, repositories);

    if (allMetrics.length === 0) {
      logger.warn('No metrics found for alert check');
      return;
    }

    // 各リポジトリの最新メトリクスのみを抽出
    const latestMetricsByRepo = new Map<string, (typeof allMetrics)[0]>();
    for (const metric of allMetrics) {
      const existing = latestMetricsByRepo.get(metric.repository);
      if (!existing || metric.date > existing.date) {
        latestMetricsByRepo.set(metric.repository, metric);
      }
    }

    const latestMetrics = Array.from(latestMetricsByRepo.values());

    // アラートを検出
    const alerts = detectAlerts(latestMetrics);

    if (alerts.length === 0) {
      logger.info('No alerts detected - all metrics within normal ranges');
      return;
    }

    // アラートメッセージを生成
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheet.id}`;
    const message = createAlertMessage(alerts, spreadsheetUrl);

    // Slackに送信
    slackClient.sendMessage(message);
    logger.info(
      `⚠️ Slack alert sent: ${alerts.filter((a) => a.severity === 'critical').length} critical, ${alerts.filter((a) => a.severity === 'warning').length} warnings`
    );
  } catch (error) {
    logger.error(`Failed to check and send alerts: ${String(error)}`);
    throw error;
  }
}

/**
 * アラートチェック用のトリガーを設定
 *
 * 毎日午前10時にアラートチェックを実行
 */
export function setupAlertTrigger(): void {
  const { triggerClient, logger } = getContainer();

  if (!isSlackNotificationEnabled()) {
    logger.warn('Slack Webhook URL is not configured. Please configure it first.');
    return;
  }

  // 既存のトリガーを削除
  const triggers = triggerClient.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'checkAndSendAlerts') {
      triggerClient.deleteTrigger(trigger);
      logger.info('Deleted existing alert trigger');
    }
  }

  // 新しいトリガーを作成（毎日10時）
  triggerClient.newTrigger('checkAndSendAlerts').timeBased().everyDays(1).atHour(10).create();

  logger.info('✅ Alert trigger set up successfully (Every day at 10:00)');
}

/**
 * アラートトリガーを削除
 */
export function removeAlertTrigger(): void {
  const { triggerClient, logger } = getContainer();

  const triggers = triggerClient.getProjectTriggers();
  let removed = false;

  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'checkAndSendAlerts') {
      triggerClient.deleteTrigger(trigger);
      removed = true;
    }
  }

  if (removed) {
    logger.info('🗑️ Alert trigger removed');
  } else {
    logger.info('No alert trigger found to remove');
  }
}
