/**
 * GitHub API基盤のテスト
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { fetchGitHub, GITHUB_API_BASE } from '../../src/services/github/api';
import { initializeContainer } from '../../src/container';
import { createMockContainer, MockHttpClient } from '../mocks';

describe('GitHub API', () => {
  let mocks: ReturnType<typeof createMockContainer>;
  let mockHttpClient: MockHttpClient;
  const testToken = 'test-token-123';

  beforeEach(() => {
    mocks = createMockContainer();
    mockHttpClient = mocks.httpClient as MockHttpClient;
    initializeContainer(mocks);
  });

  describe('fetchGitHub', () => {
    it('正常系: 成功レスポンスを返す', () => {
      const mockData = { id: 1, name: 'test' };
      mockHttpClient.setJsonResponse(`${GITHUB_API_BASE}/test`, 200, mockData);

      const result = fetchGitHub<typeof mockData>('/test', testToken);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });

    it('認証ヘッダーが正しく設定される', () => {
      const mockData = { success: true };
      mockHttpClient.setJsonResponse(`${GITHUB_API_BASE}/endpoint`, 200, mockData);

      fetchGitHub('/endpoint', testToken);

      const call = mockHttpClient.calls[0];
      expect(call.options?.headers?.Authorization).toBe(`Bearer ${testToken}`);
      expect(call.options?.headers?.Accept).toBe('application/vnd.github.v3+json');
      expect(call.options?.headers?.['User-Agent']).toBe('DevSyncGAS');
    });

    it('200系のステータスコードで成功する', () => {
      mockHttpClient.setJsonResponse(`${GITHUB_API_BASE}/test`, 201, { created: true });
      const result = fetchGitHub('/test', testToken);
      expect(result.success).toBe(true);

      mockHttpClient.reset();
      mockHttpClient.setJsonResponse(`${GITHUB_API_BASE}/test`, 204, {});
      const result2 = fetchGitHub('/test', testToken);
      expect(result2.success).toBe(true);
    });

    it('エラー系: 404エラーを処理する', () => {
      mockHttpClient.setResponse(`${GITHUB_API_BASE}/not-found`, {
        statusCode: 404,
        content: JSON.stringify({ message: 'Not Found' }),
      });

      const result = fetchGitHub('/not-found', testToken);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('エラー系: 401認証エラーを処理する', () => {
      mockHttpClient.setResponse(`${GITHUB_API_BASE}/unauthorized`, {
        statusCode: 401,
        content: JSON.stringify({ message: 'Bad credentials' }),
      });

      const result = fetchGitHub('/unauthorized', testToken);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('Unauthorized');
    });

    it('エラー系: 403権限エラーを処理する', () => {
      mockHttpClient.setResponse(`${GITHUB_API_BASE}/forbidden`, {
        statusCode: 403,
        content: JSON.stringify({ message: 'Forbidden' }),
      });

      const result = fetchGitHub('/forbidden', testToken);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('エラー系: 500サーバーエラーを処理する', () => {
      mockHttpClient.setResponse(`${GITHUB_API_BASE}/error`, {
        statusCode: 500,
        content: JSON.stringify({ message: 'Internal Server Error' }),
      });

      const result = fetchGitHub('/error', testToken);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('エンドポイントが正しくURLに変換される', () => {
      mockHttpClient.setJsonResponse(`${GITHUB_API_BASE}/repos/owner/repo`, 200, {});

      fetchGitHub('/repos/owner/repo', testToken);

      expect(mockHttpClient.calls[0].url).toBe(`${GITHUB_API_BASE}/repos/owner/repo`);
    });

    it('複数回のAPI呼び出しが記録される', () => {
      mockHttpClient.setJsonResponse(`${GITHUB_API_BASE}/test1`, 200, {});
      mockHttpClient.setJsonResponse(`${GITHUB_API_BASE}/test2`, 200, {});

      fetchGitHub('/test1', testToken);
      fetchGitHub('/test2', testToken);

      expect(mockHttpClient.calls.length).toBe(2);
      expect(mockHttpClient.calls[0].url).toContain('/test1');
      expect(mockHttpClient.calls[1].url).toContain('/test2');
    });

    it('muteHttpExceptionsがtrueに設定される', () => {
      mockHttpClient.setJsonResponse(`${GITHUB_API_BASE}/test`, 200, {});

      fetchGitHub('/test', testToken);

      expect(mockHttpClient.calls[0].options?.muteHttpExceptions).toBe(true);
    });
  });

  describe('GITHUB_API_BASE', () => {
    it('正しいベースURLを持つ', () => {
      expect(GITHUB_API_BASE).toBe('https://api.github.com');
    });
  });
});
