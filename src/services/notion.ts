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
      completedAt: extractCompletedAt(props),
      assignee: extractAssignee(props),
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

function extractCompletedAt(props: any): string | null {
  const dateProp = props["Completed"] ?? props["完了日"];
  return dateProp?.date?.start ?? null;
}

function extractAssignee(props: any): string | null {
  const peopleProp = props["Assignee"] ?? props["担当者"];
  return peopleProp?.people?.[0]?.name ?? null;
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
