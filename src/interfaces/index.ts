/**
 * 抽象インターフェース定義
 * GAS固有APIへの依存を排除し、テスト可能な構造にする
 */

// HTTP通信の抽象化
export interface HttpRequestOptions {
  method?: "get" | "post" | "put" | "patch" | "delete";
  headers?: Record<string, string>;
  payload?: string;
  muteHttpExceptions?: boolean;
}

export interface HttpResponse<T = unknown> {
  statusCode: number;
  content: string;
  data?: T;
}

export interface HttpClient {
  fetch<T = unknown>(url: string, options?: HttpRequestOptions): HttpResponse<T>;
}

// スプレッドシートの抽象化
export interface SheetRange {
  getValues(): unknown[][];
  setValues(values: unknown[][]): void;
  setFontWeight(weight: string): void;
  setNumberFormat(format: string): void;
}

export interface Sheet {
  getName(): string;
  getRange(row: number, col: number, numRows?: number, numCols?: number): SheetRange;
  getDataRange(): SheetRange;
  getLastRow(): number;
  getLastColumn(): number;
  setFrozenRows(rows: number): void;
  autoResizeColumn(col: number): void;
  deleteRow(row: number): void;
  clear(): void;
}

export interface Spreadsheet {
  getName(): string;
  getSheetByName(name: string): Sheet | null;
  insertSheet(name: string): Sheet;
}

export interface SpreadsheetClient {
  openById(id: string): Spreadsheet;
}

// ストレージの抽象化
export interface StorageClient {
  getProperty(key: string): string | null;
  setProperty(key: string, value: string): void;
  deleteProperty(key: string): void;
  getProperties(): Record<string, string>;
}

// ロガーの抽象化
export interface LoggerClient {
  log(message: string): void;
}

// トリガーの抽象化
export interface Trigger {
  getHandlerFunction(): string;
}

export interface TriggerBuilder {
  timeBased(): TimeTriggerBuilder;
}

export interface TimeTriggerBuilder {
  everyDays(days: number): TimeTriggerBuilder;
  atHour(hour: number): TimeTriggerBuilder;
  create(): Trigger;
}

export interface TriggerClient {
  getProjectTriggers(): Trigger[];
  deleteTrigger(trigger: Trigger): void;
  newTrigger(functionName: string): TriggerBuilder;
}

// サービスコンテナの型
export interface ServiceContainer {
  httpClient: HttpClient;
  spreadsheetClient: SpreadsheetClient;
  storageClient: StorageClient;
  logger: LoggerClient;
  triggerClient: TriggerClient;
}
