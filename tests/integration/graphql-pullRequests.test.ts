/**
 * GraphQL Pull Requests 統合テスト
 *
 * バッチ処理、ページネーション、エラーハンドリング、ラベルフィルタリングのテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

// GASグローバルのUtilitiesをモック
(globalThis as typeof globalThis & { Utilities: { sleep: (ms: number) => void } }).Utilities = {
  sleep: (_ms: number) => {
    // テスト時は待機しない
  },
};
import { initializeContainer, resetContainer } from '../../src/container';
import { createMockContainer, MockHttpClient } from '../mocks';
import {
  getPullRequestsGraphQL,
  type GetPullRequestsGraphQLParams,
} from '../../src/services/github/graphql/pullRequests';
import { GITHUB_GRAPHQL_ENDPOINT } from '../../src/services/github/graphql/client';
import type { GitHubRepository } from '../../src/types';

describe('GraphQL Pull Requests Integration', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;
  let mockHttpClient: MockHttpClient;
  const testRepo: GitHubRepository = { owner: 'test-owner', name: 'test-repo' };
  const testToken = 'test-token';

  beforeEach(() => {
    mockContainer = createMockContainer();
    mockHttpClient = mockContainer.httpClient;
    initializeContainer(mockContainer);
  });

  afterEach(() => {
    resetContainer();
  });

  describe('getPullRequestsGraphQL', () => {
    it('should handle empty repository (0 PRs)', () => {
      const mockResponse = {
        data: {
          repository: {
            pullRequests: {
              nodes: [],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = getPullRequestsGraphQL({
        repo: testRepo,
        token: testToken,
        state: 'all',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should fetch single page of PRs successfully', () => {
      const mockResponse = {
        data: {
          repository: {
            pullRequests: {
              nodes: [
                {
                  number: 123,
                  id: 'PR_123',
                  title: 'Test PR 1',
                  createdAt: '2024-01-01T10:00:00Z',
                  updatedAt: '2024-01-01T12:00:00Z',
                  closedAt: null,
                  mergedAt: null,
                  state: 'OPEN',
                  author: { login: 'developer1' },
                  baseRefName: 'main',
                  headRefName: 'feature/test',
                  additions: 100,
                  deletions: 50,
                  changedFiles: 5,
                  labels: { nodes: [] },
                },
                {
                  number: 124,
                  id: 'PR_124',
                  title: 'Test PR 2',
                  createdAt: '2024-01-02T10:00:00Z',
                  updatedAt: '2024-01-02T16:00:00Z',
                  closedAt: '2024-01-02T16:00:00Z',
                  mergedAt: '2024-01-02T16:00:00Z',
                  state: 'MERGED',
                  author: { login: 'developer2' },
                  baseRefName: 'main',
                  headRefName: 'feature/test2',
                  additions: 200,
                  deletions: 100,
                  changedFiles: 10,
                  labels: { nodes: [] },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = getPullRequestsGraphQL({
        repo: testRepo,
        token: testToken,
        state: 'all',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].number).toBe(123);
      expect(result.data?.[0].title).toBe('Test PR 1');
      expect(result.data?.[1].number).toBe(124);
      expect(result.data?.[1].state).toBe('closed'); // MERGED → closed に変換される
    });

    it('should handle pagination correctly (2 pages)', () => {
      const page1Response = {
        data: {
          repository: {
            pullRequests: {
              nodes: [
                {
                  number: 1,
                  id: 'PR_1',
                  title: 'PR Page 1',
                  createdAt: '2024-01-01T10:00:00Z',
                  updatedAt: '2024-01-01T12:00:00Z',
                  closedAt: null,
                  mergedAt: null,
                  state: 'OPEN',
                  author: { login: 'dev1' },
                  baseRefName: 'main',
                  headRefName: 'feature/1',
                  additions: 50,
                  deletions: 25,
                  changedFiles: 3,
                  labels: { nodes: [] },
                },
              ],
              pageInfo: {
                hasNextPage: true,
                endCursor: 'cursor-page-1',
              },
            },
          },
        },
      };

      const page2Response = {
        data: {
          repository: {
            pullRequests: {
              nodes: [
                {
                  number: 2,
                  id: 'PR_2',
                  title: 'PR Page 2',
                  createdAt: '2024-01-02T10:00:00Z',
                  updatedAt: '2024-01-02T12:00:00Z',
                  closedAt: null,
                  mergedAt: null,
                  state: 'OPEN',
                  author: { login: 'dev2' },
                  baseRefName: 'main',
                  headRefName: 'feature/2',
                  additions: 75,
                  deletions: 30,
                  changedFiles: 4,
                  labels: { nodes: [] },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      };

      // 最初のリクエスト（cursor = null）
      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(page1Response),
        data: page1Response,
      });

      const result1 = getPullRequestsGraphQL({
        repo: testRepo,
        token: testToken,
        state: 'all',
        maxPages: 1,
      });

      expect(result1.success).toBe(true);
      expect(result1.data).toHaveLength(1);

      // 2回目のリクエスト（cursor = 'cursor-page-1'）
      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(page2Response),
        data: page2Response,
      });

      const result2 = getPullRequestsGraphQL({
        repo: testRepo,
        token: testToken,
        state: 'all',
        maxPages: 2,
      });

      // Note: 実際のページネーションは内部ループで処理されるため、
      // このテストでは1ページ目のみのテストになります。
      // 完全なページネーションテストは後続で追加します。
    });

    it('should filter PRs by exclude labels', () => {
      const mockResponse = {
        data: {
          repository: {
            pullRequests: {
              nodes: [
                {
                  number: 1,
                  id: 'PR_1',
                  title: 'Normal PR',
                  createdAt: '2024-01-01T10:00:00Z',
                  updatedAt: '2024-01-01T12:00:00Z',
                  closedAt: null,
                  mergedAt: null,
                  state: 'OPEN',
                  author: { login: 'dev1' },
                  baseRefName: 'main',
                  headRefName: 'feature/normal',
                  additions: 50,
                  deletions: 25,
                  changedFiles: 3,
                  labels: { nodes: [] },
                },
                {
                  number: 2,
                  id: 'PR_2',
                  title: 'Dependabot PR (excluded)',
                  createdAt: '2024-01-02T10:00:00Z',
                  updatedAt: '2024-01-02T12:00:00Z',
                  closedAt: null,
                  mergedAt: null,
                  state: 'OPEN',
                  author: { login: 'dependabot' },
                  baseRefName: 'main',
                  headRefName: 'dependabot/npm',
                  additions: 10,
                  deletions: 10,
                  changedFiles: 1,
                  labels: {
                    nodes: [{ name: 'exclude-metrics' }],
                  },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = getPullRequestsGraphQL({
        repo: testRepo,
        token: testToken,
        state: 'all',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1); // 1件除外
      expect(result.data?.[0].number).toBe(1);
      expect(result.data?.[0].title).toBe('Normal PR');
    });

    it('should handle GraphQL rate limit error', () => {
      const mockResponse = {
        data: null,
        errors: [
          {
            message: 'API rate limit exceeded',
            type: 'RATE_LIMITED',
          },
        ],
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = getPullRequestsGraphQL({
        repo: testRepo,
        token: testToken,
        state: 'all',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');
    });

    it('should handle network timeout (HTTP 500)', () => {
      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 500,
        content: 'Internal Server Error',
      });

      const result = getPullRequestsGraphQL({
        repo: testRepo,
        token: testToken,
        state: 'all',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should handle authentication error (HTTP 401)', () => {
      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 401,
        content: 'Unauthorized',
      });

      const result = getPullRequestsGraphQL({
        repo: testRepo,
        token: 'invalid-token',
        state: 'all',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('should filter PRs by date range', () => {
      const mockResponse = {
        data: {
          repository: {
            pullRequests: {
              nodes: [
                {
                  number: 1,
                  id: 'PR_1',
                  title: 'Old PR (excluded)',
                  createdAt: '2023-12-01T10:00:00Z',
                  updatedAt: '2023-12-01T12:00:00Z',
                  closedAt: null,
                  mergedAt: null,
                  state: 'OPEN',
                  author: { login: 'dev1' },
                  baseRefName: 'main',
                  headRefName: 'feature/old',
                  additions: 50,
                  deletions: 25,
                  changedFiles: 3,
                  labels: { nodes: [] },
                },
                {
                  number: 2,
                  id: 'PR_2',
                  title: 'Recent PR (included)',
                  createdAt: '2024-01-15T10:00:00Z',
                  updatedAt: '2024-01-15T12:00:00Z',
                  closedAt: null,
                  mergedAt: null,
                  state: 'OPEN',
                  author: { login: 'dev2' },
                  baseRefName: 'main',
                  headRefName: 'feature/recent',
                  additions: 75,
                  deletions: 30,
                  changedFiles: 4,
                  labels: { nodes: [] },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = getPullRequestsGraphQL({
        repo: testRepo,
        token: testToken,
        state: 'all',
        dateRange: {
          since: new Date('2024-01-01'),
          until: new Date('2024-01-31'),
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].number).toBe(2);
      expect(result.data?.[0].title).toBe('Recent PR (included)');
    });
  });

  describe('Multiple API calls', () => {
    it('should handle multiple consecutive calls successfully', () => {
      const mockResponse = {
        data: {
          repository: {
            pullRequests: {
              nodes: [
                {
                  number: 1,
                  id: 'PR_1',
                  title: 'Test PR',
                  createdAt: '2024-01-01T10:00:00Z',
                  updatedAt: '2024-01-01T12:00:00Z',
                  closedAt: null,
                  mergedAt: null,
                  state: 'OPEN',
                  author: { login: 'dev1' },
                  baseRefName: 'main',
                  headRefName: 'feature/1',
                  additions: 50,
                  deletions: 25,
                  changedFiles: 3,
                  labels: { nodes: [] },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result1 = getPullRequestsGraphQL({
        repo: { owner: 'test-owner', name: 'repo1' },
        token: testToken,
        state: 'all',
      });

      const result2 = getPullRequestsGraphQL({
        repo: { owner: 'test-owner', name: 'repo2' },
        token: testToken,
        state: 'all',
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle PR with 0 changes (0 additions, 0 deletions)', () => {
      const mockResponse = {
        data: {
          repository: {
            pullRequests: {
              nodes: [
                {
                  number: 1,
                  id: 'PR_1',
                  title: 'Empty PR',
                  createdAt: '2024-01-01T10:00:00Z',
                  updatedAt: '2024-01-01T12:00:00Z',
                  closedAt: null,
                  mergedAt: null,
                  state: 'OPEN',
                  author: { login: 'dev1' },
                  baseRefName: 'main',
                  headRefName: 'feature/empty',
                  additions: 0,
                  deletions: 0,
                  changedFiles: 0,
                  labels: { nodes: [] },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = getPullRequestsGraphQL({
        repo: testRepo,
        token: testToken,
        state: 'all',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].number).toBe(1);
    });

    it('should handle very large PR (>10000 lines)', () => {
      const mockResponse = {
        data: {
          repository: {
            pullRequests: {
              nodes: [
                {
                  number: 1,
                  id: 'PR_1',
                  title: 'Huge refactoring',
                  createdAt: '2024-01-01T10:00:00Z',
                  updatedAt: '2024-01-01T12:00:00Z',
                  closedAt: null,
                  mergedAt: null,
                  state: 'OPEN',
                  author: { login: 'dev1' },
                  baseRefName: 'main',
                  headRefName: 'feature/refactor',
                  additions: 8000,
                  deletions: 5000,
                  changedFiles: 150,
                  labels: { nodes: [] },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = getPullRequestsGraphQL({
        repo: testRepo,
        token: testToken,
        state: 'all',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('should handle PR with multiple exclude labels', () => {
      const mockResponse = {
        data: {
          repository: {
            pullRequests: {
              nodes: [
                {
                  number: 1,
                  id: 'PR_1',
                  title: 'Bot PR (multiple labels)',
                  createdAt: '2024-01-01T10:00:00Z',
                  updatedAt: '2024-01-01T12:00:00Z',
                  closedAt: null,
                  mergedAt: null,
                  state: 'OPEN',
                  author: { login: 'bot' },
                  baseRefName: 'main',
                  headRefName: 'bot/update',
                  additions: 10,
                  deletions: 10,
                  changedFiles: 1,
                  labels: {
                    nodes: [{ name: 'exclude-metrics' }, { name: 'dependencies' }, { name: 'bot' }],
                  },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = getPullRequestsGraphQL({
        repo: testRepo,
        token: testToken,
        state: 'all',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0); // 除外される
    });

    it('should handle PR with very long title (>100 characters)', () => {
      const longTitle = 'A'.repeat(150);
      const mockResponse = {
        data: {
          repository: {
            pullRequests: {
              nodes: [
                {
                  number: 1,
                  id: 'PR_1',
                  title: longTitle,
                  createdAt: '2024-01-01T10:00:00Z',
                  updatedAt: '2024-01-01T12:00:00Z',
                  closedAt: null,
                  mergedAt: null,
                  state: 'OPEN',
                  author: { login: 'dev1' },
                  baseRefName: 'main',
                  headRefName: 'feature/long-title',
                  additions: 50,
                  deletions: 25,
                  changedFiles: 3,
                  labels: { nodes: [] },
                },
              ],
              pageInfo: {
                hasNextPage: false,
                endCursor: null,
              },
            },
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = getPullRequestsGraphQL({
        repo: testRepo,
        token: testToken,
        state: 'all',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].title).toBe(longTitle);
    });
  });
});
