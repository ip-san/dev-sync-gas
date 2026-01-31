/**
 * githubAuth.ts のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { generateJWT, resolveGitHubToken, clearTokenCache } from "../../src/services/githubAuth";
import { setupTestContainer, teardownTestContainer, type TestContainer } from "../helpers/setup";

// テスト用のRSA秘密鍵（本番では使用しないでください）
const TEST_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MJvMOB1FBYdaFOa7
GqJ7k9bJKPAm8GZBNBfPNLD9YXDR+VoNmKzHSWOjsWHN1OjEugMmjQO8z1PGZPQJ
QDxNnULS2QWV5VHVaQhCKjPPT9kZPOfBK/WBHEG7OMYRzFBZ4lS9R8lMCJPJUqK5
FNGMeJFMOMRUvOGHTDGBMSKZ8jHTfL8UKDJ9nXkTtDJtK7J9JRhF7FNOkKC5O9Fd
GE0nfqBH0CtNGP+TFQ4LZBzQ3V+QoT7N3Y1q7F5W5YPVxk6vSzx6n4YK8tLbY0yC
X9X4L5bXP7D9nJQD3F9EYP8iMvA9J7XCIJxwwwIDAQABAoIBABHR9bBnj7ktPv1n
OMi/zYDm6D2sMmzGDMvD1xMPQ2GG4XBfZtJ4r7Ry9oJYOtLB5DBHcYYMf1Xp2EoH
XAFgNxbN6NyP5Qy7Xwhq4KbzqD3rCBKNr9bp7RZC9svhRD0RlSYD+JPoHPQj0FMB
C7fMNbPpD3VDH0bTDNbkNdKJHBJhMDJCLHVQ6v3Z+qQ9p/pUgQ6dS4sNBqCn5X4t
4mHbk+5GfBQD8LMALB4N3pPk1Xf8P8UPwC4VZbT5q5XqH2mKPr8v2YBnXqGIlJq2
kB8qb+1tWLKI9k3U8xU7vQ6xDPM/3BPPQ7G5G4R9D+K5Qr6F5hFmJHNbM6F8A6HY
VmH5KskCgYEA7d6mG4P1T+1j+mUtG+C4ZaP1c6n+Dq+rV2S+Q+hE9vjBmP79JqkQ
7b9RuGZDqLT1LQPH6GQXDL1+VlGcP3RDhQGJ8dPqF3vgm9CY2NV7C0jDn+PxGOjP
ePV4M6Pf6TPAK2HLXN9b3C3fQH9vXAVxGlB9gQD2QM5YLMHF1DTBEQ0CgYEA4apP
RjY2HKYS8BoXLgvHqQPLtB5LQKHV6DMerKGJKBz+B9P9wL8vVwEP0b+xMN0LH3R+
Nq+I3XMdFM2lXlCFKQlMoOfO+QNLY3kBCVb7FE0FDb+B3UO5Q3fqXKPtEOKA+fln
d6PpBDvH3FMNMoM3jBi5vHMvL5oKp6vN9y9F6i8CgYEAwA1VQ0Ph5C0P0LMypBNL
aRNmBP+2U1f3RAJ8GRSJ1w9BaVmF4G1LLmjQVL7s5RQXEY5P6VrK7K1h2qT3JVGV
T3kJ5Mq7rMRPJj2C3pQDlErB7m3HcJXR8N5s3CQCXu2LMJri3JjDn0VNqB8GMXVV
Z5k+W7H1v8D+sM7vU1IAkGECgYBdMMY9Sq9B7C4dP3l8k9vKDbNq5PeeHtQCb8BX
G76fAfMNKr8s9Lg7GdBJvPE/DmKixHz/q7JJpXJ1Q3u8HKB7W9rNNBU5K1j+QRVK
T/QFxpNQmhN2YW3OP/W/UVjMcBwGU1jJl3DwjQkB9W0XpE0Ppj5Z5FEgPhM0OG8l
F8mRjwKBgQCypjHh9ZLbD3ex8C+4GKBQ6vBPQfC2MaCH6pH1LPwNDQd7p7palThk
dPZJf4AgFJRicS+V9X+0q3EjyDQ7rlkPpA0MoLa+z+WV1RxPT9XvL8mlVP0B4fNk
PMgCFMr8z+gQaS7QAjVlP0RMnpQvlHZ8F9XDM+Fw8a+BVz7UnDalUw==
-----END RSA PRIVATE KEY-----`;

describe("githubAuth", () => {
  let container: TestContainer;

  beforeEach(() => {
    container = setupTestContainer();
    // clearTokenCache()はPropertiesServiceを使うようになったため、
    // テストコンテナ初期化後にコンテナ経由で呼び出す
    try {
      clearTokenCache();
    } catch {
      // テスト環境ではスキップ
    }
  });

  afterEach(() => {
    try {
      clearTokenCache();
    } catch {
      // テスト環境ではスキップ
    }
    teardownTestContainer();
  });

  describe("generateJWT", () => {
    it("有効なJWTを生成する", () => {
      const appId = "12345";
      const jwt = generateJWT(appId, TEST_PRIVATE_KEY);

      // JWTは3つのパートからなる
      const parts = jwt.split(".");
      expect(parts).toHaveLength(3);

      // ヘッダーをデコードして検証
      const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
      expect(header.alg).toBe("RS256");
      expect(header.typ).toBe("JWT");

      // ペイロードをデコードして検証
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
      expect(payload.iss).toBe(appId);
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
      // 有効期限は発行時刻から約10分後
      expect(payload.exp - payload.iat).toBeGreaterThanOrEqual(600);
    });
  });

  describe("resolveGitHubToken", () => {
    it("PATが指定されている場合はPATを返す", () => {
      const token = resolveGitHubToken("ghp_test_token", undefined);
      expect(token).toBe("ghp_test_token");
    });

    it("認証情報がない場合はエラーを投げる", () => {
      expect(() => resolveGitHubToken(undefined, undefined)).toThrow(
        "GitHub authentication not configured"
      );
    });

    it("GitHub Appが指定されている場合はInstallation Tokenを取得する", () => {
      // Installation Token APIのモックを設定
      const mockInstallationToken = "ghs_mock_installation_token_12345";
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

      container.httpClient.setJsonResponse(
        "https://api.github.com/app/installations/67890/access_tokens",
        201,
        {
          token: mockInstallationToken,
          expires_at: expiresAt,
        }
      );

      const appConfig = {
        appId: "12345",
        privateKey: TEST_PRIVATE_KEY,
        installationId: "67890",
      };

      const token = resolveGitHubToken(undefined, appConfig);
      expect(token).toBe(mockInstallationToken);
    });

    it("GitHub AppとPATの両方がある場合はGitHub Appを優先する", () => {
      const mockInstallationToken = "ghs_mock_installation_token_12345";
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

      container.httpClient.setJsonResponse(
        "https://api.github.com/app/installations/67890/access_tokens",
        201,
        {
          token: mockInstallationToken,
          expires_at: expiresAt,
        }
      );

      const appConfig = {
        appId: "12345",
        privateKey: TEST_PRIVATE_KEY,
        installationId: "67890",
      };

      const token = resolveGitHubToken("ghp_test_token", appConfig);
      // GitHub Appが優先される
      expect(token).toBe(mockInstallationToken);
    });

    it("Private Keyが空の場合はエラーを投げる", () => {
      const appConfig = {
        appId: "12345",
        privateKey: "",
        installationId: "67890",
      };

      expect(() => resolveGitHubToken(undefined, appConfig)).toThrow(
        "GitHub App Private Key not found"
      );
    });

    it("Private Keyの形式が不正な場合はエラーを投げる", () => {
      const appConfig = {
        appId: "12345",
        privateKey: "invalid-key-without-pem-markers",
        installationId: "67890",
      };

      expect(() => resolveGitHubToken(undefined, appConfig)).toThrow(
        "Invalid Private Key format"
      );
    });

    it("Installation Tokenはキャッシュされる", () => {
      const mockInstallationToken = "ghs_mock_installation_token_12345";
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

      let callCount = 0;
      container.httpClient.setResponseCallback(
        "https://api.github.com/app/installations/67890/access_tokens",
        () => {
          callCount++;
          return {
            statusCode: 201,
            content: JSON.stringify({
              token: mockInstallationToken,
              expires_at: expiresAt,
            }),
            data: {
              token: mockInstallationToken,
              expires_at: expiresAt,
            },
          };
        }
      );

      const appConfig = {
        appId: "12345",
        privateKey: TEST_PRIVATE_KEY,
        installationId: "67890",
      };

      // 1回目の呼び出し
      resolveGitHubToken(undefined, appConfig);
      expect(callCount).toBe(1);

      // 2回目の呼び出し - キャッシュから取得
      resolveGitHubToken(undefined, appConfig);
      expect(callCount).toBe(1); // 増えない

      // キャッシュをクリア
      clearTokenCache();

      // 3回目の呼び出し - 新規取得
      resolveGitHubToken(undefined, appConfig);
      expect(callCount).toBe(2);
    });
  });
});
