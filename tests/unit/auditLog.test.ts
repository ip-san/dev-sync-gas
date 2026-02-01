/**
 * 監査ログのテスト
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { auditLog } from '../../src/utils/auditLog';
import { initializeContainer } from '../../src/container';
import { createMockContainer } from '../mocks';

describe('auditLog', () => {
  let mocks: ReturnType<typeof createMockContainer>;

  beforeEach(() => {
    mocks = createMockContainer();
    initializeContainer(mocks);
    mocks.logger.clear();
  });

  it('正常系: 監査ログを記録する', () => {
    auditLog('setup.pat', { repository: 'owner/repo' }, 'success');

    const logs = mocks.logger.logs;
    expect(logs.length).toBeGreaterThan(0);

    const auditLogEntry = logs.find((log) => log.includes('[AUDIT]'));
    expect(auditLogEntry).toBeDefined();
    expect(auditLogEntry).toContain('setup.pat');
    expect(auditLogEntry).toContain('owner/repo');
    expect(auditLogEntry).toContain('success');
  });

  it('失敗時のログを記録する', () => {
    auditLog(
      'repository.add',
      { owner: 'test', repo: 'repo' },
      'failure',
      'Repository already exists'
    );

    const logs = mocks.logger.logs;
    const auditLogEntry = logs.find((log) => log.includes('[AUDIT]'));

    expect(auditLogEntry).toBeDefined();
    expect(auditLogEntry).toContain('failure');
    expect(auditLogEntry).toContain('Repository already exists');
  });

  it('複数のアクションタイプを記録できる', () => {
    auditLog('setup.github_app', { appId: '12345' }, 'success');
    auditLog('repository.remove', { repository: 'owner/repo' }, 'success');
    auditLog('project.create', { name: 'My Project' }, 'success');
    auditLog('trigger.create', { functionName: 'syncDaily' }, 'success');

    const logs = mocks.logger.logs;
    const auditLogs = logs.filter((log) => log.includes('[AUDIT]'));

    expect(auditLogs.length).toBe(4);
    expect(auditLogs[0]).toContain('setup.github_app');
    expect(auditLogs[1]).toContain('repository.remove');
    expect(auditLogs[2]).toContain('project.create');
    expect(auditLogs[3]).toContain('trigger.create');
  });

  it('detailsが空オブジェクトでも記録できる', () => {
    auditLog('sync.execute', {}, 'success');

    const logs = mocks.logger.logs;
    const auditLogEntry = logs.find((log) => log.includes('[AUDIT]'));

    expect(auditLogEntry).toBeDefined();
    expect(auditLogEntry).toContain('sync.execute');
  });

  it('タイムスタンプが含まれる', () => {
    auditLog('migration.execute', { version: '2.0' }, 'success');

    const logs = mocks.logger.logs;
    const auditLogEntry = logs.find((log) => log.includes('[AUDIT]'));

    expect(auditLogEntry).toBeDefined();
    expect(auditLogEntry).toMatch(/timestamp.*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('ユーザー情報が含まれる（テスト環境ではunknown）', () => {
    auditLog('config.api_mode.set', { mode: 'graphql' }, 'success');

    const logs = mocks.logger.logs;
    const auditLogEntry = logs.find((log) => log.includes('[AUDIT]'));

    expect(auditLogEntry).toBeDefined();
    expect(auditLogEntry).toContain('unknown');
  });

  it('デフォルトステータスはsuccessである', () => {
    auditLog('project.update', { projectId: '123', name: 'Updated' });

    const logs = mocks.logger.logs;
    const auditLogEntry = logs.find((log) => log.includes('[AUDIT]'));

    expect(auditLogEntry).toBeDefined();
    expect(auditLogEntry).toContain('success');
  });

  it('エラーメッセージなしでも失敗を記録できる', () => {
    auditLog('project.delete', { projectId: '999' }, 'failure');

    const logs = mocks.logger.logs;
    const auditLogEntry = logs.find((log) => log.includes('[AUDIT]'));

    expect(auditLogEntry).toBeDefined();
    expect(auditLogEntry).toContain('failure');
  });
});
