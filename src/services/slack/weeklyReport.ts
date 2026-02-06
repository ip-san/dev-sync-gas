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
 * 週次メトリクスの平均値
 */
interface WeeklyAverages {
  deploymentFreq: number;
  leadTime: number | null;
  cfr: number | null;
  mttr: number | null;
}

/**
 * 週次メトリクスの平均を計算
 */
function calculateWeeklyAverages(metrics: DevOpsMetrics[]): WeeklyAverages {
  if (metrics.length === 0) {
    return { deploymentFreq: 0, leadTime: null, cfr: null, mttr: null };
  }

  const avgDeploymentFreq =
    metrics.reduce((sum, m) => sum + parseFloat(m.deploymentFrequency), 0) / metrics.length;

  const validLeadTimes = metrics
    .map((m) => m.leadTimeForChangesHours)
    .filter((v): v is number => v !== null);
  const avgLeadTime =
    validLeadTimes.length > 0
      ? validLeadTimes.reduce((sum, v) => sum + v, 0) / validLeadTimes.length
      : null;

  const validCFRs = metrics.map((m) => m.changeFailureRate).filter((v): v is number => v !== null);
  const avgCFR =
    validCFRs.length > 0 ? validCFRs.reduce((sum, v) => sum + v, 0) / validCFRs.length : null;

  const validMTTRs = metrics
    .map((m) => m.meanTimeToRecoveryHours)
    .filter((v): v is number => v !== null);
  const avgMTTR =
    validMTTRs.length > 0 ? validMTTRs.reduce((sum, v) => sum + v, 0) / validMTTRs.length : null;

  return {
    deploymentFreq: avgDeploymentFreq,
    leadTime: avgLeadTime,
    cfr: avgCFR,
    mttr: avgMTTR,
  };
}

/**
 * ヘッダーブロックを生成
 */
function createHeaderBlocks(weekRange: string, healthStatus: string): SlackBlock[] {
  const statusEmoji = statusToEmoji(healthStatus as 'good' | 'warning' | 'critical');
  const statusText =
    healthStatus === 'good' ? '良好' : healthStatus === 'warning' ? '要注意' : '要対応';

  return [
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
        text: `*総合ステータス:* ${statusEmoji} ${statusText}`,
      },
    },
    {
      type: 'divider',
    },
  ];
}

/**
 * メトリクスブロックを生成
 */
function createMetricsBlocks(current: WeeklyAverages, previous: WeeklyAverages): SlackBlock[] {
  return [
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
          text: `*:rocket: デプロイ頻度*\n${formatNumber(current.deploymentFreq)}回/日 ${trendToEmoji(current.deploymentFreq, previous.deploymentFreq)}\n前週比: ${formatChange(current.deploymentFreq, previous.deploymentFreq)}`,
        },
        {
          type: 'mrkdwn',
          text: `*:hourglass_flowing_sand: リードタイム*\n${formatNumber(current.leadTime)}時間 ${trendToEmoji(current.leadTime, previous.leadTime)}\n前週比: ${formatChange(current.leadTime, previous.leadTime)}`,
        },
        {
          type: 'mrkdwn',
          text: `*:fire: 変更障害率*\n${formatNumber(current.cfr)}% ${trendToEmoji(current.cfr, previous.cfr)}\n前週比: ${formatChange(current.cfr, previous.cfr)}`,
        },
        {
          type: 'mrkdwn',
          text: `*:wrench: MTTR*\n${formatNumber(current.mttr)}時間 ${trendToEmoji(current.mttr, previous.mttr)}\n前週比: ${formatChange(current.mttr, previous.mttr)}`,
        },
      ],
    },
  ];
}

/**
 * 週次トレンドブロックを生成
 */
function createTrendBlocks(weeklyTrends: WeeklyTrendData[]): SlackBlock[] {
  if (weeklyTrends.length < 2) {
    return [];
  }

  const recentTrends = weeklyTrends.slice(-4);
  const trendText = recentTrends.map((t) => `• ${t.week}: ${t.totalDeployments}回`).join('\n');

  return [
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📊 週次トレンド（デプロイ回数）*\n${trendText}`,
      },
    },
  ];
}

/**
 * フッターブロックを生成
 */
function createFooterBlocks(metricsCount: number, spreadsheetUrl: string): SlackBlock[] {
  return [
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `対象リポジトリ: ${metricsCount}個`,
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

  const currentAvg = calculateWeeklyAverages(currentWeekMetrics);
  const previousAvg = calculateWeeklyAverages(previousWeekMetrics);

  const healthStatus = determineHealthStatus(currentAvg.leadTime, currentAvg.cfr, null, null);
  const weekRange = weeklyTrends.length > 0 ? weeklyTrends[weeklyTrends.length - 1].week : '今週';

  const blocks: SlackBlock[] = [
    ...createHeaderBlocks(weekRange, healthStatus),
    ...createMetricsBlocks(currentAvg, previousAvg),
    ...createTrendBlocks(weeklyTrends),
    ...createFooterBlocks(currentWeekMetrics.length, spreadsheetUrl),
  ];

  return {
    text: `📊 DevOps Metrics 週次レポート (${weekRange})`,
    blocks,
  };
}
