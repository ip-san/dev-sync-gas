# DevSyncGAS

**AIと一緒に開発するチームのための、開発生産性ダッシュボード**

GitHub × Google スプレッドシートで、コードを書いてからリリースまでの全てを可視化します。

---

## 業界標準のDORA指標を、自動で計測

Google Cloudの研究チームが確立した**DORA指標（DevOps Research and Assessment）**を、GitHubのデータから自動収集。

**デプロイ頻度・リードタイム・変更障害率・平均修復時間**の4つの指標で、開発チームのパフォーマンスを客観的に評価します。

---

## AIを使って、本当に速くなった？

Claude CodeやCopilotを導入して「コードを書く速度は上がった気がする」。

でも、こんな疑問はありませんか？

- レビューに時間がかかるようになった気がする
- 手戻りが増えてないか心配
- 「速くなった」を数字で証明できない

DevSyncGASは、**感覚ではなくデータで判断する**ためのツールです。

---

## なぜDORA指標なのか？

スプリントベロシティ（こなしたストーリーポイント数）は、AI時代には[虚栄の指標になりつつあります](https://www.scrum.org/resources/blog/velocity-agent-efficiency-evidence-based-management-ai-era)。AIが4秒でコードを生成しても、検証の複雑さは変わらないからです。

代わりに注目されているのが、**DORA指標（DevOps Research and Assessment）**です。

Google Cloudの研究チームが7年以上の研究で確立した、**ソフトウェア開発チームのパフォーマンスを測る4つの指標**です。

| 指標 | 何を測るか | なぜ重要か |
|------|-----------|-----------|
| **デプロイ頻度** | どれだけ頻繁にリリースしているか | 価値提供のスピード |
| **リードタイム** | PR作成から本番デプロイまでの時間 | 実装サイクルの速さ |
| **変更障害率** | デプロイで不具合が起きる割合 | リリースの品質 |
| **平均修復時間（MTTR）** | 障害発生から復旧までの時間 | 回復力の高さ |

これら4指標は、**「速く」かつ「安定して」価値を届けられているか**を客観的に評価します。

### ベロシティとの違い

| 指標 | 測るもの | AI時代の課題 |
|------|---------|-------------|
| **ベロシティ** | こなしたストーリーポイント数 | AIがコード生成を高速化しても、検証の複雑さは変わらず、[虚栄の指標化](https://www.scrum.org/resources/blog/velocity-agent-efficiency-evidence-based-management-ai-era) |
| **DORA指標** | デプロイの速さと安定性 | 本番リリースまでの実際の価値提供を測定。[Evidence-Based Management](https://www.scrum.org/resources/evidence-based-management)でも推奨 |

> 詳細：[DORA指標の詳しい解説](docs/DORA_METRICS.md)

---

## DevSyncGASの特徴

### 1. GitHubのデータだけで完結

```
GitHub  ──→  DevSyncGAS (GAS)  ──→  Google スプレッドシート
  PR・Issue・Workflow情報から        →  DORA指標を自動計算
```

外部ツールやエージェント不要。GitHub APIとGoogle Apps Scriptだけで動きます。

**なぜGoogle スプレッドシートなのか？**

- 既存の認証基盤（Google Workspace）をそのまま活用
- [ISO/IEC 27001:2022](https://cloud.google.com/security/compliance/iso-27001)、[SOC 2 Type II](https://cloud.google.com/security/compliance/soc-2) 等の主要セキュリティ認証を取得済み
- 追加コストゼロで導入可能

> 詳細：[なぜスプレッドシートを選んだか](docs/MEASUREMENT_PHILOSOPHY.md#なぜgoogle-スプレッドシートなのか)

### 2. DORA指標 + AI時代の拡張指標

**コア（DORA指標）:**
- デプロイ頻度、リードタイム、変更障害率、MTTR

**拡張（AI活用の評価）:**
- サイクルタイム（Issue → Production）
- コーディング時間（Issue → PR作成）
- 手戻り率（追加コミット・Force Push）
- レビュー効率（レビュー待ち・レビュー時間）
- PRサイズ（変更行数・ファイル数）

AI活用で「速くなった」を定量評価できます。

### 3. チームの改善サイクルを回す

- 週次ダッシュボードでトレンド把握
- 複数リポジトリの横断比較
- リポジトリ別の詳細分析

データを見ながら、継続的にチームを改善できます。

---

## 始める

### 最速セットアップ（5分）

```bash
# 1. インストール
git clone https://github.com/your-org/dev-sync-gas.git
cd dev-sync-gas
bun install

# 2. GASにデプロイ
bunx clasp login
bunx clasp create --title "DevSyncGAS" --type standalone --rootDir ./dist
bun run push

# 3. GASエディタで初期設定
# setup('ghp_xxxx', 'spreadsheet-id') を実行
# addRepo('owner', 'repo') でリポジトリ追加
```

詳しい手順は **[クイックスタートガイド](docs/QUICK_START.md)** を参照してください。

### GitHub認証の選択

| 方式 | おすすめのケース |
|------|-----------------|
| [Personal Access Token](docs/QUICK_START.md#pat認証) | 個人・小規模チーム |
| [GitHub Apps](docs/GITHUB_APPS_AUTH.md) | 組織運用・セキュリティ重視 |

---

## ドキュメント

### 使い方
- **[クイックスタート](docs/QUICK_START.md)** - 5分で始める
- **[組織導入ガイド](docs/SETUP_AND_TROUBLESHOOTING.md)** - チームでの導入・トラブルシューティング

### DORA指標を理解する
- **[DORA指標の詳細](docs/DORA_METRICS.md)** - 4つの指標の定義と計測方法
- **[計測思想](docs/MEASUREMENT_PHILOSOPHY.md)** - なぜこの指標を、この方法で測るのか
- **[アーキテクチャ](docs/ARCHITECTURE.md)** - データの流れと設計原則

### 拡張指標の詳細（AI活用評価）
| 指標 | 概要 |
|------|------|
| [サイクルタイム](docs/CYCLE_TIME.md) | Issue作成 → Production マージ |
| [コーディング時間](docs/CODING_TIME.md) | Issue作成 → PR作成 |
| [手戻り率](docs/REWORK_RATE.md) | PR作成後の追加コミット・Force Push |
| [レビュー効率](docs/REVIEW_EFFICIENCY.md) | レビュー待ち・レビュー中・マージ待ち |
| [PRサイズ](docs/PR_SIZE.md) | 変更行数・ファイル数 |

### 拡張・開発
- **[新しい指標を追加する](docs/ADDING_METRICS.md)** - 独自指標の実装ガイド
- **[ADR（設計判断の記録）](docs/adr/)** - なぜそうなっているか

---

## 開発者向け

```bash
bun run build    # ビルド
bun run push     # ビルド＆GASにデプロイ
bun test         # テスト実行
bun run lint     # Lintチェック
```

詳細は [CLAUDE.md](CLAUDE.md) を参照してください。

---

## License

MIT
