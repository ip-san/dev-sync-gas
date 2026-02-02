/**
 * Slack月次レポート通知機能
 *
 * DORA指標の月次サマリーをSlackに送信
 */

import type { DevOpsMetrics } from '../../types';
import type { SlackMessage, SlackBlock } from '../../interfaces';
import { determineHealthStatus } from '../spreadsheet/dashboard';
import { getContainer } from '../../container';

/**
 * 健全性ステータスを絵文字に変換
 */
function statusToEmoji(status: 'good' | 'warning' | 'critical'): string {
  switch (status) {
    case 'good':
      return ':large_green_circle:';
    case 'warning':
      return ':large_yellow_circle:';
    case 'critical':
      return ':red_circle:';
  }
}

/**
 * 数値を小数点1桁にフォーマット
 */
function formatNumber(value: number | null): string {
  if (value === null) {
    return 'N/A';
  }
  return value.toFixed(1);
}

/**
 * トレンドを絵文字に変換
 */
function trendToEmoji(current: number | null, previous: number | null): string {
  if (current === null || previous === null) {
    return ':heavy_minus_sign:';
  }
  if (current > previous) {
    return ':chart_with_upwards_trend:';
  }
  if (current < previous) {
    return ':chart_with_downwards_trend:';
  }
  return ':heavy_minus_sign:';
}

/**
 * 変化率を計算してフォーマット
 */
function formatChange(current: number | null, previous: number | null): string {
  if (current === null || previous === null || previous === 0) {
    return 'N/A';
  }
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

/**
 * 月次レポートメッセージを生成
 */
export function createMonthlyReportMessage(
  currentMonthMetrics: DevOpsMetrics[],
  previousMonthMetrics: DevOpsMetrics[],
  spreadsheetUrl: string
): SlackMessage {
  const { logger } = getContainer();

  if (currentMonthMetrics.length === 0) {
    logger.warn('No metrics available for monthly report');
    return {
      text: '📊 DevOps Metrics 月次レポート - データなし',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📊 DevOps Metrics 月次レポート*\n\n今月のデータはありません。',
          },
        },
      ],
    };
  }

  // 今月の平均を計算
  const avgDeploymentFreq =
    currentMonthMetrics.reduce((sum, m) => sum + parseFloat(m.deploymentFrequency), 0) /
    currentMonthMetrics.length;

  const validLeadTimes = currentMonthMetrics
    .map((m) => m.leadTimeForChangesHours)
    .filter((v): v is number => v !== null);
  const avgLeadTime =
    validLeadTimes.length > 0
      ? validLeadTimes.reduce((sum, v) => sum + v, 0) / validLeadTimes.length
      : null;

  const validCFRs = currentMonthMetrics
    .map((m) => m.changeFailureRate)
    .filter((v): v is number => v !== null);
  const avgCFR =
    validCFRs.length > 0 ? validCFRs.reduce((sum, v) => sum + v, 0) / validCFRs.length : null;

  const validMTTRs = currentMonthMetrics
    .map((m) => m.meanTimeToRecoveryHours)
    .filter((v): v is number => v !== null);
  const avgMTTR =
    validMTTRs.length > 0 ? validMTTRs.reduce((sum, v) => sum + v, 0) / validMTTRs.length : null;

  // 先月の平均を計算（比較用）
  let prevAvgDeploymentFreq: number | null = null;
  let prevAvgLeadTime: number | null = null;
  let prevAvgCFR: number | null = null;
  let prevAvgMTTR: number | null = null;

  if (previousMonthMetrics.length > 0) {
    prevAvgDeploymentFreq =
      previousMonthMetrics.reduce((sum, m) => sum + parseFloat(m.deploymentFrequency), 0) /
      previousMonthMetrics.length;

    const prevValidLeadTimes = previousMonthMetrics
      .map((m) => m.leadTimeForChangesHours)
      .filter((v): v is number => v !== null);
    prevAvgLeadTime =
      prevValidLeadTimes.length > 0
        ? prevValidLeadTimes.reduce((sum, v) => sum + v, 0) / prevValidLeadTimes.length
        : null;

    const prevValidCFRs = previousMonthMetrics
      .map((m) => m.changeFailureRate)
      .filter((v): v is number => v !== null);
    prevAvgCFR =
      prevValidCFRs.length > 0
        ? prevValidCFRs.reduce((sum, v) => sum + v, 0) / prevValidCFRs.length
        : null;

    const prevValidMTTRs = previousMonthMetrics
      .map((m) => m.meanTimeToRecoveryHours)
      .filter((v): v is number => v !== null);
    prevAvgMTTR =
      prevValidMTTRs.length > 0
        ? prevValidMTTRs.reduce((sum, v) => sum + v, 0) / prevValidMTTRs.length
        : null;
  }

  // 健全性ステータスを判定
  const healthStatus = determineHealthStatus(avgLeadTime, avgCFR, null, null);
  const statusEmoji = statusToEmoji(healthStatus);

  // 月の範囲を取得（最新データの日付から）
  const latestDate = currentMonthMetrics[currentMonthMetrics.length - 1].date;
  const yearMonth = latestDate.substring(0, 7); // YYYY-MM

  // Slack Block Kit メッセージを構築
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📊 DevOps Metrics 月次レポート (${yearMonth})`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*総合ステータス:* ${statusEmoji} ${healthStatus === 'good' ? '良好' : healthStatus === 'warning' ? '要注意' : '要対応'}`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*📈 今月の指標（前月比）*',
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*:rocket: デプロイ頻度*\n${formatNumber(avgDeploymentFreq)}回/日 ${trendToEmoji(avgDeploymentFreq, prevAvgDeploymentFreq)}\n前月比: ${formatChange(avgDeploymentFreq, prevAvgDeploymentFreq)}`,
        },
        {
          type: 'mrkdwn',
          text: `*:hourglass_flowing_sand: リードタイム*\n${formatNumber(avgLeadTime)}時間 ${trendToEmoji(avgLeadTime, prevAvgLeadTime)}\n前月比: ${formatChange(avgLeadTime, prevAvgLeadTime)}`,
        },
        {
          type: 'mrkdwn',
          text: `*:fire: 変更障害率*\n${formatNumber(avgCFR)}% ${trendToEmoji(avgCFR, prevAvgCFR)}\n前月比: ${formatChange(avgCFR, prevAvgCFR)}`,
        },
        {
          type: 'mrkdwn',
          text: `*:wrench: MTTR*\n${formatNumber(avgMTTR)}時間 ${trendToEmoji(avgMTTR, prevAvgMTTR)}\n前月比: ${formatChange(avgMTTR, prevAvgMTTR)}`,
        },
      ],
    },
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `対象日数: ${currentMonthMetrics.length}日 | 対象リポジトリ: ${new Set(currentMonthMetrics.map((m) => m.repository)).size}個`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📄 詳細レポートを開く',
          },
          url: spreadsheetUrl,
          action_id: 'open_spreadsheet',
        },
      ],
    },
  ];

  return {
    text: `📊 DevOps Metrics 月次レポート (${yearMonth})`,
    blocks,
  };
}
