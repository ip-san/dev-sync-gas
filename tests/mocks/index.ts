/**
 * テスト用モック実装
 */

import type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
  SpreadsheetClient,
  Spreadsheet,
  Sheet,
  SheetRange,
  StorageClient,
  LoggerClient,
  TriggerClient,
  Trigger,
  TriggerBuilder,
  TimeTriggerBuilder,
  ServiceContainer,
  EmbeddedChart,
  SlackClient,
  SlackMessage,
} from '../../src/interfaces';

// Mock HTTP Client
export interface MockHttpCall {
  url: string;
  options?: HttpRequestOptions;
}

export class MockHttpClient implements HttpClient {
  private responses: Map<string, HttpResponse> = new Map();
  private responseCallbacks: Map<string, () => HttpResponse> = new Map();
  public calls: MockHttpCall[] = [];

  setResponse(url: string, response: HttpResponse): void {
    this.responses.set(url, response);
  }

  setJsonResponse<T>(url: string, statusCode: number, data: T): void {
    this.responses.set(url, {
      statusCode,
      content: JSON.stringify(data),
      data,
    });
  }

  setResponseCallback(url: string, callback: () => HttpResponse): void {
    this.responseCallbacks.set(url, callback);
  }

  fetch<T = unknown>(url: string, options?: HttpRequestOptions): HttpResponse<T> {
    this.calls.push({ url, options });

    // コールバックが設定されている場合はそれを使用
    const callback = this.responseCallbacks.get(url);
    if (callback) {
      return callback() as HttpResponse<T>;
    }

    const response = this.responses.get(url);
    if (response) {
      return response as HttpResponse<T>;
    }

    // デフォルトは404
    return {
      statusCode: 404,
      content: 'Not Found',
    };
  }

  reset(): void {
    this.responses.clear();
    this.responseCallbacks.clear();
    this.calls = [];
  }
}

// Mock Sheet Range
export class MockSheetRange implements SheetRange {
  private values: unknown[][] = [];
  private fontWeight: string = '';
  private numberFormat: string = '';
  private backgroundColor: string | null = null;
  private fontColor: string = '';
  private horizontalAlignment: string = '';
  private verticalAlignment: string = '';
  private fontSize: number = 10;
  private wrap: boolean = false;

  constructor(initialValues: unknown[][] = []) {
    this.values = initialValues;
  }

  getValues(): unknown[][] {
    return this.values;
  }

  getValue(): unknown {
    return this.values[0]?.[0] ?? '';
  }

  setValues(values: unknown[][]): void {
    this.values = values;
  }

  setValue(value: unknown): void {
    if (!this.values[0]) {
      this.values[0] = [];
    }
    this.values[0][0] = value;
  }

  setFontWeight(weight: string): void {
    this.fontWeight = weight;
  }

  setNumberFormat(format: string): void {
    this.numberFormat = format;
  }

  setBackground(color: string | null): void {
    this.backgroundColor = color;
  }

  setFontColor(color: string): void {
    this.fontColor = color;
  }

  setBorder(
    _top: boolean | null,
    _left: boolean | null,
    _bottom: boolean | null,
    _right: boolean | null,
    _vertical: boolean | null,
    _horizontal: boolean | null,
    _color?: string | null,
    _style?: string | null
  ): void {
    // Mock implementation - no-op for testing
  }

  setHorizontalAlignment(alignment: 'left' | 'center' | 'right'): void {
    this.horizontalAlignment = alignment;
  }

  setVerticalAlignment(alignment: 'top' | 'middle' | 'bottom'): void {
    this.verticalAlignment = alignment;
  }

  setFontSize(size: number): void {
    this.fontSize = size;
  }

  setWrap(wrap: boolean): void {
    this.wrap = wrap;
  }

  // Test helpers
  getFontWeight(): string {
    return this.fontWeight;
  }

  getNumberFormat(): string {
    return this.numberFormat;
  }

  getBackgroundColor(): string | null {
    return this.backgroundColor;
  }

  getFontColor(): string {
    return this.fontColor;
  }

  getHorizontalAlignment(): string {
    return this.horizontalAlignment;
  }

  getFontSize(): number {
    return this.fontSize;
  }
}

// Mock Embedded Chart
export class MockEmbeddedChart implements EmbeddedChart {
  private chartId: number;

  constructor(chartId: number = 1) {
    this.chartId = chartId;
  }

  getChartId(): number | null {
    return this.chartId;
  }

  getOptions(): null {
    return null;
  }
}

// Mock Sheet
export class MockSheet implements Sheet {
  private name: string;
  private data: unknown[][] = [];
  private frozenRows: number = 0;
  private resizedColumns: number[] = [];
  private charts: EmbeddedChart[] = [];

  constructor(name: string, initialData: unknown[][] = []) {
    this.name = name;
    this.data = initialData;
  }

  getName(): string {
    return this.name;
  }

  setName(name: string): void {
    this.name = name;
  }

  getRange(row: number, col: number, numRows?: number, numCols?: number): SheetRange {
    // 1-indexed to 0-indexed
    const startRow = row - 1;
    const startCol = col - 1;
    const rows = numRows ?? 1;
    const cols = numCols ?? 1;

    const rangeData: unknown[][] = [];
    for (let r = 0; r < rows; r++) {
      const rowData: unknown[] = [];
      for (let c = 0; c < cols; c++) {
        const dataRow = this.data[startRow + r];
        rowData.push(dataRow?.[startCol + c] ?? '');
      }
      rangeData.push(rowData);
    }

    const range = new MockSheetRange(rangeData);
    // Override setValues to update the actual sheet data
    const originalSetValues = range.setValues.bind(range);
    range.setValues = (values: unknown[][]) => {
      originalSetValues(values);
      for (let r = 0; r < values.length; r++) {
        if (!this.data[startRow + r]) {
          this.data[startRow + r] = [];
        }
        for (let c = 0; c < values[r].length; c++) {
          this.data[startRow + r][startCol + c] = values[r][c];
        }
      }
    };
    return range;
  }

  getDataRange(): SheetRange {
    // Return a range that maintains reference to the sheet's data
    const range = new MockSheetRange(this.data);
    // Override setValues to update the actual sheet data
    range.setValues = (values: unknown[][]) => {
      for (let r = 0; r < values.length; r++) {
        if (!this.data[r]) {
          this.data[r] = [];
        }
        for (let c = 0; c < values[r].length; c++) {
          this.data[r][c] = values[r][c];
        }
      }
    };
    return range;
  }

  getLastRow(): number {
    return this.data.length;
  }

  getLastColumn(): number {
    return this.data.length > 0 ? Math.max(...this.data.map((row) => row.length)) : 0;
  }

  setFrozenRows(rows: number): void {
    this.frozenRows = rows;
  }

  autoResizeColumn(col: number): void {
    this.resizedColumns.push(col);
  }

  deleteRow(row: number): void {
    this.data.splice(row - 1, 1);
  }

  clear(): void {
    this.data = [];
    this.charts = [];
  }

  // チャート関連メソッド
  getCharts(): EmbeddedChart[] {
    return this.charts;
  }

  insertChart(chart: EmbeddedChart): void {
    this.charts.push(chart);
  }

  removeChart(chart: EmbeddedChart): void {
    const index = this.charts.indexOf(chart);
    if (index !== -1) {
      this.charts.splice(index, 1);
    }
  }

  // Test helpers
  getData(): unknown[][] {
    return this.data;
  }

  getFrozenRows(): number {
    return this.frozenRows;
  }
}

// Mock Spreadsheet
export class MockSpreadsheet implements Spreadsheet {
  private name: string;
  private sheets: Map<string, MockSheet> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  getName(): string {
    return this.name;
  }

  getSheetByName(name: string): Sheet | null {
    return this.sheets.get(name) ?? null;
  }

  insertSheet(name: string): Sheet {
    const sheet = new MockSheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }

  deleteSheet(sheet: Sheet): void {
    this.sheets.delete(sheet.getName());
  }

  setActiveSheet(_sheet: Sheet): void {
    // Mock implementation - no-op for testing
  }

  moveActiveSheet(_position: number): void {
    // Mock implementation - no-op for testing
  }

  getId(): string {
    return this.name;
  }

  // Test helper to add pre-existing sheet
  addSheet(name: string, data: unknown[][] = []): MockSheet {
    const sheet = new MockSheet(name, data);
    this.sheets.set(name, sheet);
    return sheet;
  }
}

// Mock Spreadsheet Client
export class MockSpreadsheetClient implements SpreadsheetClient {
  private spreadsheets: Map<string, MockSpreadsheet> = new Map();

  openById(id: string): Spreadsheet {
    let spreadsheet = this.spreadsheets.get(id);
    if (!spreadsheet) {
      spreadsheet = new MockSpreadsheet(id);
      this.spreadsheets.set(id, spreadsheet);
    }
    return spreadsheet;
  }

  // Test helper
  getSpreadsheet(id: string): MockSpreadsheet | undefined {
    return this.spreadsheets.get(id);
  }

  addSpreadsheet(id: string): MockSpreadsheet {
    const spreadsheet = new MockSpreadsheet(id);
    this.spreadsheets.set(id, spreadsheet);
    return spreadsheet;
  }
}

// Mock Storage Client
export class MockStorageClient implements StorageClient {
  private storage: Map<string, string> = new Map();

  getProperty(key: string): string | null {
    return this.storage.get(key) ?? null;
  }

  setProperty(key: string, value: string): void {
    this.storage.set(key, value);
  }

  deleteProperty(key: string): void {
    this.storage.delete(key);
  }

  getProperties(): Record<string, string> {
    const result: Record<string, string> = {};
    this.storage.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  // Test helpers
  clear(): void {
    this.storage.clear();
  }

  setProperties(props: Record<string, string>): void {
    Object.entries(props).forEach(([key, value]) => {
      this.storage.set(key, value);
    });
  }
}

// Mock Logger Client
export class MockLoggerClient implements LoggerClient {
  public logs: string[] = [];

  log(message: string): void {
    this.logs.push(`[INFO] ${message}`);
  }

  debug(message: string): void {
    this.logs.push(`[DEBUG] ${message}`);
  }

  info(message: string): void {
    this.logs.push(`[INFO] ${message}`);
  }

  warn(message: string): void {
    this.logs.push(`[WARN] ${message}`);
  }

  error(message: string): void {
    this.logs.push(`[ERROR] ${message}`);
  }

  clear(): void {
    this.logs = [];
  }

  getLastLog(): string | undefined {
    return this.logs[this.logs.length - 1];
  }
}

// Mock Trigger
export class MockTrigger implements Trigger {
  constructor(private handlerFunction: string) {}

  getHandlerFunction(): string {
    return this.handlerFunction;
  }
}

// Mock Trigger Builder
export class MockTimeTriggerBuilder implements TimeTriggerBuilder {
  private days: number = 1;
  private weeks: number = 1;
  private weekDay: GoogleAppsScript.Base.Weekday | null = null;
  private hour: number = 0;

  constructor(
    private functionName: string,
    private client: MockTriggerClient
  ) {}

  everyDays(days: number): TimeTriggerBuilder {
    this.days = days;
    return this;
  }

  everyWeeks(weeks: number): TimeTriggerBuilder {
    this.weeks = weeks;
    return this;
  }

  onWeekDay(day: GoogleAppsScript.Base.Weekday): TimeTriggerBuilder {
    this.weekDay = day;
    return this;
  }

  atHour(hour: number): TimeTriggerBuilder {
    this.hour = hour;
    return this;
  }

  create(): Trigger {
    const trigger = new MockTrigger(this.functionName);
    this.client.addTrigger(trigger);
    return trigger;
  }
}

export class MockTriggerBuilder implements TriggerBuilder {
  constructor(
    private functionName: string,
    private client: MockTriggerClient
  ) {}

  timeBased(): TimeTriggerBuilder {
    return new MockTimeTriggerBuilder(this.functionName, this.client);
  }
}

// Mock Trigger Client
export class MockTriggerClient implements TriggerClient {
  private triggers: MockTrigger[] = [];

  getProjectTriggers(): Trigger[] {
    return [...this.triggers];
  }

  deleteTrigger(trigger: Trigger): void {
    const index = this.triggers.findIndex(
      (t) => t.getHandlerFunction() === trigger.getHandlerFunction()
    );
    if (index >= 0) {
      this.triggers.splice(index, 1);
    }
  }

  newTrigger(functionName: string): TriggerBuilder {
    return new MockTriggerBuilder(functionName, this);
  }

  // Test helper
  addTrigger(trigger: MockTrigger): void {
    this.triggers.push(trigger);
  }

  clear(): void {
    this.triggers = [];
  }
}

// Mock Slack Client
export class MockSlackClient implements SlackClient {
  public sentMessages: SlackMessage[] = [];

  sendMessage(message: SlackMessage): void {
    this.sentMessages.push(message);
  }

  // Test helper
  getLastMessage(): SlackMessage | undefined {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  clear(): void {
    this.sentMessages = [];
  }
}

// Factory function to create all mocks
export function createMockContainer(): ServiceContainer & {
  httpClient: MockHttpClient;
  spreadsheetClient: MockSpreadsheetClient;
  storageClient: MockStorageClient;
  logger: MockLoggerClient;
  triggerClient: MockTriggerClient;
  slackClient: MockSlackClient;
  spreadsheetId: string;
} {
  const spreadsheetId = 'mock-spreadsheet-id';
  return {
    httpClient: new MockHttpClient(),
    spreadsheetClient: new MockSpreadsheetClient(),
    storageClient: new MockStorageClient(),
    logger: new MockLoggerClient(),
    triggerClient: new MockTriggerClient(),
    slackClient: new MockSlackClient(),
    spreadsheetId,
  };
}
