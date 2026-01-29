/**
 * settings.ts のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { getConfig, setConfig, addRepository, removeRepository, getGitHubAuthMode, getGitHubToken, clearGitHubAppConfig } from "../../src/config/settings";
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
    it("GitHub認証が設定されていない場合はエラーを投げる", () => {
      container.storageClient.setProperty("SPREADSHEET_ID", "test-spreadsheet-id");

      expect(() => getConfig()).toThrow("GitHub authentication not configured");
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
        GITHUB_REPOSITORIES: JSON.stringify([
          { owner: "owner1", name: "repo1", fullName: "owner1/repo1" },
        ]),
      });

      const config = getConfig();

      expect(config.github.token).toBe("test-github-token");
      expect(config.github.repositories).toHaveLength(1);
      expect(config.github.repositories[0].fullName).toBe("owner1/repo1");
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

  describe("getGitHubAuthMode", () => {
    it("GitHub Apps設定がある場合は'app'を返す", () => {
      container.storageClient.setProperties({
        GITHUB_APP_ID: "12345",
        GITHUB_APP_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
        GITHUB_APP_INSTALLATION_ID: "67890",
      });

      expect(getGitHubAuthMode()).toBe("app");
    });

    it("PATのみ設定されている場合は'pat'を返す", () => {
      container.storageClient.setProperties({
        GITHUB_TOKEN: "ghp_test_token",
      });

      expect(getGitHubAuthMode()).toBe("pat");
    });

    it("何も設定されていない場合は'none'を返す", () => {
      expect(getGitHubAuthMode()).toBe("none");
    });

    it("GitHub Apps設定が不完全な場合（APP_IDのみ）は'none'を返す", () => {
      container.storageClient.setProperties({
        GITHUB_APP_ID: "12345",
      });

      // PATも設定されていないので'none'
      expect(getGitHubAuthMode()).toBe("none");
    });

    it("GitHub Apps設定が不完全でもPATがあれば'pat'を返す", () => {
      container.storageClient.setProperties({
        GITHUB_APP_ID: "12345",
        GITHUB_TOKEN: "ghp_test_token",
      });

      // Apps設定が不完全なのでPATにフォールバック
      expect(getGitHubAuthMode()).toBe("pat");
    });
  });

  describe("setConfig with GitHub Apps", () => {
    it("GitHub Apps設定を保存する", () => {
      container.storageClient.setProperty("SPREADSHEET_ID", "test-id");

      setConfig({
        github: {
          appConfig: {
            appId: "12345",
            privateKey: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
            installationId: "67890",
          },
          repositories: [],
        },
      });

      expect(container.storageClient.getProperty("GITHUB_APP_ID")).toBe("12345");
      expect(container.storageClient.getProperty("GITHUB_APP_PRIVATE_KEY")).toBe(
        "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----"
      );
      expect(container.storageClient.getProperty("GITHUB_APP_INSTALLATION_ID")).toBe("67890");
    });
  });

  describe("clearGitHubAppConfig", () => {
    it("GitHub Apps設定をクリアする", () => {
      container.storageClient.setProperties({
        GITHUB_APP_ID: "12345",
        GITHUB_APP_PRIVATE_KEY: "test-key",
        GITHUB_APP_INSTALLATION_ID: "67890",
        GITHUB_TOKEN: "ghp_test_token",
        SPREADSHEET_ID: "test-id",
      });

      clearGitHubAppConfig();

      expect(container.storageClient.getProperty("GITHUB_APP_ID")).toBeNull();
      expect(container.storageClient.getProperty("GITHUB_APP_PRIVATE_KEY")).toBeNull();
      expect(container.storageClient.getProperty("GITHUB_APP_INSTALLATION_ID")).toBeNull();
      // PATは残っている
      expect(container.storageClient.getProperty("GITHUB_TOKEN")).toBe("ghp_test_token");
    });
  });

  describe("getConfig with GitHub Apps", () => {
    it("GitHub Apps設定で正しくconfigを取得する", () => {
      container.storageClient.setProperties({
        GITHUB_APP_ID: "12345",
        GITHUB_APP_PRIVATE_KEY: "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----",
        GITHUB_APP_INSTALLATION_ID: "67890",
        SPREADSHEET_ID: "test-spreadsheet-id",
        GITHUB_REPOSITORIES: JSON.stringify([
          { owner: "owner1", name: "repo1", fullName: "owner1/repo1" },
        ]),
      });

      const config = getConfig();

      expect(config.github.appConfig).toBeDefined();
      expect(config.github.appConfig?.appId).toBe("12345");
      expect(config.github.appConfig?.installationId).toBe("67890");
      expect(config.github.token).toBeUndefined();
      expect(config.github.repositories).toHaveLength(1);
    });
  });
});
