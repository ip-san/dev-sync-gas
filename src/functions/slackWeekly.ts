/**
 * Slack週次レポート送信機能
 */

import { getConfig } from '../config/settings';
import { getContainer } from '../container';
import { isSlackNotificationEnabled } from '../services/slack/client';
import { createWeeklyReportMessage } from '../services/slack/weeklyReport';
import { calculateWeeklyTrends } from '../services/spreadsheet/dashboard';
import { readMetricsFromAllRepositorySheets } from '../services/spreadsheet/repositorySheet';
import type { DevOpsMetrics } from '../types';

/**
 * 週の開始日（月曜日）を取得
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 月曜日に調整
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * 週の終了日（日曜日）を取得
 */
function getWeekEnd(date: Date): Date {
  const d = getWeekStart(date);
  d.setDate(d.getDate() + 6);
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
 * 週次レポートを送信
 */
export function sendWeeklyReport(): void {
  const { logger, slackClient } = getContainer();

  if (!isSlackNotificationEnabled()) {
    logger.warn('Slack Webhook URL not configured. Skipping weekly report.');
    return;
  }

  try {
    const config = getConfig();
    const spreadsheet = config.spreadsheet;

    // 全リポジトリのメトリクスを収集
    const repositories = config.github.repositories.map((repo) => `${repo.owner}/${repo.name}`);
    const allMetrics = readMetricsFromAllRepositorySheets(spreadsheet.id, repositories);

    if (allMetrics.length === 0) {
      logger.warn('No metrics found for weekly report');
      return;
    }

    // 今週と先週の範囲を計算
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const currentWeekEnd = getWeekEnd(now);

    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);
    const previousWeekEnd = new Date(currentWeekEnd);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);

    // 今週と先週のメトリクスをフィルタ
    const currentWeekMetrics = filterMetricsByDateRange(
      allMetrics,
      currentWeekStart,
      currentWeekEnd
    );
    const previousWeekMetrics = filterMetricsByDateRange(
      allMetrics,
      previousWeekStart,
      previousWeekEnd
    );

    // 週次トレンドを集計
    const weeklyTrends = calculateWeeklyTrends(allMetrics);

    // メッセージを生成
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheet.id}`;
    const message = createWeeklyReportMessage(
      currentWeekMetrics,
      previousWeekMetrics,
      weeklyTrends,
      spreadsheetUrl
    );

    // Slackに送信
    slackClient.sendMessage(message);
    logger.info('📢 Slack weekly report sent successfully');
  } catch (error) {
    logger.error(`Failed to send Slack weekly report: ${String(error)}`);
    throw error;
  }
}

/**
 * 週次レポート用のトリガーを設定
 *
 * 毎週月曜日の朝9時に実行
 */
export function setupWeeklyReportTrigger(): void {
  const { triggerClient, logger } = getContainer();

  if (!isSlackNotificationEnabled()) {
    logger.warn('Slack Webhook URL is not configured. Please configure it first.');
    return;
  }

  // 既存のトリガーを削除
  const triggers = triggerClient.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'sendWeeklyReport') {
      triggerClient.deleteTrigger(trigger);
      logger.info('Deleted existing weekly report trigger');
    }
  }

  // 新しいトリガーを作成（毎週月曜日 9:00）
  // GoogleAppsScript.Base.Weekday.MONDAY = 1
  triggerClient
    .newTrigger('sendWeeklyReport')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(1)
    .atHour(9)
    .create();

  logger.info('✅ Weekly report trigger set up successfully (Every Monday at 9:00)');
}

/**
 * 週次レポート用のトリガーを削除
 */
export function removeWeeklyReportTrigger(): void {
  const { triggerClient, logger } = getContainer();

  const triggers = triggerClient.getProjectTriggers();
  let removed = false;

  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'sendWeeklyReport') {
      triggerClient.deleteTrigger(trigger);
      removed = true;
    }
  }

  if (removed) {
    logger.info('🗑️ Weekly report trigger removed');
  } else {
    logger.info('No weekly report trigger found to remove');
  }
}
