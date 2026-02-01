/**
 * GitHub GraphQL API テスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { initializeContainer, resetContainer } from '../../src/container';
import { createMockContainer, MockHttpClient } from '../mocks';
import {
  executeGraphQL,
  getRateLimitInfo,
  GITHUB_GRAPHQL_ENDPOINT,
} from '../../src/services/github/graphql/client';

describe('GraphQL Client', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;
  let mockHttpClient: MockHttpClient;

  beforeEach(() => {
    mockContainer = createMockContainer();
    mockHttpClient = mockContainer.httpClient;
    initializeContainer(mockContainer);
  });

  afterEach(() => {
    resetContainer();
  });

  describe('executeGraphQL', () => {
    it('should send GraphQL query and return data', () => {
      const mockResponse = {
        data: {
          repository: {
            pullRequests: {
              nodes: [{ number: 1, title: 'Test PR' }],
            },
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = executeGraphQL<typeof mockResponse.data>(
        'query { repository { pullRequests { nodes { number title } } } }',
        { owner: 'test', name: 'repo' },
        'test-token'
      );

      expect(result.success).toBe(true);
      expect(result.data?.repository.pullRequests.nodes).toHaveLength(1);
      expect(result.data?.repository.pullRequests.nodes[0].number).toBe(1);
    });

    it('should handle HTTP errors', () => {
      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 401,
        content: 'Unauthorized',
      });

      const result = executeGraphQL('query { test }', {}, 'invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
    });

    it('should handle GraphQL errors', () => {
      const mockResponse = {
        data: null,
        errors: [{ message: "Field 'test' not found", type: 'FIELD_ERROR' }],
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = executeGraphQL('query { test }', {}, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain("Field 'test' not found");
    });

    it('should return partial data with GraphQL errors', () => {
      const mockResponse = {
        data: {
          repository: { name: 'test' },
        },
        errors: [{ message: 'Some field failed', type: 'PARTIAL_ERROR' }],
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = executeGraphQL<{ repository: { name: string } }>(
        'query { repository { name } }',
        {},
        'test-token'
      );

      expect(result.success).toBe(true);
      expect(result.data?.repository.name).toBe('test');
    });

    it('should include proper headers', () => {
      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify({ data: {} }),
        data: { data: {} },
      });

      executeGraphQL('query { test }', {}, 'test-token');

      const call = mockHttpClient.calls[0];
      expect(call.options?.headers?.Authorization).toBe('Bearer test-token');
      expect(call.options?.headers?.['Content-Type']).toBe('application/json');
      expect(call.options?.headers?.['User-Agent']).toBe('DevSyncGAS');
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return rate limit information', () => {
      const mockResponse = {
        data: {
          rateLimit: {
            limit: 5000,
            remaining: 4999,
            resetAt: '2024-01-01T00:00:00Z',
            cost: 1,
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = getRateLimitInfo('test-token');

      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(5000);
      expect(result.data?.remaining).toBe(4999);
    });
  });
});

describe('GraphQL Queries', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;
  let mockHttpClient: MockHttpClient;

  beforeEach(() => {
    mockContainer = createMockContainer();
    mockHttpClient = mockContainer.httpClient;
    initializeContainer(mockContainer);
  });

  afterEach(() => {
    resetContainer();
  });

  describe('Pull Request queries', () => {
    it('should fetch pull requests via GraphQL', async () => {
      const { getPullRequestsGraphQL } =
        await import('../../src/services/github/graphql/pullRequests');

      const mockResponse = {
        data: {
          repository: {
            pullRequests: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  id: 'PR_123',
                  number: 1,
                  title: 'Test PR',
                  state: 'MERGED',
                  createdAt: '2024-01-01T00:00:00Z',
                  mergedAt: '2024-01-02T00:00:00Z',
                  closedAt: null,
                  author: { login: 'testuser' },
                  baseRefName: 'main',
                  headRefName: 'feature',
                  mergeCommit: { oid: 'abc123' },
                  additions: 100,
                  deletions: 50,
                  changedFiles: 5,
                  labels: {
                    nodes: [],
                  },
                },
              ],
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
        repo: { owner: 'test', name: 'repo', fullName: 'test/repo' },
        token: 'test-token',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].number).toBe(1);
      expect(result.data![0].title).toBe('Test PR');
      expect(result.data![0].author).toBe('testuser');
      expect(result.data![0].baseBranch).toBe('main');
    });
  });

  describe('Deployment queries', () => {
    it('should fetch deployments via GraphQL', async () => {
      const { getDeploymentsGraphQL } =
        await import('../../src/services/github/graphql/deployments');

      const mockResponse = {
        data: {
          repository: {
            deployments: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  id: 'DEP_123',
                  environment: 'production',
                  createdAt: '2024-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:01:00Z',
                  commit: { oid: 'abc123' },
                  state: 'ACTIVE',
                  latestStatus: {
                    state: 'SUCCESS',
                    createdAt: '2024-01-01T00:01:00Z',
                  },
                },
              ],
            },
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = getDeploymentsGraphQL(
        { owner: 'test', name: 'repo', fullName: 'test/repo' },
        'test-token',
        { environment: 'production' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].environment).toBe('production');
      expect(result.data![0].status).toBe('success');
    });
  });

  describe('Issue queries', () => {
    it('should fetch issues via GraphQL', async () => {
      const { getIssuesGraphQL } = await import('../../src/services/github/graphql/issues');

      const mockResponse = {
        data: {
          repository: {
            issues: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  id: 'ISSUE_123',
                  number: 1,
                  title: 'Test Issue',
                  state: 'CLOSED',
                  createdAt: '2024-01-01T00:00:00Z',
                  closedAt: '2024-01-02T00:00:00Z',
                  labels: {
                    nodes: [{ name: 'bug' }, { name: 'priority' }],
                  },
                },
              ],
            },
          },
        },
      };

      mockHttpClient.setResponse(GITHUB_GRAPHQL_ENDPOINT, {
        statusCode: 200,
        content: JSON.stringify(mockResponse),
        data: mockResponse,
      });

      const result = getIssuesGraphQL(
        { owner: 'test', name: 'repo', fullName: 'test/repo' },
        'test-token'
      );

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].number).toBe(1);
      expect(result.data![0].labels).toContain('bug');
    });
  });
});

describe('API Mode Setting', () => {
  let mockContainer: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mockContainer = createMockContainer();
    initializeContainer(mockContainer);
  });

  afterEach(() => {
    resetContainer();
  });

  it('should default to GraphQL mode', async () => {
    const { getGitHubApiMode } = await import('../../src/config/settings');

    const mode = getGitHubApiMode();
    expect(mode).toBe('graphql');
  });

  it('should switch to REST mode', async () => {
    const { getGitHubApiMode, setGitHubApiMode } = await import('../../src/config/settings');

    setGitHubApiMode('rest');
    const mode = getGitHubApiMode();
    expect(mode).toBe('rest');
  });

  it('should reset to GraphQL mode', async () => {
    const { getGitHubApiMode, setGitHubApiMode, resetGitHubApiMode } =
      await import('../../src/config/settings');

    setGitHubApiMode('rest');
    resetGitHubApiMode();
    const mode = getGitHubApiMode();
    expect(mode).toBe('graphql');
  });
});
