# DORA Metrics 実装ガイド

このドキュメントでは、DevSyncGASで実装しているDORA Four Key Metricsの定義、計算方法、および制約事項について解説します。

## DORA Metricsとは

DORA（DevOps Research and Assessment）は、ソフトウェアデリバリーのパフォーマンスを測定するための4つの主要指標を定義しています。これらの指標は、Google CloudのDORAチームによる6年以上の研究に基づいており、組織のソフトウェアデリバリー能力と運用パフォーマンスを客観的に評価するために使用されます。

### 4つの主要指標

| 指標 | 説明 | 測定対象 |
|------|------|----------|
| Deployment Frequency | 本番環境へのデプロイ頻度 | スループット |
| Lead Time for Changes | コード変更から本番デプロイまでの時間 | スループット |
| Change Failure Rate | 本番環境で障害を引き起こしたデプロイの割合 | 安定性 |
| Mean Time to Recovery | 本番環境の障害から復旧するまでの時間 | 安定性 |

> **注意**: パフォーマンスレベル（Elite/High/Medium/Low）の閾値は、DORAの年次調査データに基づいて毎年更新されます。本ドキュメントの閾値は2024年時点のものです。最新の閾値は[DORA公式サイト](https://dora.dev/)を参照してください。

---

## GitHubから取得するデータ

本プロジェクトでは、GitHub APIから4種類のデータを取得してDORA Metricsを計算しています。

### 1. Pull Request（プルリクエスト）

**API**: `GET /repos/{owner}/{repo}/pulls`

**何を見ているか**: コードの変更履歴

PRはコードの変更をレビューしてもらうための仕組みです。以下の情報を取得しています:

| GitHub UI表示名 | APIフィールド | 説明 | 使用目的 |
|----------------|--------------|------|----------|
| （内部ID） | `id` | システム内部のID | 一意識別子 |
| **#番号**（例: #123） | `number` | PRの通し番号 | 表示用 |
| **タイトル** | `title` | PRのタイトル | 表示用 |
| **Open / Closed / Merged** | `state` | PRの状態 | マージ済みPRのフィルタリング |
| **opened this pull request on 日付** | `created_at` | PRを作成した日時 | Lead Timeのフォールバック計算 |
| **merged commit ... on 日付** | `merged_at` | PRがマージされた日時 | ⭐ **Lead Timeの起点** |
| **closed this on 日付** | `closed_at` | PRがクローズされた日時 | 情報用 |
| **作成者のアイコン・名前** | `user.login` | PRを作成したユーザー | 表示用 |

**GitHubでの確認方法**: リポジトリ → 「Pull requests」タブ → 各PRをクリック

```
┌─────────────────────────────────────────────────────────────┐
│ Pull requests                                               │
├─────────────────────────────────────────────────────────────┤
│  #123  Fix login bug                        ← number, title │
│  👤 yamada opened this on Jan 15            ← user, created │
│                                                             │
│  [Merged] ✓ merged commit abc123 on Jan 15  ← state, merged │
└─────────────────────────────────────────────────────────────┘
```

### 2. Workflow Run（ワークフロー実行）

**API**: `GET /repos/{owner}/{repo}/actions/runs`

**何を見ているか**: GitHub Actionsの実行履歴

GitHub Actionsで定義したCI/CDパイプラインの実行結果です:

| GitHub UI表示名 | APIフィールド | 説明 | 使用目的 |
|----------------|--------------|------|----------|
| （内部ID） | `id` | システム内部のID | 一意識別子 |
| **ワークフロー名**（左側に表示） | `name` | .github/workflows/で定義した名前 | ⭐ **デプロイ判定**（「deploy」を含むか） |
| **In progress / Queued** | `status` | 実行中の状態 | 進行中かどうかの判定 |
| **✓ / ✗ アイコン + Success/Failure** | `conclusion` | 完了後の結果 | ⭐ **成功/失敗の判定** |
| **日時**（右側に表示） | `created_at` | ワークフロー開始日時 | ⭐ **時系列分析、MTTR計算** |
| （表示なし） | `updated_at` | 最終更新日時 | 情報用 |

**GitHubでの確認方法**: リポジトリ → 「Actions」タブ

```
┌─────────────────────────────────────────────────────────────┐
│ Actions                                                     │
├─────────────────────────────────────────────────────────────┤
│ All workflows                                               │
│                                                             │
│  ✓ Deploy to Production           Jan 15, 2024  ← name     │
│    Fix login bug #123             3m 24s                    │
│    main                           ← conclusion = success    │
│                                                             │
│  ✗ Deploy to Production           Jan 14, 2024             │
│    Add new feature #122           1m 12s                    │
│    main                           ← conclusion = failure    │
└─────────────────────────────────────────────────────────────┘
```

**よくあるワークフロー名の例**:
- `Deploy to Production` ✅ デプロイとして認識
- `deploy` ✅ デプロイとして認識
- `CD - Deploy` ✅ デプロイとして認識
- `Build and Test` ❌ デプロイとして認識されない
- `CI` ❌ デプロイとして認識されない

### 3. Deployment（デプロイメント）

**API**: `GET /repos/{owner}/{repo}/deployments` + `GET /repos/{owner}/{repo}/deployments/{id}/statuses`

**何を見ているか**: GitHub Deploymentsの記録

GitHub Deploymentsは、特定の環境（production, staging等）へのデプロイを追跡する機能です:

| GitHub UI表示名 | APIフィールド | 説明 | 使用目的 |
|----------------|--------------|------|----------|
| （内部ID） | `id` | システム内部のID | ステータス取得に使用 |
| **コミットハッシュ**（7桁の英数字） | `sha` | デプロイしたコミットのSHA | （将来的にPRとの紐付けに使用予定） |
| **環境名**（production等） | `environment` | デプロイ先の環境名 | ⭐ **本番環境のフィルタリング** |
| **Deployed 日時** | `created_at` | デプロイが作成された日時 | ⭐ **Lead Time, MTTR計算** |
| （表示なし） | `updated_at` | 最終更新日時 | 情報用 |
| **Active / Inactive / Failure** | `status` | デプロイのステータス | ⭐ **成功/失敗の判定** |

> **注意**: `status`は別途 Deployment Statuses API から取得します。これにより追加のAPIコールが発生します。

**GitHubでの確認方法**: リポジトリ右サイドバー → 「Environments」セクション → 環境名をクリック

```
┌─────────────────────────────────────────────────────────────┐
│ リポジトリのトップページ（右サイドバー）                       │
├─────────────────────────────────────────────────────────────┤
│ Environments                                                │
│   🟢 production        ← environment = "production"         │
│   🟡 staging                                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ production をクリックすると表示される画面                     │
├─────────────────────────────────────────────────────────────┤
│ Deployment history                                          │
│                                                             │
│  ✓ Active   abc1234   Deployed on Jan 15   ← status, sha   │
│             Fix login bug #123                              │
│                                                             │
│  ✗ Inactive def5678   Deployed on Jan 14                   │
│             Add feature #122                                │
└─────────────────────────────────────────────────────────────┘
```

**statusの値と各指標への影響**:

| 値 | 意味 | Deployment Frequency | Lead Time | CFR | MTTR |
|----|------|---------------------|-----------|-----|------|
| `success` | 成功 | ✅ カウント | ✅ 使用 | 分母に含む | 復旧として検出 |
| `failure` | 失敗 | - | - | 分母・分子に含む | 障害として検出 |
| `error` | エラー | - | - | 分母・分子に含む | 障害として検出 |
| `inactive` | 非アクティブ | - | - | 分母に含む | - |
| `in_progress` | 進行中 | - | - | 分母に含む | - |
| `queued` | 待機中 | - | - | 分母に含む | - |
| `pending` | 保留中 | - | - | 分母に含む | - |
| `null` | 取得失敗 | フォールバック | フォールバック | フォールバック | フォールバック |

> **注意**: `in_progress`や`queued`などの進行中ステータスもCFRの分母に含まれます。
> これらが多いとCFRが実際より低く見える可能性があります。

### 4. Issues（インシデント）

**API**: `GET /repos/{owner}/{repo}/issues?labels={labels}&state=all`

**何を見ているか**: 本番環境で発生した障害の記録

GitHub Issuesを使用して本番インシデントを追跡することで、真のDORA定義に近いMTTRを計測できます:

| GitHub UI表示名 | APIフィールド | 説明 | 使用目的 |
|----------------|--------------|------|----------|
| （内部ID） | `id` | システム内部のID | 一意識別子 |
| **#番号**（例: #456） | `number` | Issueの通し番号 | 表示用 |
| **タイトル** | `title` | Issueのタイトル | 表示用 |
| **Open / Closed** | `state` | Issueの状態 | ⭐ **未解決インシデントのカウント** |
| **opened this issue on 日付** | `created_at` | Issueが作成された日時 | ⭐ **障害検知時刻（MTTR開始点）** |
| **closed this on 日付** | `closed_at` | Issueがクローズされた日時 | ⭐ **復旧確認時刻（MTTR終了点）** |
| **ラベル**（色付きタグ） | `labels` | Issueに付けられたラベル | ⭐ **インシデント判定（フィルタ条件）** |

> **注意**: PRはIssues APIからも返される場合がありますが、`pull_request`フィールドの有無でフィルタしています。

**GitHubでの確認方法**: リポジトリ → 「Issues」タブ → ラベルでフィルタリング

```
┌─────────────────────────────────────────────────────────────┐
│ Issues                                                      │
├─────────────────────────────────────────────────────────────┤
│ Labels: incident ▼  （ラベルでフィルタリング）              │
│                                                             │
│  🔴 #456  本番環境でログイン機能が停止     ← number, title  │
│     [incident] [P0]                        ← labels         │
│     👤 suzuki opened on Jan 15             ← created_at     │
│                                                             │
│  ✓ Closed                                                  │
│  🟢 #455  決済処理でタイムアウト発生                        │
│     [incident]                                              │
│     👤 tanaka opened on Jan 14, closed on Jan 14           │
│                          └→ created_at      └→ closed_at   │
│                             (MTTR開始点)       (MTTR終了点)  │
└─────────────────────────────────────────────────────────────┘
```

**インシデントとして認識されるIssue**:
- デフォルトでは`incident`ラベルが付いたIssue
- ラベルは設定でカスタマイズ可能（例: `production-bug`, `P0`, `outage`）

**設定方法**:
```javascript
// GASエディタで実行
setIncidentConfig({ labels: ["incident", "production-bug", "P0"] });
```

### データ取得の流れ

#### GitHubから取得する情報

| Pull Requests | Workflow Runs | Deployments | Issues |
|:--------------|:--------------|:------------|:-------|
| #番号 | ワークフロー名 ★ | コミットハッシュ | #番号 |
| タイトル | 実行状態 | 環境名 ★ | タイトル |
| Open/Closed | 結果(✓/✗) ★ | デプロイ日時 ★ | Open/Closed ★ |
| 作成日時 ★ | 開始日時 ★ | ステータス ★ | 作成日時 ★ |
| マージ日時 ★ | | | クローズ日時 ★ |
| 作成者 | | | ラベル ★ |

> ★ = メトリクス計算に直接使用される情報

#### DORA Metrics の計算方法

| 指標 | 計算式 | フォールバック |
|:-----|:-------|:--------------|
| **Deployment Frequency**<br>（デプロイ頻度） | Deploymentsの成功数をカウント | Workflow名に"deploy"を含む成功数 |
| **Lead Time for Changes**<br>（変更リードタイム） | PRマージ日時 → デプロイ日時 の差分 | PR作成日時 → マージ日時 |
| **Change Failure Rate**<br>（変更失敗率） | 失敗デプロイ数 ÷ 全デプロイ数 | Workflow失敗数 ÷ 全Workflow数 |
| **MTTR - CI/CD方式**<br>（平均復旧時間） | デプロイ失敗 → 次の成功デプロイ までの時間 | Workflow失敗 → 成功 |
| **MTTR - インシデント方式** ⭐推奨<br>（平均復旧時間） | Issue作成日時 → クローズ日時 の差分 | （なし） |

### フォールバックが発生する条件

各指標がワークフローにフォールバックするタイミング:

| 指標 | フォールバック条件 |
|------|-------------------|
| Deployment Frequency | `status=success`のデプロイが0件の場合 |
| Lead Time | `status=success`のデプロイが0件の場合（PR作成→マージ時間を使用） |
| Change Failure Rate | `status≠null`のデプロイが0件の場合 |
| MTTR (CI/CD方式) | `status≠null`のデプロイが0件の場合 |
| MTTR (インシデント方式) | クローズ済みインシデントが0件の場合は`null` |

> **ポイント**: Deploymentsが存在しても、すべてのステータスが`null`の場合はフォールバックします。
> これは`skipStatusFetch=true`を使用した場合や、ステータス取得に失敗した場合に発生します。

> **インシデント方式のMTTR**: インシデントトラッキングが有効な場合、`incidentMetrics.mttrHours`として別途出力されます。
> CI/CD方式の`meanTimeToRecoveryHours`とは独立して計算されるため、両方の値を比較できます。

### あなたのリポジトリでDeploymentsが使われているか確認する方法

1. GitHubでリポジトリを開く
2. 右サイドバーの「Environments」セクションを確認
3. 「production」などの環境が表示されていれば、Deployments APIが使用されています

**Deploymentsがない場合**:
- GitHub Actionsのワークフロー実行データにフォールバックします
- ワークフロー名に「deploy」が含まれているものがデプロイとして認識されます

**Deploymentsを有効にするには**:
GitHub Actionsのワークフローで `environment` を指定します:

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # ← これを追加
    steps:
      - name: Deploy
        run: ./deploy.sh
```

---

## 各指標の詳細

---

### 1. Deployment Frequency（デプロイ頻度）

#### 公式定義

> 組織が本番環境またはエンドユーザーへのリリースを成功させる頻度

#### パフォーマンス分類（DORA基準）

| レベル | 頻度 |
|--------|------|
| Elite | オンデマンド（1日複数回） |
| High | 1日1回〜週1回 |
| Medium | 週1回〜月1回 |
| Low | 月1回〜6ヶ月に1回 |

#### 本プロジェクトでの実装

```
計算式: 成功デプロイ数 / 期間（日数）
```

**データソース（優先順位）:**

1. **GitHub Deployments API** - `production`環境への成功デプロイをカウント
2. **フォールバック: GitHub Actions** - ワークフロー名に「deploy」を含む成功した実行をカウント

**分類基準:**
- `daily`: 1日1回以上
- `weekly`: 週1回以上
- `monthly`: 月1回以上
- `yearly`: 月1回未満

#### 制約事項

- GitHub Deployments APIを使用していないプロジェクトでは、ワークフロー名ベースのヒューリスティックに依存
- 環境名は設定で変更可能（デフォルト: `production`）

---

### 2. Lead Time for Changes（変更のリードタイム）

#### 公式定義

> コードがコミットされてから本番環境で正常に稼働するまでの時間

DORAの定義では、最初のコミットから本番デプロイまでの時間を測定しますが、実際の計測ではPRのオープンからデプロイまでの時間が一般的に使用されます。

#### パフォーマンス分類（DORA基準）

| レベル | リードタイム |
|--------|-------------|
| Elite | 1時間未満 |
| High | 1日〜1週間 |
| Medium | 1週間〜1ヶ月 |
| Low | 1ヶ月以上 |

> **実装上の注意**: DORA公式定義では1時間〜1日の間が未定義です。
> 本実装では連続的に分類するため、この範囲をHighとして扱っています。
> 詳細は `src/config/doraThresholds.ts` を参照してください。

#### 本プロジェクトでの実装

**計算方法（2段階）:**

1. **マージ→デプロイ時間**（推奨）
   - PRがマージされた時刻を取得
   - マージ後24時間以内の最初の成功デプロイを探す
   - 差分を計算

2. **フォールバック: PR作成→マージ時間**
   - デプロイメントデータがない場合に使用
   - PRの作成時刻からマージ時刻までの時間

**出力データ:**
```typescript
{
  leadTimeForChangesHours: 2.5,        // 平均リードタイム（時間）
  leadTimeMeasurement: {
    mergeToDeployCount: 8,             // マージ→デプロイで計測されたPR数
    createToMergeCount: 2,             // フォールバックで計測されたPR数
  }
}
```

#### 制約事項

- **時間ベースマッチング**: 理想的にはコミットSHAでPRとデプロイを関連付けるべきですが、GitHub Deployments APIの制約により、時間ベースで近似しています
- **24時間閾値**: マージ後24時間以内のデプロイのみを関連付け。それ以上経過した場合はフォールバックを使用
- フォールバック計測はコードレビュー時間を含むため、純粋なリードタイムより長くなる傾向

---

### 3. Change Failure Rate（変更失敗率）

#### 公式定義

> 本番環境へのデプロイのうち、障害（サービス低下、サービス停止、ロールバックが必要な状態）を引き起こした割合

#### パフォーマンス分類（DORA基準）

| レベル | 失敗率 |
|--------|--------|
| Elite | 0-15% |
| High | 0-15% |
| Medium | 16-30% |
| Low | 30%超 |

> **注意**: EliteとHighは同じ閾値（0-15%）です。CFRだけでなく他の指標も含めた総合評価でレベルが決まります。

#### 本プロジェクトでの実装

```
計算式: 失敗デプロイ数 / 全デプロイ数 × 100
```

**データソース（優先順位）:**

1. **GitHub Deployments API** - ステータスが`failure`または`error`のデプロイをカウント
2. **フォールバック: GitHub Actions** - `conclusion`が`failure`のデプロイワークフローをカウント

#### 重要な注意事項

> **⚠️ 真のDORA定義との差異**
>
> DORAの公式定義では、**本番環境でインシデントを引き起こしたデプロイ**を測定します。これには以下が含まれます:
> - ユーザーに影響を与えた障害
> - ロールバックが必要になったデプロイ
> - ホットフィックスが必要になった変更
>
> 本実装では、**CI/CDパイプラインの失敗率**を測定しており、これは近似値です。真のChange Failure Rateを測定するには、インシデント管理システム（PagerDuty、Opsgenie等）との連携が必要です。

#### 制約事項

- デプロイ自体は成功したが、その後本番で問題が発生したケースは検出できない
- `skipStatusFetch=true`の場合、全デプロイのステータスが`null`となりワークフローにフォールバック

---

### 4. Mean Time to Recovery / MTTR（平均復旧時間）

#### 公式定義

> 本番環境でサービス障害が発生してから復旧するまでの時間

#### パフォーマンス分類（DORA基準）

| レベル | 復旧時間 |
|--------|----------|
| Elite | 1時間未満 |
| High | 1日未満 |
| Medium | 1週間未満 |
| Low | 1週間以上 |

#### 本プロジェクトでの実装

本プロジェクトでは、MTTRを2つの方式で計測できます:

##### 方式1: CI/CD方式（デフォルト）

デプロイの失敗から次の成功デプロイまでの時間を測定します。

```
計算式: Σ(復旧デプロイ時刻 - 障害デプロイ時刻) / 障害回数
```

**計算ロジック:**

1. デプロイを時系列順にソート
2. 失敗デプロイ（`status = failure` または `error`）を検出
3. その後の最初の成功デプロイまでの時間を計算
4. 全復旧時間の平均を算出

**データソース（優先順位）:**

1. **GitHub Deployments API** - `failure`/`error`から`success`までの時間
2. **フォールバック: GitHub Actions** - デプロイワークフローの失敗から成功までの時間

**出力フィールド**: `meanTimeToRecoveryHours`

##### 方式2: インシデント方式（推奨）

GitHub Issuesをインシデントトラッキングとして使用し、真のDORA定義に近いMTTRを測定します。

```
計算式: Σ(Issue close時刻 - Issue作成時刻) / クローズ済みインシデント数
```

**計算ロジック:**

1. 指定ラベル（デフォルト: `incident`）が付いたIssueを取得
2. クローズ済みのIssueを抽出
3. 各Issueの作成時刻からクローズ時刻までの時間を計算
4. 全復旧時間の平均を算出

**出力フィールド**: `incidentMetrics.mttrHours`

**追加の出力情報**:
```typescript
incidentMetrics: {
  incidentCount: 5,      // 期間内のインシデント総数
  openIncidents: 1,      // 未解決のインシデント数
  mttrHours: 2.3         // 平均復旧時間（時間）
}
```

#### 2つの方式の比較

| 項目 | CI/CD方式 | インシデント方式 |
|------|-----------|-----------------|
| 測定対象 | デプロイ失敗 | 本番インシデント |
| 検出方法 | 自動（デプロイステータス） | 手動（Issue作成） |
| DORA定義との一致度 | 近似値 | より正確 |
| 設定の手間 | なし | ラベル設定が必要 |
| 運用フロー | 既存のまま | インシデント時にIssue作成が必要 |

**推奨**: 両方の値を出力し、チームの運用に合わせて使い分けることを推奨します。

#### 重要な注意事項

> **⚠️ CI/CD方式の制約**
>
> CI/CD方式は**デプロイ失敗から次の成功デプロイまでの時間**を測定します。これは:
> - デプロイは成功したが、後から本番で問題が発生したケースを検出できない
> - 本番環境の実際のダウンタイムではなく、デプロイ間の時間を測定
>
> 真のMTTRを測定するには、インシデント方式の使用を推奨します。

#### 制約事項

**CI/CD方式:**
- 未復旧の障害（期間内に成功デプロイがない）はカウントされない
- 障害がない場合は`null`を返す
- 本番環境の実際のダウンタイムではなく、デプロイ間の時間を測定

**インシデント方式:**
- 運用チームがインシデント発生時にIssueを作成する必要がある
- Issue作成のタイミングが障害検知時刻として使用される
- Issueをクローズし忘れると未解決としてカウントされる

---

## 実装上の考慮事項

### 閾値の設定ファイル

パフォーマンスレベル（Elite/High/Medium/Low）を判定する閾値は、設定ファイルに切り出されています:

```
src/config/doraThresholds.ts
```

**閾値を変更するには**:

DORAが年次レポートで閾値を更新した場合、このファイルの定数を修正してください:

```typescript
// 例: Deployment Frequency の閾値
export const DEPLOYMENT_FREQUENCY_THRESHOLDS = {
  elite: 1,      // 1日1回以上
  high: 1 / 7,   // 週1回以上
  medium: 1 / 30, // 月1回以上
} as const;
```

**パフォーマンスレベル判定関数**:

各指標のパフォーマンスレベルを取得する関数も提供しています:

```typescript
import {
  getDeploymentFrequencyLevel,
  getLeadTimeLevel,
  getChangeFailureRateLevel,
  getMTTRLevel,
} from "./config/doraThresholds";

// 使用例
const level = getLeadTimeLevel(2.5); // "high"
```

### データソースの優先順位

本プロジェクトでは、以下の優先順位でデータを取得します:

```
GitHub Deployments API（推奨）
    ↓ フォールバック
GitHub Actions Workflow Runs
```

GitHub Deployments APIを使用することで、より正確なデプロイ情報を取得できます。ただし、Deployments APIを使用していないプロジェクトでは、ワークフロー実行データにフォールバックします。

### `skipStatusFetch`オプション

デプロイメントのステータス取得はN+1クエリとなるため、パフォーマンスに影響します。

```typescript
getDeployments(repo, token, { skipStatusFetch: true })
```

`skipStatusFetch=true`に設定すると:
- API呼び出しが大幅に削減される
- すべてのデプロイの`status`が`null`になる
- Deployment Frequency, CFR, MTTRがワークフローベースのフォールバックを使用

メトリクス計算が目的の場合は`skipStatusFetch=false`（デフォルト）を推奨します。

### 環境フィルタリング

デプロイメントは指定された環境（デフォルト: `production`）でフィルタリングされます:

```typescript
getAllRepositoriesData(repos, token, {
  deploymentEnvironment: "production",  // または "prod", "live" など
  deploymentEnvironmentMatchMode: "exact"  // "exact" または "partial"
})
```

**マッチングモード:**
- `exact`（デフォルト）: 完全一致。GitHub APIのフィルタを使用するため高速
- `partial`: 部分一致。`production_v2`や`production-east`などにもマッチ

```typescript
// 例: "production"で始まるすべての環境を対象にする
getAllRepositoriesData(repos, token, {
  deploymentEnvironment: "production",
  deploymentEnvironmentMatchMode: "partial"  // production_v2, production-east等にもマッチ
})
```

### インシデントトラッキング設定

GitHub Issuesをインシデントトラッキングとして使用する場合の設定方法です。

#### ラベル設定

インシデントとして認識するIssueのラベルを設定します:

```javascript
// GASエディタで実行

// 現在の設定を確認
const config = getIncidentConfig();
console.log(config);  // { labels: ["incident"], enabled: true }

// ラベルを追加
addIncidentLabel("production-bug");
addIncidentLabel("P0");

// ラベルを削除
removeIncidentLabel("incident");

// ラベルを一括設定
setIncidentConfig({
  labels: ["incident", "production-bug", "P0", "outage"]
});
```

#### インシデントトラッキングの有効/無効

```javascript
// 無効化（Issueを取得しない）
disableIncidentTracking();

// 有効化
enableIncidentTracking();
```

#### 推奨ラベル

チームの運用に合わせて、以下のようなラベルを使用することを推奨します:

| ラベル | 用途 |
|--------|------|
| `incident` | 一般的なインシデント |
| `production-bug` | 本番環境のバグ |
| `P0`, `P1` | 優先度別のインシデント |
| `outage` | サービス停止 |
| `hotfix` | 緊急修正 |

---

## より正確なDORA Metrics計測に向けて

本実装はGitHub APIを使用した実装です。インシデントトラッキング（GitHub Issues）を使用することで、真のDORA定義に近いMTTRを計測できます。

### 現在の実装状況

| 指標 | 実装方式 | DORA定義との一致度 |
|------|----------|-------------------|
| Deployment Frequency | GitHub Deployments/Actions | ✅ 正確 |
| Lead Time for Changes | PR + Deployments | ⚠️ 近似（時間ベースマッチング） |
| Change Failure Rate | デプロイ失敗率 | ⚠️ 近似（CI/CD失敗を測定） |
| MTTR (CI/CD方式) | デプロイ復旧時間 | ⚠️ 近似 |
| MTTR (インシデント方式) | GitHub Issues | ✅ DORA定義に近い |

### さらなる改善案

#### Change Failure Rate の改善

- **外部インシデント管理システム連携**: PagerDuty, Opsgenie, ServiceNow等
- **アラート管理**: Prometheus Alertmanager, Datadog等

#### MTTR の改善（インシデント方式以外）

- **モニタリングツール連携**: Datadog, New Relic, Grafana等
- **ステータスページ連携**: Statuspage, Atlassian等
- **オンコール管理**: PagerDuty, Opsgenie等

### GitHub Issuesを使ったインシデントトラッキングの運用

インシデント方式のMTTRを効果的に活用するためのワークフロー例:

```
1. 障害検知
   └→ アラート発報 or ユーザー報告

2. インシデントIssue作成
   └→ ラベル: "incident"
   └→ タイトル: "[障害] ログイン機能が停止"
   └→ 本文: 影響範囲、暫定対応など

3. 復旧作業
   └→ 原因調査、修正、デプロイ

4. 復旧確認・Issueクローズ
   └→ 復旧確認のコメントを追加
   └→ Issueをクローズ

→ MTTR = Issue作成からクローズまでの時間
```

---

## 出典・参考資料

### 公式ドキュメント

1. **DORA | DevOps Capabilities**
   - https://dora.dev/capabilities/
   - DORAの公式サイト。各メトリクスの定義と改善方法を解説

2. **DORA Metrics: The 4 Keys of DevOps - Google Cloud Blog**
   - https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance
   - Google Cloudによる詳細な解説

3. **Four Keys Project - GitHub**
   - https://github.com/dora-team/fourkeys
   - DORAチームによるリファレンス実装

### 書籍

4. **Accelerate: The Science of Lean Software and DevOps**
   - Nicole Forsgren, Jez Humble, Gene Kim 著
   - DORA研究の基礎となった書籍

### その他の参考資料

5. **GitLab - DORA Metrics**
   - https://docs.gitlab.com/ee/user/analytics/dora_metrics.html
   - GitLabによるDORA Metricsの実装例

6. **GitHub Actions - Workflow runs API**
   - https://docs.github.com/en/rest/actions/workflow-runs
   - 本プロジェクトで使用しているAPI

7. **GitHub Deployments API**
   - https://docs.github.com/en/rest/deployments/deployments
   - 本プロジェクトで使用しているAPI

8. **GitHub Issues API**
   - https://docs.github.com/en/rest/issues/issues
   - インシデントトラッキングに使用しているAPI

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-01 | GitHub Issuesによるインシデントトラッキング機能を追加。環境名の部分一致対応を追加 |
| 2024-01 | 初版作成。DORA公式定義に基づく実装の解説を追加 |
