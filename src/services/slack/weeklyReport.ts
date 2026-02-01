/**
 * Slack週次レポート通知機能
 *
 * DORA指標の週次レポートをSlackに送信
 */

import type { DevOpsMetrics } from '../../types';
import type { SlackMessage, SlackBlock } from '../../interfaces';
import type { WeeklyTrendData } from '../spreadsheet/dashboardTypes';
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
 * 数値を小数点1桁にフォーマット
 */
function formatNumber(value: number | null): string {
  if (value === null) {
    return 'N/A';
  }
  return value.toFixed(1);
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
 * 週次レポートメッセージを生成
 */
export function createWeeklyReportMessage(
  currentWeekMetrics: DevOpsMetrics[],
  previousWeekMetrics: DevOpsMetrics[],
  weeklyTrends: WeeklyTrendData[],
  spreadsheetUrl: string
): SlackMessage {
  const { logger } = getContainer();

  if (currentWeekMetrics.length === 0) {
    logger.warn('No metrics available for weekly report');
    return {
      text: '📊 DevOps Metrics 週次レポート - データなし',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📊 DevOps Metrics 週次レポート*\n\n今週のデータはありません。',
          },
        },
      ],
    };
  }

  // 今週の平均を計算
  const avgDeploymentFreq =
    currentWeekMetrics.reduce((sum, m) => sum + parseFloat(m.deploymentFrequency), 0) /
    currentWeekMetrics.length;

  const validLeadTimes = currentWeekMetrics
    .map((m) => m.leadTimeForChangesHours)
    .filter((v): v is number => v !== null);
  const avgLeadTime =
    validLeadTimes.length > 0
      ? validLeadTimes.reduce((sum, v) => sum + v, 0) / validLeadTimes.length
      : null;

  const validCFRs = currentWeekMetrics
    .map((m) => m.changeFailureRate)
    .filter((v): v is number => v !== null);
  const avgCFR =
    validCFRs.length > 0 ? validCFRs.reduce((sum, v) => sum + v, 0) / validCFRs.length : null;

  const validMTTRs = currentWeekMetrics
    .map((m) => m.meanTimeToRecoveryHours)
    .filter((v): v is number => v !== null);
  const avgMTTR =
    validMTTRs.length > 0 ? validMTTRs.reduce((sum, v) => sum + v, 0) / validMTTRs.length : null;

  // 先週の平均を計算
  let prevAvgDeploymentFreq: number | null = null;
  let prevAvgLeadTime: number | null = null;
  let prevAvgCFR: number | null = null;
  let prevAvgMTTR: number | null = null;

  if (previousWeekMetrics.length > 0) {
    prevAvgDeploymentFreq =
      previousWeekMetrics.reduce((sum, m) => sum + parseFloat(m.deploymentFrequency), 0) /
      previousWeekMetrics.length;

    const prevValidLeadTimes = previousWeekMetrics
      .map((m) => m.leadTimeForChangesHours)
      .filter((v): v is number => v !== null);
    prevAvgLeadTime =
      prevValidLeadTimes.length > 0
        ? prevValidLeadTimes.reduce((sum, v) => sum + v, 0) / prevValidLeadTimes.length
        : null;

    const prevValidCFRs = previousWeekMetrics
      .map((m) => m.changeFailureRate)
      .filter((v): v is number => v !== null);
    prevAvgCFR =
      prevValidCFRs.length > 0
        ? prevValidCFRs.reduce((sum, v) => sum + v, 0) / prevValidCFRs.length
        : null;

    const prevValidMTTRs = previousWeekMetrics
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

  // 週の範囲を取得
  const weekRange = weeklyTrends.length > 0 ? weeklyTrends[weeklyTrends.length - 1].week : '今週';

  // Slack Block Kit メッセージを構築
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📊 DevOps Metrics 週次レポート (${weekRange})`,
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
        text: '*📈 今週の指標（前週比）*',
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*:rocket: デプロイ頻度*\n${formatNumber(avgDeploymentFreq)}回/日 ${trendToEmoji(avgDeploymentFreq, prevAvgDeploymentFreq)}\n前週比: ${formatChange(avgDeploymentFreq, prevAvgDeploymentFreq)}`,
        },
        {
          type: 'mrkdwn',
          text: `*:hourglass_flowing_sand: リードタイム*\n${formatNumber(avgLeadTime)}時間 ${trendToEmoji(avgLeadTime, prevAvgLeadTime)}\n前週比: ${formatChange(avgLeadTime, prevAvgLeadTime)}`,
        },
        {
          type: 'mrkdwn',
          text: `*:fire: 変更障害率*\n${formatNumber(avgCFR)}% ${trendToEmoji(avgCFR, prevAvgCFR)}\n前週比: ${formatChange(avgCFR, prevAvgCFR)}`,
        },
        {
          type: 'mrkdwn',
          text: `*:wrench: MTTR*\n${formatNumber(avgMTTR)}時間 ${trendToEmoji(avgMTTR, prevAvgMTTR)}\n前週比: ${formatChange(avgMTTR, prevAvgMTTR)}`,
        },
      ],
    },
  ];

  // 週次トレンドがあれば追加
  if (weeklyTrends.length >= 2) {
    const recentTrends = weeklyTrends.slice(-4); // 直近4週間
    const trendText = recentTrends.map((t) => `• ${t.week}: ${t.totalDeployments}回`).join('\n');

    blocks.push(
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📊 週次トレンド（デプロイ回数）*\n${trendText}`,
        },
      }
    );
  }

  blocks.push(
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `対象リポジトリ: ${currentWeekMetrics.length}個`,
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
    }
  );

  return {
    text: `📊 DevOps Metrics 週次レポート (${weekRange})`,
    blocks,
  };
}
