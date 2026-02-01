import { describe, it, expect } from 'bun:test';
import { shouldExcludeByLabels } from '../../src/utils/labelFilter';

describe('shouldExcludeByLabels', () => {
  it('除外ラベルが含まれている場合、trueを返す', () => {
    const result = shouldExcludeByLabels(['bug', 'exclude-metrics'], ['exclude-metrics']);
    expect(result).toBe(true);
  });

  it('除外ラベルが含まれている場合（複数ラベル）、trueを返す', () => {
    const result = shouldExcludeByLabels(['bot', 'dependencies'], ['exclude-metrics', 'bot']);
    expect(result).toBe(true);
  });

  it('除外ラベルが含まれていない場合、falseを返す', () => {
    const result = shouldExcludeByLabels(['bug', 'feature'], ['exclude-metrics']);
    expect(result).toBe(false);
  });

  it('除外ラベルが空配列の場合、常にfalseを返す', () => {
    const result = shouldExcludeByLabels(['exclude-metrics'], []);
    expect(result).toBe(false);
  });

  it('アイテムラベルが空配列の場合、falseを返す', () => {
    const result = shouldExcludeByLabels([], ['exclude-metrics']);
    expect(result).toBe(false);
  });

  it('両方とも空配列の場合、falseを返す', () => {
    const result = shouldExcludeByLabels([], []);
    expect(result).toBe(false);
  });
});
