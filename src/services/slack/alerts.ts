/**
 * Slack アラート通知機能
 *
 * DevOps指標が閾値を超えた場合にアラートを送信
 */

import type { DevOpsMetrics } from '../../types';
import type { SlackMessage, SlackBlock } from '../../interfaces';
import { determineHealthStatus } from '../spreadsheet/dashboard';
import { DEFAULT_HEALTH_THRESHOLDS } from '../../types/dashboard';
import { getContainer } from '../../container';

/**
 * アラートの種類
 */
export type AlertType =
  | 'critical_health' // 健全性が critical
  | 'high_lead_time' // リードタイムが高い
  | 'high_failure_rate' // 変更障害率が高い
  | 'low_deployment_frequency'; // デプロイ頻度が低い

/**
 * アラート情報
 */
export interface Alert {
  type: AlertType;
  repository: string;
  metric: string;
  value: number | string;
  threshold: number | string;
  severity: 'warning' | 'critical';
}

/**
 * 健全性ステータスのアラートを検出
 */
function checkHealthStatus(metric: DevOpsMetrics): Alert | null {
  const healthStatus = determineHealthStatus(
    metric.leadTimeForChangesHours,
    metric.changeFailureRate,
    null,
    null
  );

  if (healthStatus === 'critical') {
    return {
      type: 'critical_health',
      repository: metric.repository,
      metric: '総合ステータス',
      value: 'Critical',
      threshold: 'Good',
      severity: 'critical',
    };
  }

  return null;
}

/**
 * リードタイムのアラートを検出
 */
function checkLeadTime(metric: DevOpsMetrics): Alert | null {
  if (metric.leadTimeForChangesHours === null) {
    return null;
  }

  const thresholds = DEFAULT_HEALTH_THRESHOLDS;
  const leadTimeCritical = thresholds.leadTime.warning * 2;

  if (metric.leadTimeForChangesHours > leadTimeCritical) {
    return {
      type: 'high_lead_time',
      repository: metric.repository,
      metric: 'リードタイム',
      value: `${metric.leadTimeForChangesHours.toFixed(1)}時間`,
      threshold: `${leadTimeCritical}時間`,
      severity: 'critical',
    };
  }

  if (metric.leadTimeForChangesHours > thresholds.leadTime.warning) {
    return {
      type: 'high_lead_time',
      repository: metric.repository,
      metric: 'リードタイム',
      value: `${metric.leadTimeForChangesHours.toFixed(1)}時間`,
      threshold: `${thresholds.leadTime.warning}時間`,
      severity: 'warning',
    };
  }

  return null;
}

/**
 * 変更障害率のアラートを検出
 */
function checkChangeFailureRate(metric: DevOpsMetrics): Alert | null {
  if (metric.changeFailureRate === null) {
    return null;
  }

  const thresholds = DEFAULT_HEALTH_THRESHOLDS;
  const cfrCritical = thresholds.changeFailureRate.warning * 1.5;

  if (metric.changeFailureRate > cfrCritical) {
    return {
      type: 'high_failure_rate',
      repository: metric.repository,
      metric: '変更障害率',
      value: `${metric.changeFailureRate.toFixed(1)}%`,
      threshold: `${cfrCritical.toFixed(1)}%`,
      severity: 'critical',
    };
  }

  if (metric.changeFailureRate > thresholds.changeFailureRate.warning) {
    return {
      type: 'high_failure_rate',
      repository: metric.repository,
      metric: '変更障害率',
      value: `${metric.changeFailureRate.toFixed(1)}%`,
      threshold: `${thresholds.changeFailureRate.warning}%`,
      severity: 'warning',
    };
  }

  return null;
}

/**
 * デプロイ頻度のアラートを検出
 */
function checkDeploymentFrequency(metric: DevOpsMetrics): Alert | null {
  const deploymentFreq = parseFloat(metric.deploymentFrequency);

  if (deploymentFreq < 1.0) {
    return {
      type: 'low_deployment_frequency',
      repository: metric.repository,
      metric: 'デプロイ頻度',
      value: `${deploymentFreq.toFixed(1)}回/日`,
      threshold: '1.0回/日',
      severity: deploymentFreq < 0.5 ? 'critical' : 'warning',
    };
  }

  return null;
}

/**
 * メトリクスからアラートを検出
 */
export function detectAlerts(metrics: DevOpsMetrics[]): Alert[] {
  const alerts: Alert[] = [];

  for (const metric of metrics) {
    const healthAlert = checkHealthStatus(metric);
    if (healthAlert) {
      alerts.push(healthAlert);
    }

    const leadTimeAlert = checkLeadTime(metric);
    if (leadTimeAlert) {
      alerts.push(leadTimeAlert);
    }

    const cfrAlert = checkChangeFailureRate(metric);
    if (cfrAlert) {
      alerts.push(cfrAlert);
    }

    const deploymentAlert = checkDeploymentFrequency(metric);
    if (deploymentAlert) {
      alerts.push(deploymentAlert);
    }
  }

  return alerts;
}

/**
 * ヘッダーブロックを生成
 */
function createHeaderBlocks(criticalCount: number, warningCount: number): SlackBlock[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '⚠️ DevOps Metrics Alert',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*検出されたアラート:* ${criticalCount}件（Critical）、${warningCount}件（Warning）`,
      },
    },
    {
      type: 'divider',
    },
  ];
}

/**
 * アラートブロックを生成
 */
function createAlertBlock(alert: Alert): SlackBlock {
  return {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*リポジトリ:*\n${alert.repository}`,
      },
      {
        type: 'mrkdwn',
        text: `*指標:*\n${alert.metric}`,
      },
      {
        type: 'mrkdwn',
        text: `*現在値:*\n${alert.value}`,
      },
      {
        type: 'mrkdwn',
        text: `*閾値:*\n${alert.threshold}`,
      },
    ],
  };
}

/**
 * 重大度別アラートブロックを生成
 */
function createSeverityBlocks(alerts: Alert[], severity: 'critical' | 'warning'): SlackBlock[] {
  if (alerts.length === 0) {
    return [];
  }

  const icon = severity === 'critical' ? ':rotating_light:' : ':warning:';
  const title = severity === 'critical' ? 'Critical Alerts' : 'Warning Alerts';

  const blocks: SlackBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${icon} ${title}*`,
      },
    },
  ];

  for (const alert of alerts) {
    blocks.push(createAlertBlock(alert));
  }

  blocks.push({
    type: 'divider',
  });

  return blocks;
}

/**
 * アクションブロックを生成
 */
function createActionBlocks(spreadsheetUrl: string): SlackBlock[] {
  return [
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📄 ダッシュボードを開く',
          },
          url: spreadsheetUrl,
          action_id: 'open_dashboard',
        },
      ],
    },
  ];
}

/**
 * アラートメッセージを生成
 */
export function createAlertMessage(alerts: Alert[], spreadsheetUrl: string): SlackMessage {
  const { logger } = getContainer();

  if (alerts.length === 0) {
    logger.debug('No alerts to send');
    return {
      text: '⚠️ DevOps Metrics Alert - No issues detected',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*⚠️ DevOps Metrics Alert*\n\nすべての指標が正常範囲内です。',
          },
        },
      ],
    };
  }

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');

  const blocks: SlackBlock[] = [
    ...createHeaderBlocks(criticalAlerts.length, warningAlerts.length),
    ...createSeverityBlocks(criticalAlerts, 'critical'),
    ...createSeverityBlocks(warningAlerts, 'warning'),
    ...createActionBlocks(spreadsheetUrl),
  ];

  return {
    text: `⚠️ DevOps Metrics Alert - ${alerts.length}件のアラート検出`,
    blocks,
  };
}
