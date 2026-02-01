/**
 * デプロイメントヘルパーのテスト
 */

import { describe, it, expect } from 'bun:test';
import {
  isWithinDateRange,
  matchesEnvironmentFilter,
  convertToGitHubDeployment,
  buildDeploymentEndpoint,
  processDeploymentPage,
  processDeployment,
} from '../../src/services/github/deploymentHelpers';
import type { GitHubDeploymentResponse } from '../../src/types';

describe('deploymentHelpers', () => {
  describe('isWithinDateRange', () => {
    it('期間指定なしの場合は常にtrueを返す', () => {
      const date = new Date('2024-01-15T00:00:00Z');
      expect(isWithinDateRange(date, undefined)).toBe(true);
    });

    it('sinceのみ指定した場合、それ以降のみtrueを返す', () => {
      const since = new Date('2024-01-10T00:00:00Z');

      expect(isWithinDateRange(new Date('2024-01-09T23:59:59Z'), { since })).toBe(false);
      expect(isWithinDateRange(new Date('2024-01-10T00:00:00Z'), { since })).toBe(true);
      expect(isWithinDateRange(new Date('2024-01-15T00:00:00Z'), { since })).toBe(true);
    });

    it('untilのみ指定した場合、それ以前のみtrueを返す', () => {
      const until = new Date('2024-01-20T00:00:00Z');

      expect(isWithinDateRange(new Date('2024-01-15T00:00:00Z'), { until })).toBe(true);
      expect(isWithinDateRange(new Date('2024-01-20T00:00:00Z'), { until })).toBe(true);
      expect(isWithinDateRange(new Date('2024-01-20T00:00:01Z'), { until })).toBe(false);
    });

    it('since-until両方指定した場合、その期間内のみtrueを返す', () => {
      const since = new Date('2024-01-10T00:00:00Z');
      const until = new Date('2024-01-20T00:00:00Z');

      expect(isWithinDateRange(new Date('2024-01-09T23:59:59Z'), { since, until })).toBe(false);
      expect(isWithinDateRange(new Date('2024-01-10T00:00:00Z'), { since, until })).toBe(true);
      expect(isWithinDateRange(new Date('2024-01-15T00:00:00Z'), { since, until })).toBe(true);
      expect(isWithinDateRange(new Date('2024-01-20T00:00:00Z'), { since, until })).toBe(true);
      expect(isWithinDateRange(new Date('2024-01-20T00:00:01Z'), { since, until })).toBe(false);
    });
  });

  describe('matchesEnvironmentFilter', () => {
    const deployment: GitHubDeploymentResponse = {
      id: 1,
      sha: 'abc123',
      environment: 'production',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    it('環境フィルタ未指定の場合は常にtrueを返す', () => {
      expect(matchesEnvironmentFilter(deployment, undefined, 'exact')).toBe(true);
      expect(matchesEnvironmentFilter(deployment, undefined, 'partial')).toBe(true);
    });

    it('exactモードでは常にtrueを返す（API側でフィルタ済み想定）', () => {
      expect(matchesEnvironmentFilter(deployment, 'production', 'exact')).toBe(true);
      expect(matchesEnvironmentFilter(deployment, 'staging', 'exact')).toBe(true);
    });

    it('partialモードでは部分一致でフィルタする', () => {
      expect(matchesEnvironmentFilter(deployment, 'prod', 'partial')).toBe(true);
      expect(matchesEnvironmentFilter(deployment, 'production', 'partial')).toBe(true);
      expect(matchesEnvironmentFilter(deployment, 'staging', 'partial')).toBe(false);
    });

    it('partialモードでは大文字小文字を区別しない', () => {
      expect(matchesEnvironmentFilter(deployment, 'PROD', 'partial')).toBe(true);
      expect(matchesEnvironmentFilter(deployment, 'Production', 'partial')).toBe(true);
    });

    it('environmentがundefinedの場合は部分一致でfalseを返す', () => {
      const deploymentWithoutEnv: GitHubDeploymentResponse = {
        ...deployment,
        environment: undefined,
      };
      expect(matchesEnvironmentFilter(deploymentWithoutEnv, 'prod', 'partial')).toBe(false);
    });
  });

  describe('convertToGitHubDeployment', () => {
    it('APIレスポンスを正しく変換する', () => {
      const response: GitHubDeploymentResponse = {
        id: 123,
        sha: 'abc123def456',
        environment: 'production',
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T11:00:00Z',
      };

      const result = convertToGitHubDeployment(response, 'owner/repo');

      expect(result.id).toBe(123);
      expect(result.sha).toBe('abc123def456');
      expect(result.environment).toBe('production');
      expect(result.createdAt).toBe('2024-01-01T10:00:00Z');
      expect(result.updatedAt).toBe('2024-01-01T11:00:00Z');
      expect(result.status).toBeNull();
      expect(result.repository).toBe('owner/repo');
    });

    it('environmentがundefinedの場合も正しく変換する', () => {
      const response: GitHubDeploymentResponse = {
        id: 123,
        sha: 'abc123',
        environment: undefined,
        created_at: '2024-01-01T10:00:00Z',
        updated_at: '2024-01-01T11:00:00Z',
      };

      const result = convertToGitHubDeployment(response, 'owner/repo');

      expect(result.environment).toBeUndefined();
    });
  });

  describe('buildDeploymentEndpoint', () => {
    it('基本的なエンドポイントを構築する', () => {
      const endpoint = buildDeploymentEndpoint({
        repoFullName: 'owner/repo',
        page: 1,
        perPage: 100,
        environment: undefined,
        useApiFilter: false,
      });

      expect(endpoint).toBe('/repos/owner/repo/deployments?per_page=100&page=1');
    });

    it('環境フィルタありのエンドポイントを構築する', () => {
      const endpoint = buildDeploymentEndpoint({
        repoFullName: 'owner/repo',
        page: 2,
        perPage: 50,
        environment: 'production',
        useApiFilter: true,
      });

      expect(endpoint).toBe(
        '/repos/owner/repo/deployments?per_page=50&page=2&environment=production'
      );
    });

    it('環境名を正しくエンコードする', () => {
      const endpoint = buildDeploymentEndpoint({
        repoFullName: 'owner/repo',
        page: 1,
        perPage: 100,
        environment: 'prod & staging',
        useApiFilter: true,
      });

      expect(endpoint).toContain('&environment=prod%20%26%20staging');
    });

    it('useApiFilterがfalseの場合は環境パラメータを追加しない', () => {
      const endpoint = buildDeploymentEndpoint({
        repoFullName: 'owner/repo',
        page: 1,
        perPage: 100,
        environment: 'production',
        useApiFilter: false,
      });

      expect(endpoint).not.toContain('environment=');
    });
  });

  describe('processDeploymentPage', () => {
    it('正常なレスポンスの場合はshouldContinue: trueを返す', () => {
      const deployments: any[] = [];
      const result = processDeploymentPage({
        response: {
          success: true,
          data: [
            {
              id: 1,
              sha: 'abc',
              environment: 'production',
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
        },
        page: 1,
        repoFullName: 'owner/repo',
        environment: undefined,
        environmentMatchMode: 'exact',
        dateRange: undefined,
        allDeployments: deployments,
      });

      expect(result.shouldContinue).toBe(true);
      expect(result.error).toBeUndefined();
      expect(deployments.length).toBe(1);
    });

    it('空ページの場合はshouldContinue: falseを返す', () => {
      const deployments: any[] = [];
      const result = processDeploymentPage({
        response: {
          success: true,
          data: [],
        },
        page: 2,
        repoFullName: 'owner/repo',
        environment: undefined,
        environmentMatchMode: 'exact',
        dateRange: undefined,
        allDeployments: deployments,
      });

      expect(result.shouldContinue).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('1ページ目のエラーの場合はエラーメッセージを返す', () => {
      const deployments: any[] = [];
      const result = processDeploymentPage({
        response: {
          success: false,
          error: 'API Error',
        },
        page: 1,
        repoFullName: 'owner/repo',
        environment: undefined,
        environmentMatchMode: 'exact',
        dateRange: undefined,
        allDeployments: deployments,
      });

      expect(result.shouldContinue).toBe(false);
      expect(result.error).toBe('API Error');
    });

    it('2ページ目以降のエラーの場合はエラーメッセージなしで終了', () => {
      const deployments: any[] = [];
      const result = processDeploymentPage({
        response: {
          success: false,
          error: 'API Error',
        },
        page: 2,
        repoFullName: 'owner/repo',
        environment: undefined,
        environmentMatchMode: 'exact',
        dateRange: undefined,
        allDeployments: deployments,
      });

      expect(result.shouldContinue).toBe(false);
      expect(result.error).toBeUndefined();
    });
  });

  describe('processDeployment', () => {
    it('条件に合致するデプロイメントを配列に追加する', () => {
      const deployments: any[] = [];
      const deployment: GitHubDeploymentResponse = {
        id: 1,
        sha: 'abc',
        environment: 'production',
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      };

      processDeployment({
        deployment,
        repoFullName: 'owner/repo',
        environment: undefined,
        environmentMatchMode: 'exact',
        dateRange: undefined,
        allDeployments: deployments,
      });

      expect(deployments.length).toBe(1);
      expect(deployments[0].id).toBe(1);
    });

    it('期間外のデプロイメントは追加しない', () => {
      const deployments: any[] = [];
      const deployment: GitHubDeploymentResponse = {
        id: 1,
        sha: 'abc',
        environment: 'production',
        created_at: '2024-01-05T00:00:00Z',
        updated_at: '2024-01-05T00:00:00Z',
      };

      processDeployment({
        deployment,
        repoFullName: 'owner/repo',
        environment: undefined,
        environmentMatchMode: 'exact',
        dateRange: {
          since: new Date('2024-01-10T00:00:00Z'),
        },
        allDeployments: deployments,
      });

      expect(deployments.length).toBe(0);
    });

    it('環境フィルタに合致しないデプロイメントは追加しない', () => {
      const deployments: any[] = [];
      const deployment: GitHubDeploymentResponse = {
        id: 1,
        sha: 'abc',
        environment: 'staging',
        created_at: '2024-01-15T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      };

      processDeployment({
        deployment,
        repoFullName: 'owner/repo',
        environment: 'production',
        environmentMatchMode: 'partial',
        dateRange: undefined,
        allDeployments: deployments,
      });

      expect(deployments.length).toBe(0);
    });
  });
});
