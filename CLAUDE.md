# DevSyncGAS

GitHub複数リポジトリ → DORA metrics収集 → Googleスプレッドシート出力（GAS）

## 🚨 制約（必ず遵守）

**GAS環境:**
- `fetch` ❌ → `UrlFetchApp.fetch` ✅
- グローバル関数: `global.functionName = functionName`
- ストレージ: `PropertiesService.getScriptProperties()`
- 型定義: `@types/google-apps-script`

**セキュリティ:**
- 機密情報は PropertiesService のみに保存
- `src/init.ts` に認証情報を残さない（initConfig実行後は削除推奨）
- エラーログに認証情報を含めない

**コーディング原則:**
- 要求された機能のみ実装（過剰エンジニアリング禁止）
- 1回限りの処理に抽象化・ヘルパー関数不要
- 未使用コードは完全削除（後方互換性ハック不要）
- セキュリティ脆弱性に注意（XSS/SQLi/Command Injection）

**ドキュメント原則:**
- CLAUDE_*.mdは670行以下に維持（現在: 597行）
- 詳細情報はdocs/に委譲（頻出情報のみCLAUDE_*.mdに記載）
- 追加前チェック: `bun run check:doc`（詳細: [DOC_MAINTENANCE.md](docs/DOC_MAINTENANCE.md)）

## ⚡️ よく使うコマンド

```bash
bun run push              # ビルド + デプロイ
bun run deploy            # 完全チェック後にデプロイ（推奨）
bun run prepush           # PR前の完全チェック（型・lint・test・build）
bun run precommit         # コミット前の最小チェック（lint・test）
bun run check:doc         # ドキュメントサイズチェック
```

```javascript
checkConfig()                  // 設定診断（困ったら最初に実行）
syncAllMetrics(30)             // 全指標同期（DORA+拡張、期間指定）
syncAllMetricsIncremental()    // 差分更新（定期実行用）
```

## 🛠 利用可能なツール

**Claude Code カスタムskill:**
- `/review` - コード変更レビュー + lint/test/型チェック実行
- `/pr-check` - PR作成前セルフチェック（全品質チェック + build）
- `/quality-check` - 全品質チェック一括実行（Biome/tsc/test/circular/knip/type-coverage/jscpd）
- `/dora-validate` - DORA metrics計算ロジックの正当性検証

**技術スタック:** TypeScript + Bun + esbuild + clasp → Google Apps Script
**静的解析:** Biome (lint + format) + knip (未使用コード検出) + jscpd (コピペ検出) + madge (循環参照) + type-coverage

## 📚 詳細情報

**必要な時に以下のガイドをRead toolで参照してください:**
- **[CLAUDE_COMMANDS.md](CLAUDE_COMMANDS.md)** - コマンドリファレンス、GAS関数、よくあるパターン
- **[CLAUDE_TASKS.md](CLAUDE_TASKS.md)** - タスク別フロー（新機能実装、バグ修正、指標追加、PR作成前等）
- **[CLAUDE_NAV.md](CLAUDE_NAV.md)** - キーワード検索、ファイルパス逆引き、ドキュメント索引
- **[CLAUDE_ARCH.md](CLAUDE_ARCH.md)** - アーキテクチャ概要、ディレクトリ構造、設計思想
- **[docs/](docs/)** - 各機能の詳細仕様（33個のドキュメント）

## 🎯 重要事項

**計測思想:** Issue作成 = 作業開始（[MEASUREMENT_PHILOSOPHY.md](docs/MEASUREMENT_PHILOSOPHY.md)）
**API選択:** GraphQL優先（レート制限対策、[ADR-0001](docs/adr/0001-graphql-api-default.md)）
**DI採用:** GAS抽象化・テスト容易性（[ADR-0002](docs/adr/0002-di-container-for-gas-abstraction.md)）
