/**
 * スキーママイグレーション機能のテスト
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  createColumnMapping,
  findRemovedColumns,
  migrateData,
  getMigrationPreview,
  migrateSheetSchema,
  updateSheetHeadersOnly,
  isBackupSheet,
} from "../../src/services/migration";
import {
  type SheetSchema,
  type ColumnDefinition,
  getHeadersFromSchema,
} from "../../src/schemas";
import {
  createMockContainer,
  MockSpreadsheet,
} from "../mocks";
import { initializeContainer } from "../../src/container";

// テスト用のスキーマ
const TEST_SCHEMA: SheetSchema = {
  version: "1.0.0",
  sheetName: "Test Sheet",
  columns: [
    { id: "col1", header: "Column 1", type: "string" },
    { id: "col2", header: "Column 2", type: "number", numberFormat: "#,##0" },
    { id: "col3", header: "Column 3", type: "date" },
  ],
};

// 新しいカラムが追加されたスキーマ
const TEST_SCHEMA_WITH_NEW_COLUMN: SheetSchema = {
  version: "1.1.0",
  sheetName: "Test Sheet",
  columns: [
    { id: "col1", header: "Column 1", type: "string" },
    { id: "col2", header: "Column 2", type: "number", numberFormat: "#,##0" },
    { id: "col3", header: "Column 3", type: "date" },
    { id: "col4", header: "Column 4", type: "string", defaultValue: "N/A" },
  ],
};

// 順序が変更されたスキーマ
const TEST_SCHEMA_REORDERED: SheetSchema = {
  version: "1.1.0",
  sheetName: "Test Sheet",
  columns: [
    { id: "col3", header: "Column 3", type: "date" },
    { id: "col1", header: "Column 1", type: "string" },
    { id: "col2", header: "Column 2", type: "number", numberFormat: "#,##0" },
  ],
};

describe("migration", () => {
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    initializeContainer(mockContainer);
  });

  describe("getHeadersFromSchema", () => {
    it("スキーマからヘッダー配列を取得する", () => {
      const headers = getHeadersFromSchema(TEST_SCHEMA);
      expect(headers).toEqual(["Column 1", "Column 2", "Column 3"]);
    });
  });

  describe("createColumnMapping", () => {
    it("同一ヘッダーをマッピングする", () => {
      const oldHeaders = ["Column 1", "Column 2", "Column 3"];
      const mappings = createColumnMapping(oldHeaders, TEST_SCHEMA);

      expect(mappings).toHaveLength(3);
      expect(mappings[0]).toEqual({
        newIndex: 0,
        oldIndex: 0,
        column: TEST_SCHEMA.columns[0],
      });
      expect(mappings[1]).toEqual({
        newIndex: 1,
        oldIndex: 1,
        column: TEST_SCHEMA.columns[1],
      });
      expect(mappings[2]).toEqual({
        newIndex: 2,
        oldIndex: 2,
        column: TEST_SCHEMA.columns[2],
      });
    });

    it("新規カラムを-1でマッピングする", () => {
      const oldHeaders = ["Column 1", "Column 2", "Column 3"];
      const mappings = createColumnMapping(oldHeaders, TEST_SCHEMA_WITH_NEW_COLUMN);

      expect(mappings).toHaveLength(4);
      expect(mappings[3]).toEqual({
        newIndex: 3,
        oldIndex: -1,
        column: TEST_SCHEMA_WITH_NEW_COLUMN.columns[3],
      });
    });

    it("順序が変わった場合も正しくマッピングする", () => {
      const oldHeaders = ["Column 1", "Column 2", "Column 3"];
      const mappings = createColumnMapping(oldHeaders, TEST_SCHEMA_REORDERED);

      expect(mappings).toHaveLength(3);
      // Column 3 は元々index 2にあった
      expect(mappings[0].oldIndex).toBe(2);
      // Column 1 は元々index 0にあった
      expect(mappings[1].oldIndex).toBe(0);
      // Column 2 は元々index 1にあった
      expect(mappings[2].oldIndex).toBe(1);
    });

    it("カラムIDでフォールバックマッピングする", () => {
      // 古いシートがカラムIDをヘッダーとして使っていた場合
      const oldHeaders = ["col1", "col2", "col3"];
      const mappings = createColumnMapping(oldHeaders, TEST_SCHEMA);

      expect(mappings[0].oldIndex).toBe(0);
      expect(mappings[1].oldIndex).toBe(1);
      expect(mappings[2].oldIndex).toBe(2);
    });
  });

  describe("findRemovedColumns", () => {
    it("削除されたカラムを検出する", () => {
      const oldHeaders = ["Column 1", "Column 2", "Column 3", "Old Column"];
      const removed = findRemovedColumns(oldHeaders, TEST_SCHEMA);

      expect(removed).toEqual(["Old Column"]);
    });

    it("削除がない場合は空配列を返す", () => {
      const oldHeaders = ["Column 1", "Column 2", "Column 3"];
      const removed = findRemovedColumns(oldHeaders, TEST_SCHEMA);

      expect(removed).toEqual([]);
    });
  });

  describe("migrateData", () => {
    it("既存データを新しい列順に並べ替える", () => {
      const oldHeaders = ["Column 1", "Column 2", "Column 3"];
      const oldData = [
        oldHeaders,
        ["A", 1, "2024-01-01"],
        ["B", 2, "2024-01-02"],
      ];

      const mappings = createColumnMapping(oldHeaders, TEST_SCHEMA_REORDERED);
      const newData = migrateData(oldData, mappings);

      expect(newData[0]).toEqual(["Column 3", "Column 1", "Column 2"]);
      expect(newData[1]).toEqual(["2024-01-01", "A", 1]);
      expect(newData[2]).toEqual(["2024-01-02", "B", 2]);
    });

    it("新規カラムにデフォルト値を設定する", () => {
      const oldHeaders = ["Column 1", "Column 2", "Column 3"];
      const oldData = [
        oldHeaders,
        ["A", 1, "2024-01-01"],
      ];

      const mappings = createColumnMapping(oldHeaders, TEST_SCHEMA_WITH_NEW_COLUMN);
      const newData = migrateData(oldData, mappings);

      expect(newData[0]).toEqual(["Column 1", "Column 2", "Column 3", "Column 4"]);
      expect(newData[1]).toEqual(["A", 1, "2024-01-01", "N/A"]);
    });

    it("ヘッダー行を正しく生成する", () => {
      const oldHeaders = ["Column 1", "Column 2"];
      const oldData = [oldHeaders];

      const mappings = createColumnMapping(oldHeaders, TEST_SCHEMA);
      const newData = migrateData(oldData, mappings);

      expect(newData[0]).toEqual(["Column 1", "Column 2", "Column 3"]);
    });
  });

  describe("getMigrationPreview", () => {
    it("新規シートの場合はnew_sheetを返す", () => {
      const spreadsheet = new MockSpreadsheet("test");
      const preview = getMigrationPreview(spreadsheet, TEST_SCHEMA);

      expect(preview.status).toBe("new_sheet");
      expect(preview.exists).toBe(false);
      expect(preview.changes.added).toEqual(["Column 1", "Column 2", "Column 3"]);
    });

    it("変更がない場合はup_to_dateを返す", () => {
      const spreadsheet = new MockSpreadsheet("test");
      spreadsheet.addSheet("Test Sheet", [
        ["Column 1", "Column 2", "Column 3"],
        ["A", 1, "2024-01-01"],
      ]);

      const preview = getMigrationPreview(spreadsheet, TEST_SCHEMA);

      expect(preview.status).toBe("up_to_date");
      expect(preview.exists).toBe(true);
      expect(preview.changes.added).toEqual([]);
      expect(preview.changes.removed).toEqual([]);
      expect(preview.changes.reordered).toBe(false);
    });

    it("カラム追加がある場合はmigration_requiredを返す", () => {
      const spreadsheet = new MockSpreadsheet("test");
      spreadsheet.addSheet("Test Sheet", [
        ["Column 1", "Column 2", "Column 3"],
        ["A", 1, "2024-01-01"],
      ]);

      const preview = getMigrationPreview(spreadsheet, TEST_SCHEMA_WITH_NEW_COLUMN);

      expect(preview.status).toBe("migration_required");
      expect(preview.changes.added).toEqual(["Column 4"]);
    });

    it("順序変更がある場合はmigration_requiredを返す", () => {
      const spreadsheet = new MockSpreadsheet("test");
      spreadsheet.addSheet("Test Sheet", [
        ["Column 1", "Column 2", "Column 3"],
        ["A", 1, "2024-01-01"],
      ]);

      const preview = getMigrationPreview(spreadsheet, TEST_SCHEMA_REORDERED);

      expect(preview.status).toBe("migration_required");
      expect(preview.changes.reordered).toBe(true);
    });
  });

  describe("migrateSheetSchema", () => {
    it("新規シートを作成する", () => {
      const spreadsheet = new MockSpreadsheet("test");
      const result = migrateSheetSchema(spreadsheet, TEST_SCHEMA);

      expect(result.success).toBe(true);
      expect(result.status).toBe("created");
      expect(result.columnsAdded).toEqual(["Column 1", "Column 2", "Column 3"]);

      const sheet = spreadsheet.getSheetByName("Test Sheet");
      expect(sheet).not.toBeNull();
    });

    it("既存データを保持したままマイグレーションする", () => {
      const spreadsheet = new MockSpreadsheet("test");
      const sheet = spreadsheet.addSheet("Test Sheet", [
        ["Column 1", "Column 2", "Column 3"],
        ["A", 1, "2024-01-01"],
        ["B", 2, "2024-01-02"],
      ]);

      const result = migrateSheetSchema(spreadsheet, TEST_SCHEMA_WITH_NEW_COLUMN);

      expect(result.success).toBe(true);
      expect(result.status).toBe("migrated");
      expect(result.rowsMigrated).toBe(2);
      expect(result.columnsAdded).toEqual(["Column 4"]);

      const data = (sheet as any).getData();
      expect(data[0]).toEqual(["Column 1", "Column 2", "Column 3", "Column 4"]);
      expect(data[1]).toEqual(["A", 1, "2024-01-01", "N/A"]);
    });

    it("列順を変更してマイグレーションする", () => {
      const spreadsheet = new MockSpreadsheet("test");
      const sheet = spreadsheet.addSheet("Test Sheet", [
        ["Column 1", "Column 2", "Column 3"],
        ["A", 1, "2024-01-01"],
      ]);

      const result = migrateSheetSchema(spreadsheet, TEST_SCHEMA_REORDERED);

      expect(result.success).toBe(true);
      expect(result.status).toBe("migrated");

      const data = (sheet as any).getData();
      expect(data[0]).toEqual(["Column 3", "Column 1", "Column 2"]);
      expect(data[1]).toEqual(["2024-01-01", "A", 1]);
    });

    it("変更がない場合はup_to_dateを返す", () => {
      const spreadsheet = new MockSpreadsheet("test");
      spreadsheet.addSheet("Test Sheet", [
        ["Column 1", "Column 2", "Column 3"],
        ["A", 1, "2024-01-01"],
      ]);

      const result = migrateSheetSchema(spreadsheet, TEST_SCHEMA);

      expect(result.success).toBe(true);
      expect(result.status).toBe("up_to_date");
      expect(result.rowsMigrated).toBe(0);
    });
  });

  describe("updateSheetHeadersOnly", () => {
    it("ヘッダー行のみを更新する", () => {
      const spreadsheet = new MockSpreadsheet("test");
      const sheet = spreadsheet.addSheet("Test Sheet", [
        ["Old Column 1", "Old Column 2", "Old Column 3"],
        ["A", 1, "2024-01-01"],
      ]);

      const result = updateSheetHeadersOnly(spreadsheet, TEST_SCHEMA);

      expect(result.success).toBe(true);
      expect(result.status).toBe("migrated");

      const data = (sheet as any).getData();
      // ヘッダーは更新される
      expect(data[0]).toEqual(["Column 1", "Column 2", "Column 3"]);
      // データ行は変更されない
      expect(data[1]).toEqual(["A", 1, "2024-01-01"]);
    });

    it("シートが存在しない場合はskippedを返す", () => {
      const spreadsheet = new MockSpreadsheet("test");
      const result = updateSheetHeadersOnly(spreadsheet, TEST_SCHEMA);

      expect(result.success).toBe(false);
      expect(result.status).toBe("skipped");
      expect(result.error).toBe("Sheet does not exist");
    });
  });

  describe("isBackupSheet", () => {
    it("バックアップシートを正しく識別する", () => {
      expect(isBackupSheet("_backup_Test Sheet_2024-01-01T12-00-00")).toBe(true);
      expect(isBackupSheet("_backup_DevOps Metrics_2024-01-01T12-00-00")).toBe(true);
    });

    it("通常のシートはfalseを返す", () => {
      expect(isBackupSheet("Test Sheet")).toBe(false);
      expect(isBackupSheet("DevOps Metrics")).toBe(false);
      expect(isBackupSheet("backup_test")).toBe(false); // プレフィックスが違う
    });
  });

  describe("migrateSheetSchema with backup", () => {
    it("マイグレーション時にバックアップシートを作成する", () => {
      const spreadsheet = new MockSpreadsheet("test");
      spreadsheet.addSheet("Test Sheet", [
        ["Column 1", "Column 2", "Column 3"],
        ["A", 1, "2024-01-01"],
      ]);

      // 新しいカラムを追加するマイグレーション
      const result = migrateSheetSchema(spreadsheet, TEST_SCHEMA_WITH_NEW_COLUMN);

      expect(result.success).toBe(true);
      expect(result.status).toBe("migrated");

      // バックアップシートが作成されているかチェック
      // （MockSpreadsheetの内部状態を確認）
      const logs = mockContainer.logger.logs;
      const backupCreated = logs.some((log) => log.includes("Backup created"));
      expect(backupCreated).toBe(true);
    });
  });
});
