import type { NotionTask, ApiResponse } from "../types";
import type { HttpRequestOptions } from "../interfaces";
import { getContainer } from "../container";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function fetchNotion<T>(
  endpoint: string,
  token: string,
  options: HttpRequestOptions = {}
): ApiResponse<T> {
  const { httpClient } = getContainer();
  const url = `${NOTION_API_BASE}${endpoint}`;

  try {
    const response = httpClient.fetch<T>(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
        ...options.headers,
      },
      muteHttpExceptions: true,
    });

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return { success: true, data: response.data };
    }
    return { success: false, error: `Notion API error: ${response.statusCode} - ${response.content}` };
  } catch (error) {
    return { success: false, error: `Request failed: ${error}` };
  }
}

export function queryDatabase(
  databaseId: string,
  token: string,
  filter?: object
): ApiResponse<NotionTask[]> {
  const endpoint = `/databases/${databaseId}/query`;
  
  const response = fetchNotion<{ results: any[] }>(endpoint, token, {
    method: "post",
    payload: JSON.stringify({ filter, page_size: 100 }),
  });

  if (!response.success || !response.data) {
    return response as ApiResponse<NotionTask[]>;
  }

  const tasks: NotionTask[] = response.data.results.map((page) => {
    const props = page.properties;
    return {
      id: page.id,
      title: extractTitle(props),
      status: extractStatus(props),
      createdAt: page.created_time,
      startedAt: extractStartedAt(props),
      completedAt: extractCompletedAt(props),
      prUrl: extractPrUrl(props),
      assignee: extractAssignee(props),
      satisfactionScore: extractSatisfactionScore(props),
    };
  });

  return { success: true, data: tasks };
}

function extractTitle(props: any): string {
  const titleProp = Object.values(props).find((p: any) => p.type === "title") as any;
  return titleProp?.title?.[0]?.plain_text ?? "Untitled";
}

function extractStatus(props: any): string {
  const statusProp = Object.values(props).find(
    (p: any) => p.type === "status" || p.type === "select"
  ) as any;
  return statusProp?.status?.name ?? statusProp?.select?.name ?? "Unknown";
}

function extractStartedAt(props: any): string | null {
  const dateProp = props["Date Started"] ?? props["Started"] ?? props["着手日"] ?? props["開始日"];
  return dateProp?.date?.start ?? null;
}

function extractCompletedAt(props: any): string | null {
  const dateProp = props["Date Done"] ?? props["Completed"] ?? props["完了日"] ?? props["Done"];
  return dateProp?.date?.start ?? null;
}

function extractAssignee(props: any): string | null {
  const peopleProp = props["Assignee"] ?? props["担当者"];
  return peopleProp?.people?.[0]?.name ?? null;
}

function extractPrUrl(props: any): string | null {
  const urlProp = props["PR URL"] ?? props["PR"] ?? props["Pull Request"] ?? props["GitHub PR"];
  return urlProp?.url ?? null;
}

function extractSatisfactionScore(props: any): number | null {
  // Notionプロパティ名: 「満足度」「Satisfaction」「Score」等に対応
  const prop = props["満足度"] ?? props["Satisfaction"] ?? props["満足度スコア"] ?? props["Score"];
  if (!prop) return null;

  // Select型（★1〜★5の選択肢）
  if (prop.select?.name) {
    const match = prop.select.name.match(/(\d)/);
    if (match) {
      const value = parseInt(match[1], 10);
      if (value >= 1 && value <= 5) return value;
    }
  }

  // Number型（1〜5の数値）
  if (prop.number !== undefined && prop.number !== null) {
    const value = prop.number;
    if (value >= 1 && value <= 5) return value;
  }

  return null;
}

export function getTasksCompletedInPeriod(
  databaseId: string,
  token: string,
  startDate: string,
  endDate: string
): ApiResponse<NotionTask[]> {
  const filter = {
    and: [
      { property: "Status", status: { equals: "Done" } },
      { timestamp: "created_time", created_time: { on_or_after: startDate } },
      { timestamp: "created_time", created_time: { on_or_before: endDate } },
    ],
  };

  return queryDatabase(databaseId, token, filter);
}

/**
 * サイクルタイム計測用：期間内に完了したタスクを取得
 * 着手日と完了日の両方が設定されているタスクのみを返す
 */
export function getTasksForCycleTime(
  databaseId: string,
  token: string,
  startDate: string,
  endDate: string,
  completedDateProperty: string = "Date Done"
): ApiResponse<NotionTask[]> {
  // 完了日が期間内のタスクを取得
  const filter = {
    and: [
      {
        property: completedDateProperty,
        date: { on_or_after: startDate }
      },
      {
        property: completedDateProperty,
        date: { on_or_before: endDate }
      },
    ],
  };

  const response = queryDatabase(databaseId, token, filter);

  if (!response.success || !response.data) {
    return response;
  }

  // 着手日と完了日の両方があるタスクのみをフィルタ
  const tasksWithCycleTime = response.data.filter(
    task => task.startedAt !== null && task.completedAt !== null
  );

  return { success: true, data: tasksWithCycleTime };
}

/**
 * コーディング時間計測用：着手日とPR URLの両方があるタスクを取得
 *
 * @param databaseId - NotionデータベースID
 * @param token - Notion Integration Token
 * @param startedDateProperty - 着手日プロパティ名（デフォルト: "Date Started"）
 */
export function getTasksForCodingTime(
  databaseId: string,
  token: string,
  startedDateProperty: string = "Date Started"
): ApiResponse<NotionTask[]> {
  // 着手日が設定されているタスクを取得
  const filter = {
    property: startedDateProperty,
    date: { is_not_empty: true }
  };

  const response = queryDatabase(databaseId, token, filter);

  if (!response.success || !response.data) {
    return response;
  }

  // 着手日とPR URLの両方があるタスクのみをフィルタ
  const tasksWithPrUrl = response.data.filter(
    task => task.startedAt !== null && task.prUrl !== null
  );

  return { success: true, data: tasksWithPrUrl };
}

/**
 * 開発者満足度計測用：満足度スコアが入力されている完了タスクを取得
 *
 * @param databaseId - NotionデータベースID
 * @param token - Notion Integration Token
 * @param startDate - 期間開始日（ISO形式）
 * @param endDate - 期間終了日（ISO形式）
 * @param completedDateProperty - 完了日プロパティ名（デフォルト: "Date Done"）
 */
export function getTasksForSatisfaction(
  databaseId: string,
  token: string,
  startDate: string,
  endDate: string,
  completedDateProperty: string = "Date Done"
): ApiResponse<NotionTask[]> {
  // 完了日が期間内のタスクを取得
  const filter = {
    and: [
      {
        property: completedDateProperty,
        date: { on_or_after: startDate }
      },
      {
        property: completedDateProperty,
        date: { on_or_before: endDate }
      },
    ],
  };

  const response = queryDatabase(databaseId, token, filter);

  if (!response.success || !response.data) {
    return response;
  }

  // 完了日と満足度スコアの両方があるタスクのみをフィルタ
  const tasksWithSatisfaction = response.data.filter(
    task => task.completedAt !== null && task.satisfactionScore !== null
  );

  return { success: true, data: tasksWithSatisfaction };
}
