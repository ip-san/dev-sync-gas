/**
 * Slackインシデント日次サマリー機能
 *
 * インシデントの日次集計と振り返り用レポートを提供。
 * リアルタイム通知は他ツール（PagerDuty/OpsGenie等）が担当。
 */

import { getIncidentLabelsForRepository } from '../../config/metrics';
import type { SlackBlock, SlackMessage } from '../../interfaces';
import type { GitHubIssue } from '../../types/github';

export type IncidentEventType = 'opened' | 'closed';

/**
 * インシデント通知用のIssue型（GraphQLIssueを拡張）
 */
export interface IncidentIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  labels: string[];
  url: string;
  createdAt: string;
  closedAt: string | null;
}

export interface IncidentEvent {
  issue: IncidentIssue;
  eventType: IncidentEventType;
  repository: string;
  detectionTime: Date;
}

/**
 * GitHubIssueをIncidentIssueに変換
 */
export function toIncidentIssue(issue: GitHubIssue, owner: string, repo: string): IncidentIssue {
  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    labels: issue.labels,
    url: `https://github.com/${owner}/${repo}/issues/${issue.number}`,
    createdAt: issue.createdAt,
    closedAt: issue.closedAt,
  };
}

/**
 * Issueがインシデントかどうかを判定
 * @param labels Issueのラベル一覧
 * @param owner リポジトリオーナー
 * @param repoName リポジトリ名
 */
export function isIncident(labels: string[], owner: string, repoName: string): boolean {
  const incidentLabels = getIncidentLabelsForRepository(owner, repoName);

  // 設定されたインシデントラベルのいずれかが付いているか
  return labels.some((label: string) =>
    incidentLabels.some(
      (incidentLabel: string) => label.toLowerCase() === incidentLabel.toLowerCase()
    )
  );
}

/**
 * インシデントの重要度を判定
 */
function determineIncidentSeverity(labels: string[]): 'critical' | 'high' | 'medium' {
  const lowerLabels = labels.map((l) => l.toLowerCase());

  if (lowerLabels.some((l) => l.includes('p0') || l.includes('critical') || l.includes('urgent'))) {
    return 'critical';
  }

  if (lowerLabels.some((l) => l.includes('p1') || l.includes('high'))) {
    return 'high';
  }

  return 'medium';
}

/**
 * 重要度に応じた絵文字を返す
 */
function severityToEmoji(severity: 'critical' | 'high' | 'medium'): string {
  switch (severity) {
    case 'critical':
      return ':rotating_light:';
    case 'high':
      return ':warning:';
    case 'medium':
      return ':information_source:';
  }
}

/**
 * MTTRを計算
 */
function calculateMTTR(createdAt: string, closedAt: string | null): string {
  if (!createdAt || !closedAt) {
    return 'N/A';
  }
  const hours = (new Date(closedAt).getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  return hours.toFixed(1);
}

/**
 * ヘッダーブロックを生成
 */
function createIncidentHeaderBlocks(
  dateStr: string,
  openedCount: number,
  closedCount: number
): SlackBlock[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📊 インシデント日次サマリー (${dateStr})`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*🔥 発生件数*\n${openedCount}件`,
        },
        {
          type: 'mrkdwn',
          text: `*✅ 解決件数*\n${closedCount}件`,
        },
      ],
    },
  ];
}

/**
 * 発生したインシデントのブロックを生成
 */
function createOpenedIncidentsBlocks(openedIncidents: IncidentEvent[]): SlackBlock[] {
  if (openedIncidents.length === 0) {
    return [];
  }

  const blocks: SlackBlock[] = [
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🔥 本日発生したインシデント*',
      },
    },
  ];

  openedIncidents.forEach((event) => {
    const severity = determineIncidentSeverity(event.issue.labels);
    const severityEmoji = severityToEmoji(severity);

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${severityEmoji} <${event.issue.url}|#${event.issue.number} ${event.issue.title}>\n_${event.repository}_`,
      },
    });
  });

  return blocks;
}

/**
 * 解決したインシデントのブロックを生成
 */
function createClosedIncidentsBlocks(closedIncidents: IncidentEvent[]): SlackBlock[] {
  if (closedIncidents.length === 0) {
    return [];
  }

  const blocks: SlackBlock[] = [
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*✅ 本日解決したインシデント*',
      },
    },
  ];

  closedIncidents.forEach((event) => {
    const mttr = calculateMTTR(event.issue.createdAt, event.issue.closedAt);

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${event.issue.url}|#${event.issue.number} ${event.issue.title}> (MTTR: ${mttr}h)\n_${event.repository}_`,
      },
    });
  });

  return blocks;
}

/**
 * フッターブロックを生成
 */
function createIncidentFooterBlocks(spreadsheetUrl: string): SlackBlock[] {
  return [
    {
      type: 'divider',
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
 * 複数のインシデントをまとめた日次サマリーメッセージを生成
 */
export function createIncidentDailySummaryMessage(
  incidents: IncidentEvent[],
  date: Date,
  spreadsheetUrl: string
): SlackMessage {
  const dateStr = date.toISOString().split('T')[0];
  const openedIncidents = incidents.filter((e) => e.eventType === 'opened');
  const closedIncidents = incidents.filter((e) => e.eventType === 'closed');

  const blocks: SlackBlock[] = [
    ...createIncidentHeaderBlocks(dateStr, openedIncidents.length, closedIncidents.length),
    ...createOpenedIncidentsBlocks(openedIncidents),
    ...createClosedIncidentsBlocks(closedIncidents),
    ...createIncidentFooterBlocks(spreadsheetUrl),
  ];

  return {
    text: `📊 インシデント日次サマリー (${dateStr}): 発生 ${openedIncidents.length}件、解決 ${closedIncidents.length}件`,
    blocks,
  };
}
