# 💡 DevSyncGASの計測思想

「Issue作成時点からサイクルタイムを計測する」という設計判断に、違和感を覚える人もいるかもしれません。

このドキュメントでは、その設計判断の背景と、どんなチームに合うか（合わないか）を説明します。

---

## 📌 TL;DR

- **Issue作成 = 作業開始の意思表示**という前提で計測している
- DORA標準の「コミットから計測」とは別の視点を提供
- AI駆動開発では「Issue作成→コーディング開始」が短くなるため、この方式が有効
- バックログを寝かせる運用には合わない

---

## 🤔 よくある疑問

### ❓ 「Issueを寝かせたら、数字が悪くなるのでは？」

その通りです。そして、それが**意図した動作**です。

DevSyncGASは「やると決めたものだけをIssueにする」チームを想定しています。

```
議論・検討（Slack等）
    ↓ 「やる」と決定
Issue作成
    ↓ すぐに着手
PR作成
    ↓
マージ
```

Issueを「いつかやるかもしれないリスト」として使っているなら、この計測方式は合いません。[代替案](#合わないときの代替案)を参照してください。

---

## 📊 なぜGoogle スプレッドシートなのか

### 🔐 理由1: 認証基盤の信頼性

独自ツールを導入する場合、以下の懸念が生じます：

- **認証基盤の安全性**: そのツールのログイン機構は安全か？
- **データ保管**: 企業データはどこに、どう保管されるか？
- **権限管理**: 誰がデータにアクセスできるか？

Google Workspaceを使用している組織では、**既存の認証基盤をそのまま活用**できます。新しい認証システムを評価・承認するプロセスが不要です。

### ✅ 理由2: 監査対応の容易さ

Google Workspaceは主要なセキュリティ認証を取得しています：

| 認証 | 内容 | 監査機関 |
|------|------|----------|
| **[ISO/IEC 27001:2022](https://cloud.google.com/security/compliance/iso-27001)** | 情報セキュリティマネジメントシステム | Ernst & Young CertifyPoint（IAF認定） |
| **[SOC 2 Type II](https://cloud.google.com/security/compliance/soc-2)** | セキュリティ・可用性・機密性の継続的監査 | Ernst & Young LLP、Coalfire |
| **ISO/IEC 27017** | クラウドセキュリティ | 国際認証機関 |
| **ISO/IEC 27018** | クラウド上の個人情報保護 | 国際認証機関 |

これらは独立した第三者機関による監査を受けており、四半期ごとに[コンプライアンスレポート](https://cloud.google.com/security/compliance/compliance-reports-manager)が更新されます。

独自ツールを導入する場合、同等のセキュリティ証明を確認・維持する必要がありますが、Google Workspaceなら組織の既存コンプライアンス体制に含まれている可能性が高いです。

### 💰 理由3: 追加コストゼロ

多くの組織がすでにGoogle Workspaceを契約しています。DevSyncGASは追加ライセンス費用なしで利用できます。

### 参考資料

公式ドキュメント：
- [Google Cloud ISO/IEC 27001:2022 認証](https://cloud.google.com/security/compliance/iso-27001)
- [Google Cloud SOC 2 コンプライアンス](https://cloud.google.com/security/compliance/soc-2)
- [Google Workspace セキュリティホワイトペーパー](https://workspace.google.com/learn-more/security/security-whitepaper/)
- [コンプライアンスレポートマネージャー](https://cloud.google.com/security/compliance/compliance-reports-manager)（SOC 2レポート四半期更新）

---

## 🎯 なぜIssue作成から計測するのか

### 🔧 理由1: 外部ツールに依存しない

JiraやAsanaでタスク管理をしていても、GitHubのデータだけで計測できます。

| 方式 | データソース | 運用の手間 |
|------|-------------|-----------|
| Issue作成から計測 | GitHubのみ | 低（ツール連携不要） |
| In Progress遷移から計測 | Jira、GitHub Projects等 | ステータス更新の規律が必要 |
| 最初のコミットから計測 | GitHubのみ | 低（DORAはこちら） |

外部ツールとの連携設定や同期の問題を気にせず、すぐに計測を始められます。

### 🤖 理由2: AI駆動開発との相性

Claude CodeやCopilotを使うと、以下が起きます:

| フェーズ | 従来 | AI駆動 |
|----------|------|--------|
| Issue作成→設計 | 数時間〜数日 | 数分〜数時間 |
| 設計→実装開始 | 数日 | 数分 |
| 実装→PR作成 | 数日〜数週間 | 数時間〜数日 |

「Issueを寝かせる」という概念自体が薄れます。

---

## 📚 公式フレームワークとの関係

DevSyncGASは複数のフレームワークの考え方を組み合わせています。

### 📊 DORAとの関係

[DORA](https://dora.dev/) の **Lead Time for Changes** は「**コミットからデプロイまで**」を測定します。

> "The amount of time it takes for a change to go from committed to version control to deployed in production."

これはDevOpsチームが直接コントロールできる範囲に焦点を当てています。

DevSyncGASの **Lead Time for Changes** もDORA標準に準拠しています。一方、**サイクルタイム**はより広い視点を提供します。

### 📈 Evidence-Based Management（EBM）との関係

[Scrum.org のEBMガイド](https://www.scrum.org/resources/evidence-based-management-guide) では、以下のように定義しています:

> **Lead Time**: アイデアが提案されてから顧客が価値を得られるまでの時間

DevSyncGASの**サイクルタイム**は、このEBMの「Lead Time」に近い概念です。

### 📋 カンバンとの関係

[カンバンガイド](https://www.scrum.org/resources/kanban-guide-scrum-teams) によると:

> ワークフローの「開始」と「終了」ポイントは**チーム自身が定義**する

Issue作成を「開始」とするか、In Progress遷移を「開始」とするかは、チームの選択です。

---

## 🎯 計測指標の全体像

| 指標 | 起点 | 終点 | フレームワーク |
|------|------|------|---------------|
| **サイクルタイム** | Issue作成 | Productionマージ | EBM / Kanban |
| **コーディング時間** | Issue作成 | PR作成 | SPACE (Activity) |
| **Lead Time for Changes** | First Commit | Production Deploy | DORA |

同じ「開発速度」でも、異なる視点から計測できます。

---

## 🔀 合わないときの代替案

以下のケースでは、Issue作成からの計測が合わない可能性があります。

### ケース1: 大規模バックログ運用

**状況**: 先にIssueを大量に作成し、優先度をつけて順次着手する

**代替案**: ラベルフィルタを使う

```javascript
// "in-progress" ラベルが付いたIssueのみ計測
configureCycleTimeLabels(["in-progress"]);
```

### ケース2: 外部ツールでのタスク管理

**状況**: Jira、Asana等でバックログを管理し、GitHubはコード管理のみ

**代替案**: Lead Time for Changesに注目する

DORAのLead Time（コミット→デプロイ）はバックログ待機を含まないため、より安定した指標になります。

### ケース3: 計測期間外の長期Issue

**状況**: 数ヶ月かかる大型機能のIssueが存在する

**代替案**: 短い期間で計測する

```javascript
syncCycleTime(14);  // 過去14日間のみ
```

---

## 将来の拡張

以下の機能は、ニーズに応じて追加を検討できます:

- In Progress遷移時点からの計測オプション
- GitHub Projects連携によるステータスベースの計測
- カスタム開始点の設定

---

## 参考資料

### 公式ドキュメント

| 資料 | URL |
|------|-----|
| DORA Metrics Guide | https://dora.dev/guides/dora-metrics/ |
| Evidence-Based Management Guide | https://www.scrum.org/resources/evidence-based-management-guide |
| Kanban Guide for Scrum Teams | https://www.scrum.org/resources/kanban-guide-scrum-teams |

### 書籍

- **Accelerate** - Nicole Forsgren, Jez Humble, Gene Kim（DORA研究の基礎）

### 関連ドキュメント

- [サイクルタイム](CYCLE_TIME.md) - 計測の技術詳細
- [コーディング時間](CODING_TIME.md) - Issue→PR作成の計測
- [アーキテクチャ](ARCHITECTURE.md) - データフローと設計原則
