# DevSyncGAS - ナビゲーションガイド

情報を素早く見つけるためのナビゲーションマップ。

---

## 🔍 クイックナビゲーション（キーワード検索）

| キーワード | ドキュメント | 関連ファイル |
|-----------|-------------|------------|
| **GitHub API実装** | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | src/services/github/ |
| **GraphQL vs REST** | [ADR-0001](docs/adr/0001-graphql-api-default.md) | src/services/github/graphql/, rest/ |
| **DORA指標計算** | [DORA_METRICS.md](docs/DORA_METRICS.md) | src/services/metrics/ |
| **拡張指標計算** | [EXTENDED_METRICS.md](docs/EXTENDED_METRICS.md) | src/services/metrics/ |
| **PRサイズ除外設定** | [PR_SIZE.md](docs/PR_SIZE.md) | src/config/metrics.ts, src/functions/extendedMetrics.ts |
| **スプレッドシート操作** | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | src/services/spreadsheet/ |
| **チャート生成** | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | src/services/spreadsheet/charts.ts |
| **DIコンテナ** | [ADR-0002](docs/adr/0002-di-container-for-gas-abstraction.md) | src/core/container.ts |
| **エラーハンドリング** | src/utils/errors.ts | ErrorCode 1000-9000番台 |
| **初期設定** | [SETUP.md](docs/SETUP.md) | src/init.ts |
| **GitHub Apps認証** | [GITHUB_APPS_AUTH.md](docs/GITHUB_APPS_AUTH.md) | src/core/config.ts |
| **Slack通知** | src/functions/slack.ts | 週次レポート、インシデント日次サマリー |
| **トラブルシューティング** | [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | checkConfig() |

---

## 📂 ファイルパス逆引き索引

| ファイル/ディレクトリ | 関連ドキュメント | 用途 |
|---------------------|-----------------|------|
| `src/functions/` | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | GAS公開関数（global.*でエクスポート） |
| `src/services/github/` | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | GitHub API実装（GraphQL/REST） |
| `src/services/metrics/` | [DORA_METRICS.md](docs/DORA_METRICS.md) | DORA + 拡張指標計算ロジック |
| `src/services/spreadsheet/` | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | スプレッドシート操作、シート生成、チャート |
| `src/core/container.ts` | [ADR-0002](docs/adr/0002-di-container-for-gas-abstraction.md) | DIコンテナ、依存性注入 |
| `src/core/config.ts` | [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 設定管理、Secret Manager |
| `src/utils/errors.ts` | src/utils/errors.ts | カスタムエラークラス、ErrorCode |
| `src/utils/logger.ts` | [LOGGING_GUIDELINES.md](docs/LOGGING_GUIDELINES.md) | ログ管理、ログレベル制御 |
| `src/init.ts` | [SETUP.md](docs/SETUP.md) | 初期設定ファイル |

---

## 🗂 ドキュメントマトリックス

### Claudeガイド（開発作業用）
| ドキュメント | 内容 | 読むタイミング |
|-------------|------|--------------|
| [CLAUDE.md](CLAUDE.md) | プロジェクト概要、制約、よく使うコマンド | 最初に必ず読む |
| [CLAUDE_COMMANDS.md](CLAUDE_COMMANDS.md) | コマンドリファレンス、GAS関数 | 日常作業で参照 |
| [CLAUDE_TASKS.md](CLAUDE_TASKS.md) | タスク別フロー（実装、バグ修正等） | 作業開始前 |
| [CLAUDE_NAV.md](CLAUDE_NAV.md) | キーワード検索、ファイルパス逆引き | 情報を探す時（このファイル） |
| [CLAUDE_ARCH.md](CLAUDE_ARCH.md) | アーキテクチャ概要、設計思想 | 全体像を理解したい時 |

### セットアップ・設定
| ドキュメント | 内容 | 読むタイミング |
|-------------|------|--------------|
| [SETUP.md](docs/SETUP.md) | 初期設定、認証設定、clasp、初回デプロイ | 初回セットアップ時 |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | 診断ツール、エラー解決 | エラー発生時 |
| [FAQ.md](docs/FAQ.md) | よくある質問 | 疑問点がある時 |
| [QUICK_START.md](docs/QUICK_START.md) | 5分で動かす手順 | 初回セットアップ時 |
| [GITHUB_APPS_AUTH.md](docs/GITHUB_APPS_AUTH.md) | GitHub App作成、Private Key | GitHub Apps認証を選択する場合 |

### 設計・機能
| ドキュメント | 内容 | 読むタイミング |
|-------------|------|--------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 全体設計、データフロー、技術選定 | プロジェクト全体を理解したい時 |
| [DORA_METRICS.md](docs/DORA_METRICS.md) | DORA指標の計算方法 | DORA指標の実装を理解・修正したい時 |
| [EXTENDED_METRICS.md](docs/EXTENDED_METRICS.md) | 拡張指標の計算方法 | 拡張指標の実装を理解・修正したい時 |
| [ADDING_METRICS.md](docs/ADDING_METRICS.md) | 新しい指標の追加手順 | 新しい指標を追加したい時 |
| [docs/adr/](docs/adr/) | 設計判断記録（ADR） | 設計判断の背景を知りたい時 |

### 開発・保守
| ドキュメント | 内容 | 読むタイミング |
|-------------|------|--------------|
| [CODE_QUALITY.md](docs/CODE_QUALITY.md) | コード品質基準、チェックツール | コード品質を向上させたい時 |
| [REFACTORING_GUIDE.md](docs/REFACTORING_GUIDE.md) | リファクタリング手法 | リファクタリングを実施したい時 |
| [LOGGING_GUIDELINES.md](docs/LOGGING_GUIDELINES.md) | ログガイドライン | ログ実装・デバッグ時 |
| [SECURITY.md](docs/SECURITY.md) | セキュリティガイドライン | セキュリティ要件を確認したい時 |

---

## 🎯 目的別のドキュメント探索パス

### 初めてプロジェクトに参加
1. [CLAUDE.md](CLAUDE.md) → 2. [QUICK_START.md](docs/QUICK_START.md) → 3. [SETUP.md](docs/SETUP.md) → 4. [ARCHITECTURE.md](docs/ARCHITECTURE.md)

### 機能を追加したい
1. [CLAUDE_TASKS.md](CLAUDE_TASKS.md) → 2. [CLAUDE_NAV.md](CLAUDE_NAV.md) → 3. [CLAUDE_ARCH.md](CLAUDE_ARCH.md) → 4. [CLAUDE_COMMANDS.md](CLAUDE_COMMANDS.md)

### バグを修正したい
1. [CLAUDE_TASKS.md](CLAUDE_TASKS.md) → 2. [CLAUDE_COMMANDS.md](CLAUDE_COMMANDS.md) → 3. [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

### 新しい指標を追加したい
1. [CLAUDE_TASKS.md](CLAUDE_TASKS.md) → 2. [ADDING_METRICS.md](docs/ADDING_METRICS.md) → 3. [DORA_METRICS.md](docs/DORA_METRICS.md) / [EXTENDED_METRICS.md](docs/EXTENDED_METRICS.md)

### コードをリファクタリングしたい
1. [CLAUDE_TASKS.md](CLAUDE_TASKS.md) → 2. [REFACTORING_GUIDE.md](docs/REFACTORING_GUIDE.md) → 3. [CODE_QUALITY.md](docs/CODE_QUALITY.md)

### 設計判断を記録したい
1. [docs/adr/README.md](docs/adr/README.md) → 2. [docs/adr/0000-template.md](docs/adr/0000-template.md)
