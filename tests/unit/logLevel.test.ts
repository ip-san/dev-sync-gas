/**
 * ログレベル制御のテスト
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  getLogLevel,
  setLogLevel,
  resetLogLevel,
  shouldLog,
  DEFAULT_LOG_LEVEL,
} from '../../src/utils/logLevel';
import { createMockContainer } from '../mocks';
import { initializeContainer } from '../../src/container';

describe('Log Level Control', () => {
  beforeEach(() => {
    // 各テスト前にコンテナをリセット
    const mockContainer = createMockContainer();
    initializeContainer(mockContainer);
  });

  describe('getLogLevel', () => {
    test('デフォルトではINFOレベルを返す', () => {
      const level = getLogLevel();
      expect(level).toBe(DEFAULT_LOG_LEVEL);
      expect(level).toBe('INFO');
    });

    test('設定されたログレベルを返す', () => {
      setLogLevel('DEBUG');
      expect(getLogLevel()).toBe('DEBUG');

      setLogLevel('WARN');
      expect(getLogLevel()).toBe('WARN');

      setLogLevel('ERROR');
      expect(getLogLevel()).toBe('ERROR');
    });

    test('無効な値が保存されている場合はデフォルトを返す', () => {
      const mockContainer = createMockContainer();
      mockContainer.storageClient.setProperty('LOG_LEVEL', 'INVALID');
      initializeContainer(mockContainer);

      expect(getLogLevel()).toBe(DEFAULT_LOG_LEVEL);
    });
  });

  describe('setLogLevel', () => {
    test('有効なログレベルを設定できる', () => {
      setLogLevel('DEBUG');
      expect(getLogLevel()).toBe('DEBUG');

      setLogLevel('INFO');
      expect(getLogLevel()).toBe('INFO');

      setLogLevel('WARN');
      expect(getLogLevel()).toBe('WARN');

      setLogLevel('ERROR');
      expect(getLogLevel()).toBe('ERROR');
    });

    test('無効なログレベルを設定するとエラー', () => {
      expect(() => setLogLevel('INVALID' as any)).toThrow(
        'Invalid log level: INVALID. Must be one of: DEBUG, INFO, WARN, ERROR'
      );
    });
  });

  describe('resetLogLevel', () => {
    test('ログレベルをデフォルトにリセット', () => {
      setLogLevel('DEBUG');
      expect(getLogLevel()).toBe('DEBUG');

      resetLogLevel();
      expect(getLogLevel()).toBe(DEFAULT_LOG_LEVEL);
    });
  });

  describe('shouldLog', () => {
    test('DEBUG設定時はすべてのレベルが出力される', () => {
      setLogLevel('DEBUG');

      expect(shouldLog('DEBUG')).toBe(true);
      expect(shouldLog('INFO')).toBe(true);
      expect(shouldLog('WARN')).toBe(true);
      expect(shouldLog('ERROR')).toBe(true);
    });

    test('INFO設定時はDEBUGは出力されない', () => {
      setLogLevel('INFO');

      expect(shouldLog('DEBUG')).toBe(false);
      expect(shouldLog('INFO')).toBe(true);
      expect(shouldLog('WARN')).toBe(true);
      expect(shouldLog('ERROR')).toBe(true);
    });

    test('WARN設定時はINFO以下は出力されない', () => {
      setLogLevel('WARN');

      expect(shouldLog('DEBUG')).toBe(false);
      expect(shouldLog('INFO')).toBe(false);
      expect(shouldLog('WARN')).toBe(true);
      expect(shouldLog('ERROR')).toBe(true);
    });

    test('ERROR設定時はERRORのみ出力される', () => {
      setLogLevel('ERROR');

      expect(shouldLog('DEBUG')).toBe(false);
      expect(shouldLog('INFO')).toBe(false);
      expect(shouldLog('WARN')).toBe(false);
      expect(shouldLog('ERROR')).toBe(true);
    });
  });
});
