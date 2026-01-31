/**
 * github.ts のユニットテスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  getPullRequests,
  getWorkflowRuns,
  getDeployments,
  getAllRepositoriesData,
  getIncidents,
  getPRDetails,
  getPRSizeDataForPRs,
} from '../../src/services/github';
import { setupTestContainer, teardownTestContainer, type TestContainer } from '../helpers/setup';
import type { GitHubRepository, GitHubPullRequest } from '../../src/types';

describe('github', () => {
  let container: TestContainer;

  beforeEach(() => {
    container = setupTestContainer();
  });

  afterEach(() => {
    teardownTestContainer();
  });

  const testRepo: GitHubRepository = {
    owner: 'test-owner',
    name: 'test-repo',
    fullName: 'test-owner/test-repo',
  };

  describe('getPullRequests', () => {
    it('PRを正しく取得する', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc',
        200,
        [
          {
            id: 1,
            number: 1,
            title: 'Test PR',
            state: 'closed',
            created_at: '2024-01-01T10:00:00Z',
            merged_at: '2024-01-01T12:00:00Z',
            closed_at: '2024-01-01T12:00:00Z',
            user: { login: 'test-user' },
          },
        ]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc',
        200,
        []
      );

      const result = getPullRequests(testRepo, 'test-token');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].title).toBe('Test PR');
      expect(result.data![0].repository).toBe('test-owner/test-repo');
    });

    it('APIエラー時はエラーを返す', () => {
      container.httpClient.setResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc',
        { statusCode: 401, content: 'Unauthorized' }
      );

      const result = getPullRequests(testRepo, 'invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    it('日付範囲でフィルタリングする', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc',
        200,
        [
          {
            id: 1,
            number: 1,
            title: 'Old PR',
            state: 'closed',
            created_at: '2023-01-01T10:00:00Z',
            merged_at: '2023-01-01T12:00:00Z',
            closed_at: '2023-01-01T12:00:00Z',
            user: { login: 'test-user' },
          },
          {
            id: 2,
            number: 2,
            title: 'New PR',
            state: 'closed',
            created_at: '2024-06-01T10:00:00Z',
            merged_at: '2024-06-01T12:00:00Z',
            closed_at: '2024-06-01T12:00:00Z',
            user: { login: 'test-user' },
          },
        ]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc',
        200,
        []
      );

      const result = getPullRequests(testRepo, 'test-token', 'all', {
        since: new Date('2024-01-01'),
        until: new Date('2024-12-31'),
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].title).toBe('New PR');
    });

    it('ページネーションを正しく処理する', () => {
      // Page 1
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc',
        200,
        [
          {
            id: 1,
            number: 1,
            title: 'PR 1',
            state: 'open',
            created_at: '2024-01-01T10:00:00Z',
            merged_at: null,
            closed_at: null,
            user: { login: 'user1' },
          },
        ]
      );

      // Page 2
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc',
        200,
        [
          {
            id: 2,
            number: 2,
            title: 'PR 2',
            state: 'open',
            created_at: '2024-01-02T10:00:00Z',
            merged_at: null,
            closed_at: null,
            user: { login: 'user2' },
          },
        ]
      );

      // Page 3 (empty)
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls?state=all&per_page=100&page=3&sort=updated&direction=desc',
        200,
        []
      );

      const result = getPullRequests(testRepo, 'test-token');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getWorkflowRuns', () => {
    it('ワークフロー実行を正しく取得する', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=1',
        200,
        {
          workflow_runs: [
            {
              id: 1,
              name: 'CI',
              status: 'completed',
              conclusion: 'success',
              created_at: '2024-01-01T10:00:00Z',
              updated_at: '2024-01-01T10:05:00Z',
            },
          ],
        }
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=2',
        200,
        { workflow_runs: [] }
      );

      const result = getWorkflowRuns(testRepo, 'test-token');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('CI');
      expect(result.data![0].repository).toBe('test-owner/test-repo');
    });

    it('APIエラー時はエラーを返す', () => {
      container.httpClient.setResponse(
        'https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=1',
        { statusCode: 403, content: 'Forbidden' }
      );

      const result = getWorkflowRuns(testRepo, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Forbidden');
    });

    it('日付範囲パラメータを正しく設定する', () => {
      const since = new Date('2024-01-01');
      const sinceStr = since.toISOString().split('T')[0];

      container.httpClient.setJsonResponse(
        `https://api.github.com/repos/test-owner/test-repo/actions/runs?per_page=100&page=1&created=${encodeURIComponent('>=' + sinceStr)}`,
        200,
        { workflow_runs: [] }
      );

      const result = getWorkflowRuns(testRepo, 'test-token', { since });

      expect(result.success).toBe(true);
      // Verify the correct URL was called
      const calls = container.httpClient.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain('created=%3E%3D2024-01-01');
    });
  });

  describe('getDeployments', () => {
    it('デプロイメントを正しく取得する', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=1&environment=production',
        200,
        [
          {
            id: 1,
            sha: 'abc123',
            environment: 'production',
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T10:05:00Z',
          },
        ]
      );

      // Deployment status
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments/1/statuses?per_page=1',
        200,
        [{ state: 'success' }]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=2&environment=production',
        200,
        []
      );

      const result = getDeployments(testRepo, 'test-token', { environment: 'production' });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].sha).toBe('abc123');
      expect(result.data![0].status).toBe('success');
      expect(result.data![0].repository).toBe('test-owner/test-repo');
    });

    it('skipStatusFetch=trueでステータス取得をスキップする', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=1',
        200,
        [
          {
            id: 1,
            sha: 'abc123',
            environment: 'production',
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T10:05:00Z',
          },
        ]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=2',
        200,
        []
      );

      const result = getDeployments(testRepo, 'test-token', { skipStatusFetch: true });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].status).toBeNull(); // ステータス未取得

      // ステータスAPIは呼ばれていない
      const calls = container.httpClient.calls;
      expect(calls.every((c) => !c.url.includes('/statuses'))).toBe(true);
    });

    it('APIエラー時はエラーを返す', () => {
      container.httpClient.setResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=1&environment=production',
        { statusCode: 404, content: 'Not Found' }
      );

      const result = getDeployments(testRepo, 'test-token', { environment: 'production' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not Found');
    });

    it('日付範囲でフィルタリングする', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=1',
        200,
        [
          {
            id: 1,
            sha: 'old',
            environment: 'production',
            created_at: '2023-01-01T10:00:00Z',
            updated_at: '2023-01-01T10:05:00Z',
          },
          {
            id: 2,
            sha: 'new',
            environment: 'production',
            created_at: '2024-06-01T10:00:00Z',
            updated_at: '2024-06-01T10:05:00Z',
          },
        ]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments/2/statuses?per_page=1',
        200,
        [{ state: 'success' }]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=2',
        200,
        []
      );

      const result = getDeployments(testRepo, 'test-token', {
        dateRange: {
          since: new Date('2024-01-01'),
          until: new Date('2024-12-31'),
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].sha).toBe('new');
    });

    it('部分一致モードで環境名をフィルタリングする', () => {
      // 部分一致モードではAPIフィルタを使用せず、全件取得してクライアント側でフィルタ
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=1',
        200,
        [
          {
            id: 1,
            sha: 'prod-v1',
            environment: 'production_v1',
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T10:05:00Z',
          },
          {
            id: 2,
            sha: 'prod-v2',
            environment: 'production_v2',
            created_at: '2024-01-02T10:00:00Z',
            updated_at: '2024-01-02T10:05:00Z',
          },
          {
            id: 3,
            sha: 'staging',
            environment: 'staging',
            created_at: '2024-01-03T10:00:00Z',
            updated_at: '2024-01-03T10:05:00Z',
          },
        ]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments/1/statuses?per_page=1',
        200,
        [{ state: 'success' }]
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments/2/statuses?per_page=1',
        200,
        [{ state: 'success' }]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=2',
        200,
        []
      );

      const result = getDeployments(testRepo, 'test-token', {
        environment: 'production',
        environmentMatchMode: 'partial',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data![0].environment).toBe('production_v1');
      expect(result.data![1].environment).toBe('production_v2');

      // APIフィルタを使用していないことを確認
      const calls = container.httpClient.calls;
      expect(calls[0].url).not.toContain('environment=');
    });

    it('部分一致は大文字小文字を区別しない', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=1',
        200,
        [
          {
            id: 1,
            sha: 'prod',
            environment: 'PRODUCTION',
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T10:05:00Z',
          },
        ]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments/1/statuses?per_page=1',
        200,
        [{ state: 'success' }]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/deployments?per_page=100&page=2',
        200,
        []
      );

      const result = getDeployments(testRepo, 'test-token', {
        environment: 'production',
        environmentMatchMode: 'partial',
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].environment).toBe('PRODUCTION');
    });
  });

  describe('getAllRepositoriesData', () => {
    it('複数リポジトリからデータを取得する', () => {
      const repos: GitHubRepository[] = [
        { owner: 'owner1', name: 'repo1', fullName: 'owner1/repo1' },
        { owner: 'owner2', name: 'repo2', fullName: 'owner2/repo2' },
      ];

      // Repo 1 PRs
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner1/repo1/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc',
        200,
        [
          {
            id: 1,
            number: 1,
            title: 'PR 1',
            state: 'open',
            created_at: '2024-01-01T10:00:00Z',
            merged_at: null,
            closed_at: null,
            user: { login: 'user' },
          },
        ]
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner1/repo1/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc',
        200,
        []
      );

      // Repo 1 Runs
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner1/repo1/actions/runs?per_page=100&page=1',
        200,
        {
          workflow_runs: [
            {
              id: 1,
              name: 'CI',
              status: 'completed',
              conclusion: 'success',
              created_at: '2024-01-01T10:00:00Z',
              updated_at: '2024-01-01T10:05:00Z',
            },
          ],
        }
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner1/repo1/actions/runs?per_page=100&page=2',
        200,
        { workflow_runs: [] }
      );

      // Repo 2 PRs
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner2/repo2/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc',
        200,
        [
          {
            id: 2,
            number: 1,
            title: 'PR 2',
            state: 'closed',
            created_at: '2024-01-02T10:00:00Z',
            merged_at: '2024-01-02T12:00:00Z',
            closed_at: '2024-01-02T12:00:00Z',
            user: { login: 'user' },
          },
        ]
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner2/repo2/pulls?state=all&per_page=100&page=2&sort=updated&direction=desc',
        200,
        []
      );

      // Repo 2 Runs
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner2/repo2/actions/runs?per_page=100&page=1',
        200,
        {
          workflow_runs: [
            {
              id: 2,
              name: 'Deploy',
              status: 'completed',
              conclusion: 'failure',
              created_at: '2024-01-02T10:00:00Z',
              updated_at: '2024-01-02T10:05:00Z',
            },
          ],
        }
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner2/repo2/actions/runs?per_page=100&page=2',
        200,
        { workflow_runs: [] }
      );

      // Repo 1 Deployments
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner1/repo1/deployments?per_page=100&page=1&environment=production',
        200,
        []
      );

      // Repo 2 Deployments
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner2/repo2/deployments?per_page=100&page=1&environment=production',
        200,
        [
          {
            id: 1,
            sha: 'abc123',
            environment: 'production',
            created_at: '2024-01-02T10:00:00Z',
            updated_at: '2024-01-02T10:05:00Z',
          },
        ]
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner2/repo2/deployments/1/statuses?per_page=1',
        200,
        [{ state: 'success' }]
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner2/repo2/deployments?per_page=100&page=2&environment=production',
        200,
        []
      );

      const result = getAllRepositoriesData(repos, 'test-token');

      expect(result.pullRequests).toHaveLength(2);
      expect(result.workflowRuns).toHaveLength(2);
      expect(result.deployments).toHaveLength(1);
      expect(result.pullRequests[0].repository).toBe('owner1/repo1');
      expect(result.pullRequests[1].repository).toBe('owner2/repo2');
      expect(result.deployments[0].repository).toBe('owner2/repo2');
    });

    it('ログを出力する', () => {
      const repos: GitHubRepository[] = [{ owner: 'owner', name: 'repo', fullName: 'owner/repo' }];

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc',
        200,
        []
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/actions/runs?per_page=100&page=1',
        200,
        { workflow_runs: [] }
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/deployments?per_page=100&page=1&environment=production',
        200,
        []
      );

      getAllRepositoriesData(repos, 'test-token');

      expect(container.logger.logs).toContain('📡 Fetching data for owner/repo...');
    });

    it('エラー時もログを出力して続行する', () => {
      const repos: GitHubRepository[] = [{ owner: 'owner', name: 'repo', fullName: 'owner/repo' }];

      container.httpClient.setResponse(
        'https://api.github.com/repos/owner/repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc',
        { statusCode: 500, content: 'Server Error' }
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/actions/runs?per_page=100&page=1',
        200,
        { workflow_runs: [] }
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/deployments?per_page=100&page=1&environment=production',
        200,
        []
      );

      const result = getAllRepositoriesData(repos, 'test-token');

      expect(result.pullRequests).toHaveLength(0);
      expect(container.logger.logs.some((log) => log.includes('PR fetch failed'))).toBe(true);
    });

    it('カスタム環境名を指定できる', () => {
      const repos: GitHubRepository[] = [{ owner: 'owner', name: 'repo', fullName: 'owner/repo' }];

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc',
        200,
        []
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/actions/runs?per_page=100&page=1',
        200,
        { workflow_runs: [] }
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/deployments?per_page=100&page=1&environment=prod',
        200,
        []
      );

      const result = getAllRepositoriesData(repos, 'test-token', {
        deploymentEnvironment: 'prod',
      });

      // Verify the correct environment was used
      const calls = container.httpClient.calls;
      expect(calls.some((c) => c.url.includes('environment=prod'))).toBe(true);
    });

    it('部分一致モードで環境名をフィルタリングできる', () => {
      const repos: GitHubRepository[] = [{ owner: 'owner', name: 'repo', fullName: 'owner/repo' }];

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/pulls?state=all&per_page=100&page=1&sort=updated&direction=desc',
        200,
        []
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/actions/runs?per_page=100&page=1',
        200,
        { workflow_runs: [] }
      );
      // 部分一致モードではAPIフィルタを使用しない
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/deployments?per_page=100&page=1',
        200,
        [
          {
            id: 1,
            sha: 'abc',
            environment: 'production_canary',
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-01T10:05:00Z',
          },
        ]
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/deployments/1/statuses?per_page=1',
        200,
        [{ state: 'success' }]
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/owner/repo/deployments?per_page=100&page=2',
        200,
        []
      );

      const result = getAllRepositoriesData(repos, 'test-token', {
        deploymentEnvironment: 'production',
        deploymentEnvironmentMatchMode: 'partial',
      });

      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].environment).toBe('production_canary');

      // APIフィルタを使用していないことを確認
      const calls = container.httpClient.calls;
      const deploymentCalls = calls.filter((c) => c.url.includes('/deployments?'));
      expect(deploymentCalls.every((c) => !c.url.includes('environment='))).toBe(true);
    });
  });

  describe('getIncidents', () => {
    it('インシデント（ラベル付きIssue）を正しく取得する', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/issues?labels=incident&state=all&per_page=100&page=1&sort=created&direction=desc',
        200,
        [
          {
            id: 1,
            number: 42,
            title: '[Incident] DB connection error',
            state: 'closed',
            created_at: '2024-01-01T10:00:00Z',
            closed_at: '2024-01-01T12:00:00Z',
            labels: [{ name: 'incident' }, { name: 'p0' }],
          },
        ]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/issues?labels=incident&state=all&per_page=100&page=2&sort=created&direction=desc',
        200,
        []
      );

      const result = getIncidents(testRepo, 'test-token');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].title).toBe('[Incident] DB connection error');
      expect(result.data![0].labels).toContain('incident');
      expect(result.data![0].labels).toContain('p0');
      expect(result.data![0].repository).toBe('test-owner/test-repo');
    });

    it('カスタムラベルでフィルタリングできる', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/issues?labels=production-bug%2Cp0&state=all&per_page=100&page=1&sort=created&direction=desc',
        200,
        [
          {
            id: 1,
            number: 1,
            title: 'Critical bug',
            state: 'open',
            created_at: '2024-01-01T10:00:00Z',
            closed_at: null,
            labels: [{ name: 'production-bug' }, { name: 'p0' }],
          },
        ]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/issues?labels=production-bug%2Cp0&state=all&per_page=100&page=2&sort=created&direction=desc',
        200,
        []
      );

      const result = getIncidents(testRepo, 'test-token', {
        labels: ['production-bug', 'p0'],
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('PRはスキップする', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/issues?labels=incident&state=all&per_page=100&page=1&sort=created&direction=desc',
        200,
        [
          {
            id: 1,
            number: 1,
            title: 'Real incident',
            state: 'closed',
            created_at: '2024-01-01T10:00:00Z',
            closed_at: '2024-01-01T12:00:00Z',
            labels: [{ name: 'incident' }],
          },
          {
            id: 2,
            number: 2,
            title: 'This is a PR',
            state: 'closed',
            created_at: '2024-01-02T10:00:00Z',
            closed_at: '2024-01-02T12:00:00Z',
            labels: [{ name: 'incident' }],
            pull_request: { url: 'https://api.github.com/...' }, // PRの場合この属性がある
          },
        ]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/issues?labels=incident&state=all&per_page=100&page=2&sort=created&direction=desc',
        200,
        []
      );

      const result = getIncidents(testRepo, 'test-token');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1); // PRはスキップ
      expect(result.data![0].title).toBe('Real incident');
    });

    it('日付範囲でフィルタリングする', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/issues?labels=incident&state=all&per_page=100&page=1&sort=created&direction=desc',
        200,
        [
          {
            id: 1,
            number: 1,
            title: 'Old incident',
            state: 'closed',
            created_at: '2023-01-01T10:00:00Z',
            closed_at: '2023-01-01T12:00:00Z',
            labels: [{ name: 'incident' }],
          },
          {
            id: 2,
            number: 2,
            title: 'New incident',
            state: 'closed',
            created_at: '2024-06-01T10:00:00Z',
            closed_at: '2024-06-01T12:00:00Z',
            labels: [{ name: 'incident' }],
          },
        ]
      );

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/issues?labels=incident&state=all&per_page=100&page=2&sort=created&direction=desc',
        200,
        []
      );

      const result = getIncidents(testRepo, 'test-token', {
        dateRange: {
          since: new Date('2024-01-01'),
          until: new Date('2024-12-31'),
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].title).toBe('New incident');
    });

    it('APIエラー時はエラーを返す', () => {
      container.httpClient.setResponse(
        'https://api.github.com/repos/test-owner/test-repo/issues?labels=incident&state=all&per_page=100&page=1&sort=created&direction=desc',
        { statusCode: 404, content: 'Not Found' }
      );

      const result = getIncidents(testRepo, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not Found');
    });
  });

  describe('getPRDetails', () => {
    it('PR詳細を正しく取得する', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls/123',
        200,
        {
          additions: 100,
          deletions: 50,
          changed_files: 5,
        }
      );

      const result = getPRDetails('test-owner', 'test-repo', 123, 'test-token');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        additions: 100,
        deletions: 50,
        changedFiles: 5,
      });
    });

    it('APIエラー時はエラーを返す', () => {
      container.httpClient.setResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls/999',
        { statusCode: 404, content: 'Not Found' }
      );

      const result = getPRDetails('test-owner', 'test-repo', 999, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not Found');
    });

    it('欠損値をデフォルト0で処理する', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls/1',
        200,
        {
          // additions, deletions, changed_files が欠損
        }
      );

      const result = getPRDetails('test-owner', 'test-repo', 1, 'test-token');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        additions: 0,
        deletions: 0,
        changedFiles: 0,
      });
    });
  });

  describe('getPRSizeDataForPRs', () => {
    const testPRs: GitHubPullRequest[] = [
      {
        id: 1,
        number: 1,
        title: 'PR 1',
        state: 'closed',
        createdAt: '2024-01-01T10:00:00Z',
        mergedAt: '2024-01-01T12:00:00Z',
        closedAt: '2024-01-01T12:00:00Z',
        author: 'user1',
        repository: 'test-owner/test-repo',
      },
      {
        id: 2,
        number: 2,
        title: 'PR 2',
        state: 'closed',
        createdAt: '2024-01-02T10:00:00Z',
        mergedAt: '2024-01-02T12:00:00Z',
        closedAt: '2024-01-02T12:00:00Z',
        author: 'user2',
        repository: 'test-owner/test-repo',
      },
    ];

    it('複数PRのサイズデータを取得する', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls/1',
        200,
        { additions: 100, deletions: 50, changed_files: 5 }
      );
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls/2',
        200,
        { additions: 200, deletions: 100, changed_files: 10 }
      );

      const result = getPRSizeDataForPRs(testPRs, 'test-token');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        prNumber: 1,
        title: 'PR 1',
        repository: 'test-owner/test-repo',
        createdAt: '2024-01-01T10:00:00Z',
        mergedAt: '2024-01-01T12:00:00Z',
        additions: 100,
        deletions: 50,
        linesOfCode: 150,
        filesChanged: 5,
      });
      expect(result[1]).toEqual({
        prNumber: 2,
        title: 'PR 2',
        repository: 'test-owner/test-repo',
        createdAt: '2024-01-02T10:00:00Z',
        mergedAt: '2024-01-02T12:00:00Z',
        additions: 200,
        deletions: 100,
        linesOfCode: 300,
        filesChanged: 10,
      });
    });

    it('API失敗時はそのPRをスキップする', () => {
      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls/1',
        200,
        { additions: 100, deletions: 50, changed_files: 5 }
      );
      container.httpClient.setResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls/2',
        { statusCode: 500, content: 'Server Error' }
      );

      const result = getPRSizeDataForPRs(testPRs, 'test-token');

      expect(result).toHaveLength(1);
      expect(result[0].prNumber).toBe(1);
      // 警告ログが出力されていること
      expect(container.logger.logs.some((log) => log.includes('Skipped 1 PRs'))).toBe(true);
    });

    it('不正なリポジトリ形式のPRをスキップする', () => {
      const invalidPRs: GitHubPullRequest[] = [
        {
          id: 1,
          number: 1,
          title: 'PR 1',
          state: 'closed',
          createdAt: '2024-01-01T10:00:00Z',
          mergedAt: '2024-01-01T12:00:00Z',
          closedAt: '2024-01-01T12:00:00Z',
          author: 'user1',
          repository: 'invalid-format', // owner/repo形式ではない
        },
      ];

      const result = getPRSizeDataForPRs(invalidPRs, 'test-token');

      expect(result).toHaveLength(0);
      expect(container.logger.logs.some((log) => log.includes('Invalid repository format'))).toBe(
        true
      );
    });

    it('大量PR取得時に警告を出力する', () => {
      // 51個のPRを作成（警告閾値は50）
      const manyPRs: GitHubPullRequest[] = Array.from({ length: 51 }, (_, i) => ({
        id: i + 1,
        number: i + 1,
        title: `PR ${i + 1}`,
        state: 'closed' as const,
        createdAt: '2024-01-01T10:00:00Z',
        mergedAt: '2024-01-01T12:00:00Z',
        closedAt: '2024-01-01T12:00:00Z',
        author: 'user',
        repository: 'test-owner/test-repo',
      }));

      // 全PRに対してレスポンスを設定
      for (let i = 1; i <= 51; i++) {
        container.httpClient.setJsonResponse(
          `https://api.github.com/repos/test-owner/test-repo/pulls/${i}`,
          200,
          { additions: 10, deletions: 5, changed_files: 2 }
        );
      }

      const result = getPRSizeDataForPRs(manyPRs, 'test-token');

      expect(result).toHaveLength(51);
      expect(
        container.logger.logs.some(
          (log) => log.includes('51 PRs') && log.includes('may take a while')
        )
      ).toBe(true);
    });

    it('空の配列を渡すと空の配列を返す', () => {
      const result = getPRSizeDataForPRs([], 'test-token');

      expect(result).toHaveLength(0);
    });

    it('未マージのPRも正しく処理する', () => {
      const unmergedPR: GitHubPullRequest[] = [
        {
          id: 1,
          number: 1,
          title: 'Unmerged PR',
          state: 'open',
          createdAt: '2024-01-01T10:00:00Z',
          mergedAt: null,
          closedAt: null,
          author: 'user',
          repository: 'test-owner/test-repo',
        },
      ];

      container.httpClient.setJsonResponse(
        'https://api.github.com/repos/test-owner/test-repo/pulls/1',
        200,
        { additions: 50, deletions: 25, changed_files: 3 }
      );

      const result = getPRSizeDataForPRs(unmergedPR, 'test-token');

      expect(result).toHaveLength(1);
      expect(result[0].mergedAt).toBeNull();
      expect(result[0].linesOfCode).toBe(75);
    });
  });
});
