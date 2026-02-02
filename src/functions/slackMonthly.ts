/**
 * Slack月次レポート送信機能
 */

import { getConfig } from '../config/settings';
import type { DevOpsMetrics } from '../types';
import { createMonthlyReportMessage } from '../services/slack/monthlyReport';
import { isSlackNotificationEnabled } from '../services/slack/client';
import { readMetricsFromAllRepositorySheets } from '../services/spreadsheet/repositorySheet';
import { getContainer } from '../container';

/**
 * 月の開始日を取得
 */
function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 月の終了日を取得
 */
function getMonthEnd(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0); // 前月の最終日
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * 日付範囲内のメトリクスをフィルタ
 */
function filterMetricsByDateRange(
  metrics: DevOpsMetrics[],
  startDate: Date,
  endDate: Date
): DevOpsMetrics[] {
  return metrics.filter((m) => {
    const metricDate = new Date(m.date);
    return metricDate >= startDate && metricDate <= endDate;
  });
}

/**
 * 月次レポートを送信
 *
 * トリガーから呼ばれる場合は1日かどうかをチェックし、1日でなければスキップ
 */
export function sendMonthlyReport(): void {
  const { logger, slackClient } = getContainer();

  // 今日が1日かチェック（トリガー用）
  const today = new Date();
  if (today.getDate() !== 1) {
    logger.debug('Not the 1st of month, skipping monthly report');
    return;
  }

  if (!isSlackNotificationEnabled()) {
    logger.warn('Slack Webhook URL not configured. Skipping monthly report.');
    return;
  }

  try {
    const config = getConfig();
    const spreadsheet = config.spreadsheet;

    // 全リポジトリのメトリクスを収集
    const repositories = config.github.repositories.map((repo) => `${repo.owner}/${repo.name}`);
    const allMetrics = readMetricsFromAllRepositorySheets(spreadsheet.id, repositories);

    if (allMetrics.length === 0) {
      logger.warn('No metrics found for monthly report');
      return;
    }

    // 今月と先月の範囲を計算
    const now = new Date();
    const currentMonthStart = getMonthStart(now);
    const currentMonthEnd = getMonthEnd(now);

    const previousMonthStart = new Date(currentMonthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    const previousMonthEnd = new Date(currentMonthEnd);
    previousMonthEnd.setMonth(previousMonthEnd.getMonth() - 1);

    // 今月と先月のメトリクスをフィルタ
    const currentMonthMetrics = filterMetricsByDateRange(
      allMetrics,
      currentMonthStart,
      currentMonthEnd
    );
    const previousMonthMetrics = filterMetricsByDateRange(
      allMetrics,
      previousMonthStart,
      previousMonthEnd
    );

    // メッセージを生成
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheet.id}`;
    const message = createMonthlyReportMessage(
      currentMonthMetrics,
      previousMonthMetrics,
      spreadsheetUrl
    );

    // Slackに送信
    slackClient.sendMessage(message);
    logger.info('📢 Slack monthly report sent successfully');
  } catch (error) {
    logger.error(`Failed to send Slack monthly report: ${String(error)}`);
    throw error;
  }
}

/**
 * 月次レポート用のトリガーを設定
 *
 * 毎月1日の朝9時に実行
 */
export function setupMonthlyReportTrigger(): void {
  const { triggerClient, logger } = getContainer();

  if (!isSlackNotificationEnabled()) {
    logger.warn('Slack Webhook URL is not configured. Please configure it first.');
    return;
  }

  // 既存のトリガーを削除
  const triggers = triggerClient.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'sendMonthlyReport') {
      triggerClient.deleteTrigger(trigger);
      logger.info('Deleted existing monthly report trigger');
    }
  }

  // 新しいトリガーを作成（毎日実行し、1日かどうかをチェック）
  // GASには直接「毎月1日」のトリガーがないため、日次トリガーで実装
  triggerClient.newTrigger('sendMonthlyReport').timeBased().everyDays(1).atHour(9).create();

  logger.info('✅ Monthly report trigger set up successfully (Every 1st of month at 9:00)');
}

/**
 * 月次レポート用のトリガーを削除
 */
export function removeMonthlyReportTrigger(): void {
  const { triggerClient, logger } = getContainer();

  const triggers = triggerClient.getProjectTriggers();
  let removed = false;

  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'sendMonthlyReport') {
      triggerClient.deleteTrigger(trigger);
      removed = true;
    }
  }

  if (removed) {
    logger.info('🗑️ Monthly report trigger removed');
  } else {
    logger.info('No monthly report trigger found to remove');
  }
}

/**
 * 月次レポートトリガーの状態を表示
 */
export function showMonthlyReportTrigger(): void {
  const { triggerClient, logger } = getContainer();

  const triggers = triggerClient.getProjectTriggers();
  const monthlyTriggers = triggers.filter((t) => t.getHandlerFunction() === 'sendMonthlyReport');

  if (monthlyTriggers.length > 0) {
    logger.log('Monthly report trigger is set up (Every 1st of month at 9:00)');
  } else {
    logger.log('No monthly report trigger found');
  }
}
