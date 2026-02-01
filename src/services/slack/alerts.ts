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
 * メトリクスからアラートを検出
 */
export function detectAlerts(metrics: DevOpsMetrics[]): Alert[] {
  const alerts: Alert[] = [];
  const thresholds = DEFAULT_HEALTH_THRESHOLDS;

  for (const metric of metrics) {
    // 健全性ステータスをチェック
    const healthStatus = determineHealthStatus(
      metric.leadTimeForChangesHours,
      metric.changeFailureRate,
      null, // cycleTime is optional
      null // timeToFirstReview is optional
    );

    if (healthStatus === 'critical') {
      alerts.push({
        type: 'critical_health',
        repository: metric.repository,
        metric: '総合ステータス',
        value: 'Critical',
        threshold: 'Good',
        severity: 'critical',
      });
    }

    // リードタイムをチェック (warning閾値の2倍で critical扱い)
    const leadTimeCritical = thresholds.leadTime.warning * 2;
    if (
      metric.leadTimeForChangesHours !== null &&
      metric.leadTimeForChangesHours > leadTimeCritical
    ) {
      alerts.push({
        type: 'high_lead_time',
        repository: metric.repository,
        metric: 'リードタイム',
        value: `${metric.leadTimeForChangesHours.toFixed(1)}時間`,
        threshold: `${leadTimeCritical}時間`,
        severity: 'critical',
      });
    } else if (
      metric.leadTimeForChangesHours !== null &&
      metric.leadTimeForChangesHours > thresholds.leadTime.warning
    ) {
      alerts.push({
        type: 'high_lead_time',
        repository: metric.repository,
        metric: 'リードタイム',
        value: `${metric.leadTimeForChangesHours.toFixed(1)}時間`,
        threshold: `${thresholds.leadTime.warning}時間`,
        severity: 'warning',
      });
    }

    // 変更障害率をチェック (warning閾値の1.5倍で critical扱い)
    const cfrCritical = thresholds.changeFailureRate.warning * 1.5;
    if (metric.changeFailureRate !== null && metric.changeFailureRate > cfrCritical) {
      alerts.push({
        type: 'high_failure_rate',
        repository: metric.repository,
        metric: '変更障害率',
        value: `${metric.changeFailureRate.toFixed(1)}%`,
        threshold: `${cfrCritical.toFixed(1)}%`,
        severity: 'critical',
      });
    } else if (
      metric.changeFailureRate !== null &&
      metric.changeFailureRate > thresholds.changeFailureRate.warning
    ) {
      alerts.push({
        type: 'high_failure_rate',
        repository: metric.repository,
        metric: '変更障害率',
        value: `${metric.changeFailureRate.toFixed(1)}%`,
        threshold: `${thresholds.changeFailureRate.warning}%`,
        severity: 'warning',
      });
    }

    // デプロイ頻度をチェック（1日1回未満は警告）
    const deploymentFreq = parseFloat(metric.deploymentFrequency);
    if (deploymentFreq < 1.0) {
      alerts.push({
        type: 'low_deployment_frequency',
        repository: metric.repository,
        metric: 'デプロイ頻度',
        value: `${deploymentFreq.toFixed(1)}回/日`,
        threshold: '1.0回/日',
        severity: deploymentFreq < 0.5 ? 'critical' : 'warning',
      });
    }
  }

  return alerts;
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

  // 重大度別にグループ化
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');

  // Slack Block Kit メッセージを構築
  const blocks: SlackBlock[] = [
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
        text: `*検出されたアラート:* ${criticalAlerts.length}件（Critical）、${warningAlerts.length}件（Warning）`,
      },
    },
    {
      type: 'divider',
    },
  ];

  // Criticalアラートを表示
  if (criticalAlerts.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*:rotating_light: Critical Alerts*',
      },
    });

    for (const alert of criticalAlerts) {
      blocks.push({
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
      });
    }

    blocks.push({
      type: 'divider',
    });
  }

  // Warningアラートを表示
  if (warningAlerts.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*:warning: Warning Alerts*',
      },
    });

    for (const alert of warningAlerts) {
      blocks.push({
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
      });
    }

    blocks.push({
      type: 'divider',
    });
  }

  // アクションボタンを追加
  blocks.push({
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
  });

  return {
    text: `⚠️ DevOps Metrics Alert - ${alerts.length}件のアラート検出`,
    blocks,
  };
}
