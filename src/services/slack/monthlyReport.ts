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
 * 月次メトリクスの平均値
 */
interface MonthlyAverages {
  deploymentFreq: number;
  leadTime: number | null;
  cfr: number | null;
  mttr: number | null;
}

/**
 * 月次メトリクスの平均を計算
 */
function calculateMonthlyAverages(metrics: DevOpsMetrics[]): MonthlyAverages {
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
function createHeaderBlocks(yearMonth: string, healthStatus: string): SlackBlock[] {
  const statusEmoji = statusToEmoji(healthStatus as 'good' | 'warning' | 'critical');
  const statusText =
    healthStatus === 'good' ? '良好' : healthStatus === 'warning' ? '要注意' : '要対応';

  return [
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
function createMetricsBlocks(current: MonthlyAverages, previous: MonthlyAverages): SlackBlock[] {
  return [
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
          text: `*:rocket: デプロイ頻度*\n${formatNumber(current.deploymentFreq)}回/日 ${trendToEmoji(current.deploymentFreq, previous.deploymentFreq)}\n前月比: ${formatChange(current.deploymentFreq, previous.deploymentFreq)}`,
        },
        {
          type: 'mrkdwn',
          text: `*:hourglass_flowing_sand: リードタイム*\n${formatNumber(current.leadTime)}時間 ${trendToEmoji(current.leadTime, previous.leadTime)}\n前月比: ${formatChange(current.leadTime, previous.leadTime)}`,
        },
        {
          type: 'mrkdwn',
          text: `*:fire: 変更障害率*\n${formatNumber(current.cfr)}% ${trendToEmoji(current.cfr, previous.cfr)}\n前月比: ${formatChange(current.cfr, previous.cfr)}`,
        },
        {
          type: 'mrkdwn',
          text: `*:wrench: MTTR*\n${formatNumber(current.mttr)}時間 ${trendToEmoji(current.mttr, previous.mttr)}\n前月比: ${formatChange(current.mttr, previous.mttr)}`,
        },
      ],
    },
  ];
}

/**
 * フッターブロックを生成
 */
function createFooterBlocks(
  daysCount: number,
  repoCount: number,
  spreadsheetUrl: string
): SlackBlock[] {
  return [
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `対象日数: ${daysCount}日 | 対象リポジトリ: ${repoCount}個`,
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

  const currentAvg = calculateMonthlyAverages(currentMonthMetrics);
  const previousAvg = calculateMonthlyAverages(previousMonthMetrics);

  const healthStatus = determineHealthStatus(currentAvg.leadTime, currentAvg.cfr, null, null);
  const latestDate = currentMonthMetrics[currentMonthMetrics.length - 1].date;
  const yearMonth = latestDate.substring(0, 7);

  const daysCount = currentMonthMetrics.length;
  const repoCount = new Set(currentMonthMetrics.map((m) => m.repository)).size;

  const blocks: SlackBlock[] = [
    ...createHeaderBlocks(yearMonth, healthStatus),
    ...createMetricsBlocks(currentAvg, previousAvg),
    ...createFooterBlocks(daysCount, repoCount, spreadsheetUrl),
  ];

  return {
    text: `📊 DevOps Metrics 月次レポート (${yearMonth})`,
    blocks,
  };
}
