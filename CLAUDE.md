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

## ⚡️ よく使うコマンド

```bash
bun run push              # ビルド + デプロイ
bun run check:all         # 全品質チェック
bunx tsc --noEmit && bun run lint && bun test && bun run build  # 完了前チェック
```

```javascript
checkConfig()             // 設定診断（困ったら最初に実行）
syncDevOpsMetrics()       // メイン同期（Dashboard/チャート自動生成）
```

## 🛠 利用可能なツール

**Claude Code カスタムskill:**
- `/review` - コード変更レビュー + lint/test/型チェック実行
- `/pr-check` - PR作成前セルフチェック（lint/test/build）
- `/dora-validate` - DORA metrics計算ロジックの正当性検証

**技術スタック:** TypeScript + Bun + esbuild + clasp → Google Apps Script

## 📚 詳細情報

**必要な時に [CLAUDE_REF.md](CLAUDE_REF.md) を Read tool で参照してください:**
- キーワード検索（GitHub API、DORA計算、エラーハンドリング等）
- タスク別フロー（新機能実装、バグ修正、指標追加、トラブルシューティング等）
- 全コマンドリファレンス（GAS関数、設定変更コマンド等）
- ドキュメント索引（20個のドキュメントへのマッピング）
- ファイルパス逆引き（src/services/github/ → 関連ドキュメント）
- アーキテクチャ概要とディレクトリ構造

## 🎯 重要事項

**計測思想:** Issue作成 = 作業開始（[MEASUREMENT_PHILOSOPHY.md](docs/MEASUREMENT_PHILOSOPHY.md)）
**API選択:** GraphQL優先（レート制限対策、[ADR-0001](docs/adr/0001-graphql-api-default.md)）
**DI採用:** GAS抽象化・テスト容易性（[ADR-0002](docs/adr/0002-di-container-for-gas-abstraction.md)）
