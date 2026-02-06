#!/usr/bin/env bun
// ドキュメントサイズチェックスクリプト
// CLAUDE_*.mdファイルの肥大化を防ぐ

import { readFileSync, existsSync } from 'fs';

// 色付き出力
const colors = {
  red: (text: string) => `\x1b[0;31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[1;33m${text}\x1b[0m`,
  green: (text: string) => `\x1b[0;32m${text}\x1b[0m`,
};

// 上限設定（行数）
const LIMITS: Record<string, number> = {
  'CLAUDE.md': 80,
  'CLAUDE_COMMANDS.md': 160,
  'CLAUDE_TASKS.md': 120,
  'CLAUDE_NAV.md': 110,
  'CLAUDE_ARCH.md': 200,
};

const TOTAL_LIMIT = 670;
const WARNING_LIMIT = 650;

// ファイルの行数をカウント
function countLines(filepath: string): number {
  if (!existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }
  const content = readFileSync(filepath, 'utf-8');
  return content.split('\n').length;
}

// チェック実行
function checkDocSizes(): boolean {
  let total = 0;
  let hasWarning = false;
  let hasError = false;

  console.log('📊 CLAUDE_*.md サイズチェック');
  console.log('================================');

  const files = [
    'CLAUDE.md',
    'CLAUDE_COMMANDS.md',
    'CLAUDE_TASKS.md',
    'CLAUDE_NAV.md',
    'CLAUDE_ARCH.md',
  ];

  for (const file of files) {
    const lines = countLines(file);
    const limit = LIMITS[file];
    total += lines;

    const padding = ' '.repeat(25 - file.length);
    const lineInfo = `${lines.toString().padStart(4)} / ${limit.toString().padStart(4)} 行`;
    process.stdout.write(`${file}${padding} ${lineInfo} `);

    if (lines > limit) {
      console.log(colors.red(`❌ 超過 (+${lines - limit}行)`));
      hasError = true;
    } else if (lines > limit - 10) {
      console.log(colors.yellow(`⚠️  警告 (残り${limit - lines}行)`));
      hasWarning = true;
    } else {
      console.log(colors.green('✅ OK'));
    }
  }

  console.log('================================');
  const totalPadding = ' '.repeat(25 - '合計'.length);
  const totalLineInfo = `${total.toString().padStart(4)} / ${TOTAL_LIMIT.toString().padStart(4)} 行`;
  process.stdout.write(`合計${totalPadding} ${totalLineInfo} `);

  if (total > TOTAL_LIMIT) {
    console.log(colors.red(`❌ 超過 (+${total - TOTAL_LIMIT}行)`));
    hasError = true;
  } else if (total > WARNING_LIMIT) {
    console.log(colors.yellow(`⚠️  警告 (残り${TOTAL_LIMIT - total}行)`));
    hasWarning = true;
  } else {
    console.log(colors.green(`✅ OK (残り${TOTAL_LIMIT - total}行)`));
  }

  console.log('');

  if (hasError) {
    console.log(colors.red('❌ エラー: ドキュメントサイズが上限を超えています'));
    console.log('');
    console.log('対策:');
    console.log('  1. 詳細な情報をdocs/に移動');
    console.log('  2. 冗長な説明を削除');
    console.log('  3. 箇条書きや表形式で簡潔化');
    console.log('');
    console.log('詳細: docs/DOC_MAINTENANCE.md');
    return false;
  } else if (hasWarning) {
    console.log(colors.yellow('⚠️  警告: ドキュメントサイズが上限に近づいています'));
    console.log('');
    console.log('次回更新時に見直しを検討してください');
    console.log('詳細: docs/DOC_MAINTENANCE.md');
  } else {
    console.log(colors.green('✅ すべてのドキュメントサイズが適切です'));
  }

  return true;
}

// メイン処理
try {
  const success = checkDocSizes();
  process.exit(success ? 0 : 1);
} catch (error) {
  console.error(colors.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
  process.exit(1);
}
