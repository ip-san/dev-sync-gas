import type { NotionTask, ApiResponse, NotionPropertyNames } from "../types";
import { DEFAULT_NOTION_PROPERTY_NAMES } from "../types";
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
  filter?: object,
  propertyNames?: Partial<NotionPropertyNames>
): ApiResponse<NotionTask[]> {
  const endpoint = `/databases/${databaseId}/query`;

  const response = fetchNotion<{ results: any[] }>(endpoint, token, {
    method: "post",
    payload: JSON.stringify({ filter, page_size: 100 }),
  });

  if (!response.success || !response.data) {
    return response as ApiResponse<NotionTask[]>;
  }

  // カスタムプロパティ名をデフォルトとマージ
  const propNames: NotionPropertyNames = {
    ...DEFAULT_NOTION_PROPERTY_NAMES,
    ...propertyNames,
  };

  const tasks: NotionTask[] = response.data.results.map((page) => {
    const props = page.properties;
    return {
      id: page.id,
      title: extractTitle(props),
      status: extractStatus(props),
      createdAt: page.created_time,
      startedAt: extractStartedAt(props, propNames.startedDate),
      completedAt: extractCompletedAt(props, propNames.completedDate),
      prUrl: extractPrUrl(props, propNames.prUrl),
      assignee: extractAssignee(props),
      satisfactionScore: extractSatisfactionScore(props, propNames.satisfaction),
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

function extractStartedAt(props: any, customName?: string): string | null {
  // カスタム名が指定されている場合は優先
  if (customName && props[customName]?.date?.start) {
    return props[customName].date.start;
  }
  // フォールバック: 一般的なプロパティ名を試す
  const dateProp = props["Date Started"] ?? props["Started"] ?? props["着手日"] ?? props["開始日"];
  return dateProp?.date?.start ?? null;
}

function extractCompletedAt(props: any, customName?: string): string | null {
  // カスタム名が指定されている場合は優先
  if (customName && props[customName]?.date?.start) {
    return props[customName].date.start;
  }
  // フォールバック: 一般的なプロパティ名を試す
  const dateProp = props["Date Done"] ?? props["Completed"] ?? props["完了日"] ?? props["Done"];
  return dateProp?.date?.start ?? null;
}

function extractAssignee(props: any): string | null {
  const peopleProp = props["Assignee"] ?? props["担当者"];
  return peopleProp?.people?.[0]?.name ?? null;
}

function extractPrUrl(props: any, customName?: string): string | null {
  // カスタム名が指定されている場合は優先
  if (customName && props[customName]?.url) {
    return props[customName].url;
  }
  // フォールバック: 一般的なプロパティ名を試す
  const urlProp = props["PR URL"] ?? props["PR"] ?? props["Pull Request"] ?? props["GitHub PR"];
  return urlProp?.url ?? null;
}

function extractSatisfactionScore(props: any, customName?: string): number | null {
  // カスタム名が指定されている場合は優先、なければフォールバック
  let prop = null;
  if (customName && props[customName]) {
    prop = props[customName];
  } else {
    // フォールバック: 一般的なプロパティ名を試す
    prop = props["満足度"] ?? props["Satisfaction"] ?? props["満足度スコア"] ?? props["Score"];
  }
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
  endDate: string,
  propertyNames?: Partial<NotionPropertyNames>
): ApiResponse<NotionTask[]> {
  const filter = {
    and: [
      { property: "Status", status: { equals: "Done" } },
      { timestamp: "created_time", created_time: { on_or_after: startDate } },
      { timestamp: "created_time", created_time: { on_or_before: endDate } },
    ],
  };

  return queryDatabase(databaseId, token, filter, propertyNames);
}

/**
 * サイクルタイム計測用：期間内に完了したタスクを取得
 * 着手日と完了日の両方が設定されているタスクのみを返す
 *
 * @param propertyNames - カスタムプロパティ名（オプション）
 */
export function getTasksForCycleTime(
  databaseId: string,
  token: string,
  startDate: string,
  endDate: string,
  propertyNames?: Partial<NotionPropertyNames>
): ApiResponse<NotionTask[]> {
  const completedDateProp = propertyNames?.completedDate ?? DEFAULT_NOTION_PROPERTY_NAMES.completedDate;

  // 完了日が期間内のタスクを取得
  const filter = {
    and: [
      {
        property: completedDateProp,
        date: { on_or_after: startDate }
      },
      {
        property: completedDateProp,
        date: { on_or_before: endDate }
      },
    ],
  };

  const response = queryDatabase(databaseId, token, filter, propertyNames);

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
 * @param propertyNames - カスタムプロパティ名（オプション）
 */
export function getTasksForCodingTime(
  databaseId: string,
  token: string,
  propertyNames?: Partial<NotionPropertyNames>
): ApiResponse<NotionTask[]> {
  const startedDateProp = propertyNames?.startedDate ?? DEFAULT_NOTION_PROPERTY_NAMES.startedDate;

  // 着手日が設定されているタスクを取得
  const filter = {
    property: startedDateProp,
    date: { is_not_empty: true }
  };

  const response = queryDatabase(databaseId, token, filter, propertyNames);

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
 * @param propertyNames - カスタムプロパティ名（オプション）
 */
export function getTasksForSatisfaction(
  databaseId: string,
  token: string,
  startDate: string,
  endDate: string,
  propertyNames?: Partial<NotionPropertyNames>
): ApiResponse<NotionTask[]> {
  const completedDateProp = propertyNames?.completedDate ?? DEFAULT_NOTION_PROPERTY_NAMES.completedDate;

  // 完了日が期間内のタスクを取得
  const filter = {
    and: [
      {
        property: completedDateProp,
        date: { on_or_after: startDate }
      },
      {
        property: completedDateProp,
        date: { on_or_before: endDate }
      },
    ],
  };

  const response = queryDatabase(databaseId, token, filter, propertyNames);

  if (!response.success || !response.data) {
    return response;
  }

  // 完了日と満足度スコアの両方があるタスクのみをフィルタ
  const tasksWithSatisfaction = response.data.filter(
    task => task.completedAt !== null && task.satisfactionScore !== null
  );

  return { success: true, data: tasksWithSatisfaction };
}
