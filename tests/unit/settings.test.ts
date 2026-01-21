/**
 * settings.ts のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getConfig, setConfig, addRepository, removeRepository } from "../../src/config/settings";
import { setupTestContainer, teardownTestContainer, type TestContainer } from "../helpers/setup";

describe("settings", () => {
  let container: TestContainer;

  beforeEach(() => {
    container = setupTestContainer();
  });

  afterEach(() => {
    teardownTestContainer();
  });

  describe("getConfig", () => {
    it("GITHUB_TOKENがない場合はエラーを投げる", () => {
      container.storageClient.setProperty("SPREADSHEET_ID", "test-spreadsheet-id");

      expect(() => getConfig()).toThrow("GITHUB_TOKEN is not set");
    });

    it("SPREADSHEET_IDがない場合はエラーを投げる", () => {
      container.storageClient.setProperty("GITHUB_TOKEN", "test-token");

      expect(() => getConfig()).toThrow("SPREADSHEET_ID is not set");
    });

    it("設定を正しく取得する", () => {
      container.storageClient.setProperties({
        GITHUB_TOKEN: "test-github-token",
        SPREADSHEET_ID: "test-spreadsheet-id",
        SHEET_NAME: "Test Sheet",
        NOTION_TOKEN: "test-notion-token",
        NOTION_DATABASE_ID: "test-database-id",
        GITHUB_REPOSITORIES: JSON.stringify([
          { owner: "owner1", name: "repo1", fullName: "owner1/repo1" },
        ]),
      });

      const config = getConfig();

      expect(config.github.token).toBe("test-github-token");
      expect(config.github.repositories).toHaveLength(1);
      expect(config.github.repositories[0].fullName).toBe("owner1/repo1");
      expect(config.notion.token).toBe("test-notion-token");
      expect(config.notion.databaseId).toBe("test-database-id");
      expect(config.spreadsheet.id).toBe("test-spreadsheet-id");
      expect(config.spreadsheet.sheetName).toBe("Test Sheet");
    });

    it("SHEET_NAMEがない場合はデフォルト値を使用", () => {
      container.storageClient.setProperties({
        GITHUB_TOKEN: "test-token",
        SPREADSHEET_ID: "test-id",
      });

      const config = getConfig();

      expect(config.spreadsheet.sheetName).toBe("DevOps Metrics");
    });

    it("リポジトリがない場合は空配列を返す", () => {
      container.storageClient.setProperties({
        GITHUB_TOKEN: "test-token",
        SPREADSHEET_ID: "test-id",
      });

      const config = getConfig();

      expect(config.github.repositories).toEqual([]);
    });
  });

  describe("setConfig", () => {
    it("GitHub設定を保存する", () => {
      container.storageClient.setProperties({
        GITHUB_TOKEN: "old-token",
        SPREADSHEET_ID: "test-id",
      });

      setConfig({
        github: {
          token: "new-token",
          repositories: [{ owner: "owner", name: "repo", fullName: "owner/repo" }],
        },
      });

      expect(container.storageClient.getProperty("GITHUB_TOKEN")).toBe("new-token");
      expect(container.storageClient.getProperty("GITHUB_REPOSITORIES")).toBe(
        JSON.stringify([{ owner: "owner", name: "repo", fullName: "owner/repo" }])
      );
    });

    it("Notion設定を保存する", () => {
      container.storageClient.setProperties({
        GITHUB_TOKEN: "test-token",
        SPREADSHEET_ID: "test-id",
      });

      setConfig({
        notion: {
          token: "notion-token",
          databaseId: "database-id",
        },
      });

      expect(container.storageClient.getProperty("NOTION_TOKEN")).toBe("notion-token");
      expect(container.storageClient.getProperty("NOTION_DATABASE_ID")).toBe("database-id");
    });

    it("スプレッドシート設定を保存する", () => {
      container.storageClient.setProperties({
        GITHUB_TOKEN: "test-token",
        SPREADSHEET_ID: "old-id",
      });

      setConfig({
        spreadsheet: {
          id: "new-spreadsheet-id",
          sheetName: "New Sheet Name",
        },
      });

      expect(container.storageClient.getProperty("SPREADSHEET_ID")).toBe("new-spreadsheet-id");
      expect(container.storageClient.getProperty("SHEET_NAME")).toBe("New Sheet Name");
    });

    it("部分的な更新が可能", () => {
      container.storageClient.setProperties({
        GITHUB_TOKEN: "original-token",
        SPREADSHEET_ID: "original-id",
        SHEET_NAME: "Original Sheet",
      });

      setConfig({
        spreadsheet: {
          id: "new-id",
          sheetName: "Original Sheet",
        },
      });

      // 変更されたもの
      expect(container.storageClient.getProperty("SPREADSHEET_ID")).toBe("new-id");
      // 変更されていないもの
      expect(container.storageClient.getProperty("GITHUB_TOKEN")).toBe("original-token");
    });
  });

  describe("addRepository", () => {
    beforeEach(() => {
      container.storageClient.setProperties({
        GITHUB_TOKEN: "test-token",
        SPREADSHEET_ID: "test-id",
        GITHUB_REPOSITORIES: JSON.stringify([]),
      });
    });

    it("新しいリポジトリを追加する", () => {
      addRepository("owner", "repo");

      const repos = JSON.parse(
        container.storageClient.getProperty("GITHUB_REPOSITORIES") ?? "[]"
      );
      expect(repos).toHaveLength(1);
      expect(repos[0]).toEqual({
        owner: "owner",
        name: "repo",
        fullName: "owner/repo",
      });
    });

    it("同じリポジトリは重複追加しない", () => {
      addRepository("owner", "repo");
      addRepository("owner", "repo");

      const repos = JSON.parse(
        container.storageClient.getProperty("GITHUB_REPOSITORIES") ?? "[]"
      );
      expect(repos).toHaveLength(1);
    });

    it("複数のリポジトリを追加できる", () => {
      addRepository("owner1", "repo1");
      addRepository("owner2", "repo2");

      const repos = JSON.parse(
        container.storageClient.getProperty("GITHUB_REPOSITORIES") ?? "[]"
      );
      expect(repos).toHaveLength(2);
      expect(repos[0].fullName).toBe("owner1/repo1");
      expect(repos[1].fullName).toBe("owner2/repo2");
    });
  });

  describe("removeRepository", () => {
    beforeEach(() => {
      container.storageClient.setProperties({
        GITHUB_TOKEN: "test-token",
        SPREADSHEET_ID: "test-id",
        GITHUB_REPOSITORIES: JSON.stringify([
          { owner: "owner1", name: "repo1", fullName: "owner1/repo1" },
          { owner: "owner2", name: "repo2", fullName: "owner2/repo2" },
        ]),
      });
    });

    it("リポジトリを削除する", () => {
      removeRepository("owner1/repo1");

      const repos = JSON.parse(
        container.storageClient.getProperty("GITHUB_REPOSITORIES") ?? "[]"
      );
      expect(repos).toHaveLength(1);
      expect(repos[0].fullName).toBe("owner2/repo2");
    });

    it("存在しないリポジトリを削除しても問題ない", () => {
      removeRepository("owner3/repo3");

      const repos = JSON.parse(
        container.storageClient.getProperty("GITHUB_REPOSITORIES") ?? "[]"
      );
      expect(repos).toHaveLength(2);
    });
  });
});
