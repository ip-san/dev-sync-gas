---
name: quality-check
description: 全品質チェック（Biome/tsc/test/circular/knip/type-coverage/jscpd）を一括実行し結果を報告
disable-model-invocation: true
allowed-tools: Bash Read Grep Glob
---

# 品質チェック一括実行

全静的解析・テストを一括実行し、結果をサマリーで報告します。

## 実行手順

以下の7項目を順番に実行し、各結果を記録してください。
エラーが発生しても途中で止めず、**すべてのチェックを最後まで実行**してください。

### 1. Biome check（lint + format）
```bash
bun run check
```

### 2. 型チェック
```bash
bunx tsc --noEmit
```

### 3. テスト
```bash
bun test
```

### 4. 循環参照チェック
```bash
bun run check:circular
```

### 5. 未使用コード検出（knip）
```bash
bun run check:unused
```

### 6. 型カバレッジ
```bash
bun run check:types
```

### 7. コピペ検出（jscpd）
```bash
bun run cpd
```

## 報告フォーマット

すべての実行が完了したら、以下の形式で報告してください：

```
## 品質チェック結果

| チェック項目 | 結果 | 詳細 |
|---|---|---|
| Biome (lint + format) | PASS / FAIL | エラー数、warning数 |
| TypeScript型チェック | PASS / FAIL | エラー数 |
| テスト | PASS / FAIL | パス数 / 失敗数 |
| 循環参照 | PASS / FAIL | 検出数 |
| 未使用コード (knip) | PASS / FAIL | 検出数 |
| 型カバレッジ | PASS / FAIL | カバレッジ率 |
| コピペ検出 (jscpd) | PASS / FAIL | 重複率 |

### 要対応
- [ファイル:行] 問題の詳細

### 推奨改善（任意）
- 改善提案
```

## 注意事項
- `bun run check:all` はBiome + 循環参照 + knip + 型カバレッジ + tscを一括実行しますが、このskillではテストとjscpdも含めた完全版を実行します
- warning は件数のみ報告し、個別の列挙は不要です
- error がある場合は具体的なファイル名と行番号を報告してください
