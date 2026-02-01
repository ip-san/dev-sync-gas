/**
 * GraphQLバッチ処理のテスト
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  groupPRsByRepository,
  parseRepository,
} from '../../src/services/github/graphql/batchProcessing';
import type { GitHubPullRequest } from '../../src/types';
import { initializeContainer } from '../../src/container';
import { createMockContainer } from '../mocks';

beforeEach(() => {
  const mocks = createMockContainer();
  initializeContainer(mocks);
});

describe('batchProcessing', () => {
  describe('groupPRsByRepository', () => {
    it('PRをリポジトリごとにグループ化する', () => {
      const prs: GitHubPullRequest[] = [
        {
          number: 1,
          title: 'PR 1',
          state: 'merged',
          createdAt: '2024-01-01T00:00:00Z',
          mergedAt: '2024-01-02T00:00:00Z',
          closedAt: '2024-01-02T00:00:00Z',
          author: 'user1',
          baseBranch: 'main',
          headBranch: 'feature-1',
          repository: 'owner/repo-a',
          labels: [],
        },
        {
          number: 2,
          title: 'PR 2',
          state: 'merged',
          createdAt: '2024-01-03T00:00:00Z',
          mergedAt: '2024-01-04T00:00:00Z',
          closedAt: '2024-01-04T00:00:00Z',
          author: 'user2',
          baseBranch: 'main',
          headBranch: 'feature-2',
          repository: 'owner/repo-b',
          labels: [],
        },
        {
          number: 3,
          title: 'PR 3',
          state: 'merged',
          createdAt: '2024-01-05T00:00:00Z',
          mergedAt: '2024-01-06T00:00:00Z',
          closedAt: '2024-01-06T00:00:00Z',
          author: 'user1',
          baseBranch: 'main',
          headBranch: 'feature-3',
          repository: 'owner/repo-a',
          labels: [],
        },
      ];

      const grouped = groupPRsByRepository(prs);

      expect(grouped.size).toBe(2);
      expect(grouped.get('owner/repo-a')?.length).toBe(2);
      expect(grouped.get('owner/repo-b')?.length).toBe(1);
      expect(grouped.get('owner/repo-a')?.[0].number).toBe(1);
      expect(grouped.get('owner/repo-a')?.[1].number).toBe(3);
      expect(grouped.get('owner/repo-b')?.[0].number).toBe(2);
    });

    it('空配列の場合は空のMapを返す', () => {
      const grouped = groupPRsByRepository([]);
      expect(grouped.size).toBe(0);
    });

    it('同じリポジトリのPRを複数含む配列を処理できる', () => {
      const prs: GitHubPullRequest[] = [
        {
          number: 1,
          title: 'PR 1',
          state: 'merged',
          createdAt: '2024-01-01T00:00:00Z',
          mergedAt: '2024-01-02T00:00:00Z',
          closedAt: '2024-01-02T00:00:00Z',
          author: 'user1',
          baseBranch: 'main',
          headBranch: 'feature-1',
          repository: 'owner/repo',
          labels: [],
        },
        {
          number: 2,
          title: 'PR 2',
          state: 'merged',
          createdAt: '2024-01-03T00:00:00Z',
          mergedAt: '2024-01-04T00:00:00Z',
          closedAt: '2024-01-04T00:00:00Z',
          author: 'user2',
          baseBranch: 'main',
          headBranch: 'feature-2',
          repository: 'owner/repo',
          labels: [],
        },
      ];

      const grouped = groupPRsByRepository(prs);

      expect(grouped.size).toBe(1);
      expect(grouped.get('owner/repo')?.length).toBe(2);
    });

    it('リポジトリ名の順序に関わらずグループ化する', () => {
      const prs: GitHubPullRequest[] = [
        {
          number: 1,
          title: 'PR 1',
          state: 'merged',
          createdAt: '2024-01-01T00:00:00Z',
          mergedAt: '2024-01-02T00:00:00Z',
          closedAt: '2024-01-02T00:00:00Z',
          author: 'user1',
          baseBranch: 'main',
          headBranch: 'feature-1',
          repository: 'owner/repo-b',
          labels: [],
        },
        {
          number: 2,
          title: 'PR 2',
          state: 'merged',
          createdAt: '2024-01-03T00:00:00Z',
          mergedAt: '2024-01-04T00:00:00Z',
          closedAt: '2024-01-04T00:00:00Z',
          author: 'user2',
          baseBranch: 'main',
          headBranch: 'feature-2',
          repository: 'owner/repo-a',
          labels: [],
        },
        {
          number: 3,
          title: 'PR 3',
          state: 'merged',
          createdAt: '2024-01-05T00:00:00Z',
          mergedAt: '2024-01-06T00:00:00Z',
          closedAt: '2024-01-06T00:00:00Z',
          author: 'user1',
          baseBranch: 'main',
          headBranch: 'feature-3',
          repository: 'owner/repo-a',
          labels: [],
        },
      ];

      const grouped = groupPRsByRepository(prs);

      expect(grouped.size).toBe(2);
      expect(grouped.get('owner/repo-a')?.length).toBe(2);
      expect(grouped.get('owner/repo-b')?.length).toBe(1);
    });
  });

  describe('parseRepository', () => {
    it('正しいリポジトリ名をパースする', () => {
      const result = parseRepository('owner/repo');

      expect(result).not.toBeNull();
      expect(result?.owner).toBe('owner');
      expect(result?.repo).toBe('repo');
    });

    it('不正なリポジトリ名の場合はnullを返す', () => {
      expect(parseRepository('invalid-repo')).toBeNull();
      expect(parseRepository('')).toBeNull();
      expect(parseRepository('owner/repo/extra')).toBeNull();
    });

    it('複数の異なるリポジトリ名をパースできる', () => {
      const result1 = parseRepository('facebook/react');
      const result2 = parseRepository('microsoft/vscode');

      expect(result1?.owner).toBe('facebook');
      expect(result1?.repo).toBe('react');
      expect(result2?.owner).toBe('microsoft');
      expect(result2?.repo).toBe('vscode');
    });

    it('ハイフン・アンダースコアを含むリポジトリ名をパースできる', () => {
      const result = parseRepository('my-org/my_repo-123');

      expect(result?.owner).toBe('my-org');
      expect(result?.repo).toBe('my_repo-123');
    });
  });
});
