# DevSyncGASの計測思想

**「なぜIssue作成から計測するの？」「なぜスプレッドシートなの？」**

このドキュメントでは、DevSyncGASの設計判断の理由と、どんなチームに合うか（合わないか）を説明します。

---

## 🎯 このドキュメントで答える3つの疑問

| 疑問 | 答え |
|------|------|
| **「なぜスプレッドシートなのか？」** | セキュリティ承認済み、追加コストゼロ、即共有可能 |
| **「なぜIssue作成から計測？」** | AI時代は設計→実装が速い、外部ツール不要 |
| **「合わないチームは？」** | バックログを寝かせる運用には合わない（対処法あり） |

---

## TL;DR

- **Issue作成 = 作業開始の意思表示**という前提で計測している
- DORA標準の「コミットから計測」とは別の視点を提供
- AI駆動開発では「Issue作成→コーディング開始」が短くなるため、この方式が有効
- バックログを寝かせる運用には合わない

## よくある疑問

### 「Issueを寝かせたら、数字が悪くなるのでは？」

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

## なぜGoogle スプレッドシートなのか

**「新しいツールを入れたいが、セキュリティ承認が...」**

### 理由1: 認証基盤の信頼性

**従来の専用ツール導入フロー:**

```
1. ツール選定（数週間）
    ↓
2. セキュリティレビュー依頼
    ・認証基盤は安全か？
    ・データ保管場所は？
    ・アクセス権限管理は？
    ↓
3. 情報システム部門の承認（数週間〜数ヶ月）
    ↓
4. ようやく使用開始
```

**DevSyncGASの場合:**

```
1. Google Workspace使ってる？
    ↓ Yes
2. すぐに使用開始（承認済み）
```

Google Workspaceを使用している組織では、既存の認証基盤をそのまま活用できます。新しい認証システムを評価・承認するプロセスが不要です。

### 理由2: 監査対応の容易さ

Google Workspaceは主要なセキュリティ認証を取得しています：

| 認証 | 内容 | 監査機関 |
|------|------|----------|
| [ISO/IEC 27001:2022](https://cloud.google.com/security/compliance/iso-27001) | 情報セキュリティマネジメントシステム | Ernst & Young CertifyPoint（IAF認定） |
| [SOC 2 Type II](https://cloud.google.com/security/compliance/soc-2) | セキュリティ・可用性・機密性の継続的監査 | Ernst & Young LLP、Coalfire |
| ISO/IEC 27017 | クラウドセキュリティ | 国際認証機関 |
| ISO/IEC 27018 | クラウド上の個人情報保護 | 国際認証機関 |

これらは独立した第三者機関による監査を受けており、四半期ごとに[コンプライアンスレポート](https://cloud.google.com/security/compliance/compliance-reports-manager)が更新されます。

独自ツールを導入する場合、同等のセキュリティ証明を確認・維持する必要がありますが、Google Workspaceなら組織の既存コンプライアンス体制に含まれている可能性が高いです。

### 理由3: 追加コストゼロ

**コスト比較:**

| 専用ツール | DevSyncGAS |
|----------|-----------|
| 月額 $50/ユーザー × 10人 = $500/月 | $0 |
| 年間 $6,000 | $0 |
| 3年間 $18,000 | $0 |

多くの組織がすでにGoogle Workspaceを契約しています。DevSyncGASは追加ライセンス費用なしで利用できます。

### 理由4: 即座に共有可能

**専用ツールの場合:**

```
「このダッシュボード、部長にも見せたい」
    ↓
1. アカウント作成依頼
2. ライセンス追加（承認必要）
3. 権限設定
    ↓
数日後、ようやく共有
```

**スプレッドシートの場合:**

```
「このダッシュボード、部長にも見せたい」
    ↓
共有ボタンクリック → メールアドレス入力 → 完了（5秒）
```

### 参考資料
- [Google Cloud ISO/IEC 27001:2022 認証](https://cloud.google.com/security/compliance/iso-27001)
- [Google Cloud SOC 2 コンプライアンス](https://cloud.google.com/security/compliance/soc-2)
- [Google Workspace セキュリティホワイトペーパー](https://workspace.google.com/learn-more/security/security-whitepaper/)
- [コンプライアンスレポートマネージャー](https://cloud.google.com/security/compliance/compliance-reports-manager)（SOC 2レポート四半期更新）

## なぜIssue作成から計測するのか

### 理由1: 外部ツールに依存しない

JiraやAsanaでタスク管理をしていても、GitHubのデータだけで計測できます。

| 方式 | データソース | 運用の手間 |
|------|-------------|-----------|
| Issue作成から計測 | GitHubのみ | 低（ツール連携不要） |
| In Progress遷移から計測 | Jira、GitHub Projects等 | ステータス更新の規律が必要 |
| 最初のコミットから計測 | GitHubのみ | 低（DORAはこちら） |

外部ツールとの連携設定や同期の問題を気にせず、すぐに計測を始められます。

### 理由2: AI駆動開発との相性

**従来の開発フロー:**

```
月曜: Issueを大量に作成（バックログに追加）
    ↓（数日〜数週間寝かせる）
水曜: 優先度を決めて着手
    ↓
金曜: PR作成
```

**AI駆動開発のフロー:**

```
月曜 10:00: Issue作成
月曜 10:15: Claude Codeで設計・実装
月曜 11:00: PR作成
```

| フェーズ | 従来 | AI駆動 | 変化 |
|----------|------|--------|------|
| Issue作成→設計 | 数時間〜数日 | 数分〜数時間 | **90%短縮** |
| 設計→実装開始 | 数日 | 数分 | **99%短縮** |
| 実装→PR作成 | 数日〜数週間 | 数時間〜数日 | **80%短縮** |

→ **「Issueを寝かせる」という概念自体が薄れます**

だからこそ、Issue作成時点からの計測が実態に合います。

## 公式フレームワークとの関係

DevSyncGASは複数のフレームワークの考え方を組み合わせています。

### DORAとの関係

[DORA](https://dora.dev/) の **Lead Time for Changes** は「**コミットからデプロイまで**」を測定します。

> "The amount of time it takes for a change to go from committed to version control to deployed in production."

これはDevOpsチームが直接コントロールできる範囲に焦点を当てています。

DevSyncGASのLead Time for ChangesもDORA標準に準拠しています。一方、サイクルタイムはより広い視点を提供します。

### Evidence-Based Management（EBM）との関係

[Scrum.org のEBMガイド](https://www.scrum.org/resources/evidence-based-management-guide) では、以下のように定義しています:

> **Lead Time**: アイデアが提案されてから顧客が価値を得られるまでの時間

DevSyncGASのサイクルタイムは、このEBMの「Lead Time」に近い概念です。

### カンバンとの関係

[カンバンガイド](https://www.scrum.org/resources/kanban-guide-scrum-teams) によると:

> ワークフローの「開始」と「終了」ポイントは**チーム自身が定義**する

Issue作成を「開始」とするか、In Progress遷移を「開始」とするかは、チームの選択です。

## 計測指標の全体像

| 指標 | 起点 | 終点 | フレームワーク |
|------|------|------|---------------|
| サイクルタイム | Issue作成 | Productionマージ | EBM / Kanban |
| コーディング時間 | Issue作成 | PR作成 | SPACE (Activity) |
| Lead Time for Changes | First Commit | Production Deploy | DORA |

同じ「開発速度」でも、異なる視点から計測できます。

## 合わないときの代替案

以下のケースでは、Issue作成からの計測が合わない可能性があります。

### ケース1: 大規模バックログ運用

状況: 先にIssueを大量に作成し、優先度をつけて順次着手する

代替案: ラベルフィルタを使う

```javascript
// "in-progress" ラベルが付いたIssueのみ計測
configureCycleTimeLabels(["in-progress"]);
```

### ケース2: 外部ツールでのタスク管理

状況: Jira、Asana等でバックログを管理し、GitHubはコード管理のみ

代替案: Lead Time for Changesに注目する

DORAのLead Time（コミット→デプロイ）はバックログ待機を含まないため、より安定した指標になります。

### ケース3: 計測期間外の長期Issue

状況: 数ヶ月かかる大型機能のIssueが存在する

代替案: 短い期間で計測する

```javascript
syncCycleTime(14);  // 過去14日間のみ
```

## 将来の拡張

以下の機能は、ニーズに応じて追加を検討できます:

- In Progress遷移時点からの計測オプション
- GitHub Projects連携によるステータスベースの計測
- カスタム開始点の設定

## 参考資料

- [DORA Metrics Guide](https://dora.dev/guides/dora-metrics/)
- [Evidence-Based Management Guide](https://www.scrum.org/resources/evidence-based-management-guide)
- [Kanban Guide for Scrum Teams](https://www.scrum.org/resources/kanban-guide-scrum-teams)
- Accelerate - Nicole Forsgren, Jez Humble, Gene Kim（DORA研究の基礎）

関連ドキュメント:

- [サイクルタイム](CYCLE_TIME.md) - 計測の技術詳細
- [コーディング時間](CODING_TIME.md) - Issue→PR作成の計測
- [アーキテクチャ](ARCHITECTURE.md) - データフローと設計原則
