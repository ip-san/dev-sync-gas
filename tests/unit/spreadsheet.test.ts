/**
 * spreadsheet.ts のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  writeMetricsToSheet,
  clearOldData,
  createSummarySheet,
} from "../../src/services/spreadsheet";
import { setupTestContainer, teardownTestContainer, type TestContainer } from "../helpers/setup";
import type { DevOpsMetrics } from "../../src/types";
import { MockSheet } from "../mocks";

describe("spreadsheet", () => {
  let container: TestContainer;

  beforeEach(() => {
    container = setupTestContainer();
  });

  afterEach(() => {
    teardownTestContainer();
  });

  describe("writeMetricsToSheet", () => {
    const testMetrics: DevOpsMetrics[] = [
      {
        date: "2024-01-01",
        repository: "owner/repo",
        deploymentCount: 10,
        deploymentFrequency: "daily",
        leadTimeForChangesHours: 2.5,
        totalDeployments: 12,
        failedDeployments: 2,
        changeFailureRate: 16.7,
        meanTimeToRecoveryHours: 1.5,
      },
    ];

    it("シートがない場合は新規作成する", () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-id");

      writeMetricsToSheet("test-id", "Test Sheet", testMetrics);

      const sheet = spreadsheet.getSheetByName("Test Sheet") as MockSheet;
      expect(sheet).not.toBeNull();
      expect(sheet!.getFrozenRows()).toBe(1);
    });

    it("ヘッダー行を設定する", () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-id");

      writeMetricsToSheet("test-id", "Test Sheet", testMetrics);

      const sheet = spreadsheet.getSheetByName("Test Sheet") as MockSheet;
      const data = sheet!.getData();
      expect(data[0]).toEqual([
        "Date",
        "Repository",
        "Deployment Count",
        "Deployment Frequency",
        "Lead Time (hours)",
        "Total Deployments",
        "Failed Deployments",
        "Change Failure Rate (%)",
        "MTTR (hours)",
      ]);
    });

    it("メトリクスデータを書き込む", () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-id");

      writeMetricsToSheet("test-id", "Test Sheet", testMetrics);

      const sheet = spreadsheet.getSheetByName("Test Sheet") as MockSheet;
      const data = sheet!.getData();
      expect(data[1]).toEqual([
        "2024-01-01",
        "owner/repo",
        10,
        "daily",
        2.5,
        12,
        2,
        16.7,
        1.5,
      ]);
    });

    it("MTTRがnullの場合はN/Aを書き込む", () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-id");
      const metricsWithNullMTTR: DevOpsMetrics[] = [
        {
          ...testMetrics[0],
          meanTimeToRecoveryHours: null,
        },
      ];

      writeMetricsToSheet("test-id", "Test Sheet", metricsWithNullMTTR);

      const sheet = spreadsheet.getSheetByName("Test Sheet") as MockSheet;
      const data = sheet!.getData();
      expect(data[1][8]).toBe("N/A");
    });

    it("空のメトリクスの場合はログを出力して終了", () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-id");

      writeMetricsToSheet("test-id", "Test Sheet", []);

      expect(container.logger.logs).toContain("⚠️ No metrics to write");
    });

    it("既存シートに追記する", () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-id");
      const sheet = spreadsheet.addSheet("Test Sheet", [
        ["Date", "Repository", "Deployment Count", "Deployment Frequency", "Lead Time (hours)", "Total Deployments", "Failed Deployments", "Change Failure Rate (%)", "MTTR (hours)"],
        ["2024-01-01", "owner/repo1", 5, "weekly", 3.0, 6, 1, 16.7, 2.0],
      ]);

      writeMetricsToSheet("test-id", "Test Sheet", testMetrics);

      const data = sheet.getData();
      expect(data).toHaveLength(3); // ヘッダー + 既存データ + 新規データ
      expect(data[2][1]).toBe("owner/repo");
    });
  });

  describe("clearOldData", () => {
    it("古いデータを削除する", () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-id");
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100日前
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30); // 30日前

      const sheet = spreadsheet.addSheet("Test Sheet", [
        ["Date", "Repository", "Data"],
        [oldDate.toISOString(), "owner/old-repo", "old data"],
        [recentDate.toISOString(), "owner/recent-repo", "recent data"],
      ]);

      clearOldData("test-id", "Test Sheet", 90);

      const data = sheet.getData();
      expect(data).toHaveLength(2); // ヘッダー + 最近のデータ
      expect(data[1][1]).toBe("owner/recent-repo");
    });

    it("シートが存在しない場合は何もしない", () => {
      container.spreadsheetClient.addSpreadsheet("test-id");

      // エラーが発生しないことを確認
      expect(() => clearOldData("test-id", "NonExistent Sheet", 90)).not.toThrow();
    });

    it("全てのデータが新しい場合は削除しない", () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-id");
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);

      const sheet = spreadsheet.addSheet("Test Sheet", [
        ["Date", "Repository", "Data"],
        [recentDate.toISOString(), "owner/repo1", "data1"],
        [recentDate.toISOString(), "owner/repo2", "data2"],
      ]);

      clearOldData("test-id", "Test Sheet", 90);

      const data = sheet.getData();
      expect(data).toHaveLength(3);
    });
  });

  describe("createSummarySheet", () => {
    it("サマリーシートを新規作成する", () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-id");
      spreadsheet.addSheet("Source Sheet", [["Header1", "Header2"]]);

      createSummarySheet("test-id", "Source Sheet");

      const summarySheet = spreadsheet.getSheetByName("Source Sheet - Summary");
      expect(summarySheet).not.toBeNull();
    });

    it("サマリーヘッダーを設定する", () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-id");
      spreadsheet.addSheet("Source Sheet", [["Header1", "Header2"]]);

      createSummarySheet("test-id", "Source Sheet");

      const summarySheet = spreadsheet.getSheetByName("Source Sheet - Summary") as MockSheet;
      const data = summarySheet!.getData();
      expect(data[0]).toEqual([
        "Repository",
        "Avg Deployment Freq",
        "Avg Lead Time (hours)",
        "Avg Change Failure Rate (%)",
        "Avg MTTR (hours)",
        "Last Updated",
      ]);
    });

    it("既存のサマリーシートをクリアして再作成する", () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-id");
      spreadsheet.addSheet("Source Sheet", [["Header"]]);
      const existingSummary = spreadsheet.addSheet("Source Sheet - Summary", [
        ["Old Header"],
        ["Old Data"],
      ]);

      createSummarySheet("test-id", "Source Sheet");

      const data = existingSummary.getData();
      expect(data[0][0]).toBe("Repository"); // 新しいヘッダー
    });

    it("ソースシートがない場合はヘッダーのみ設定", () => {
      const spreadsheet = container.spreadsheetClient.addSpreadsheet("test-id");

      createSummarySheet("test-id", "NonExistent Sheet");

      // サマリーシートは作成されるがデータなし
      const summarySheet = spreadsheet.getSheetByName("NonExistent Sheet - Summary");
      expect(summarySheet).not.toBeNull();
    });
  });
});
