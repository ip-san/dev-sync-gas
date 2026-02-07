# クイックスタート

**5分で、あなたのチームの開発生産性を可視化しましょう。**

```
ゴール: スプレッドシートにDORA指標が表示される
所要時間: 5分
必要なもの: GitHubアカウント、Googleアカウント
```

---

## 何ができるようになる？

このガイドを完了すると、こんなスプレッドシートが手に入ります:

```
Dashboard シート:
┌─────────────┬──────────┬────────────┬──────────┬──────┐
│ リポジトリ  │ デプロイ │ リードタイム │ 変更障害率│ MTTR │
├─────────────┼──────────┼────────────┼──────────┼──────┤
│ your/repo   │ daily    │ 18.5h      │ 5.0%     │ 2.3h │
└─────────────┴──────────┴────────────┴──────────┴──────┘
```

**これを使って:**
- 「レビュー待ちが長すぎる」を数字で証明
- 「AI導入後、どれだけ速くなった？」に答える
- チームのボトルネックを特定

---

## 前提条件

- [Bun](https://bun.sh/) がインストールされている
- Googleアカウントを持っている
- GitHubアカウントを持っている（計測したいリポジトリにアクセスできる）

## Step 1: プロジェクトを準備する（1分）

**なぜ:** DevSyncGASのコードをローカルにダウンロードして、Google Apps Scriptにデプロイできる状態にします。

```bash
git clone https://github.com/your-org/dev-sync-gas.git
cd dev-sync-gas
bun install
```

✅ **完了の目印:** `node_modules` フォルダが作成される

## Step 2: Google Apps Scriptにデプロイする（2分）

**なぜ:** GitHub APIを呼び出してスプレッドシートに書き込む処理を、Googleのサーバーで動かせるようにします。

### 2.1 Apps Script APIを有効化

[script.google.com/home/usersettings](https://script.google.com/home/usersettings) にアクセスし、「Google Apps Script API」を**オン**にします。

> **💡 ワンポイント:** この設定は一度だけでOKです。

### 2.2 Googleアカウントでログイン

```bash
bunx clasp login
```

ブラウザが開きます → Googleアカウントで認証

### 2.3 GASプロジェクトを作成

```bash
bunx clasp create --title "DevSyncGAS" --type standalone --rootDir ./dist
```

### 2.4 デプロイ

```bash
bun run push
```

✅ **完了の目印:** `Pushed 1 file.` と表示される

## Step 3: スプレッドシートを作成する（30秒）

**なぜ:** DORA指標を表示する場所を用意します。

1. [sheets.google.com](https://sheets.google.com/) で新しいスプレッドシートを作成
2. タイトルを「DevOps Metrics Dashboard」など、わかりやすい名前に変更
3. URLからスプレッドシートIDをコピー

```
https://docs.google.com/spreadsheets/d/【ここがID】/edit
                                    ↑
                                この部分をコピー
```

✅ **完了の目印:** 44文字のランダムな文字列がコピーできる

## Step 4: GitHubトークンを取得する（1分）

**なぜ:** DevSyncGASがGitHubからPR・デプロイメント情報を読み取るための認証です。

1. [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new) にアクセス
2. 以下を設定:
   - **Token name**: `DevSyncGAS`
   - **Expiration**: `90日`（推奨）
   - **Repository access**: 計測したいリポジトリを選択
   - **Permissions**（読み取り専用でOK）:
     - ✅ `Pull requests`: Read-only
     - ✅ `Actions`: Read-only
     - ✅ `Metadata`: Read-only（自動選択）
3. 「Generate token」をクリック
4. `ghp_` で始まるトークンをコピー

> **🔒 セキュリティ:** Read-onlyなので、コードを変更される心配はありません。

> **🏢 組織での運用:** GitHub Apps認証を推奨 → [GitHub Apps 認証ガイド](GITHUB_APPS_AUTH.md)

✅ **完了の目印:** `ghp_` で始まる40文字のトークンがコピーできる

## Step 5: 設定ファイルを作成（1分）

**なぜ:** GitHubトークンとスプレッドシートID、計測対象のリポジトリを設定ファイルに記載します。

1. プロジェクトルートで設定ファイルを作成:

```bash
cp src/init.example.ts src/init.ts
```

2. `src/init.ts` を開いて、実際の値に書き換えます:

```typescript
export const config: InitConfig = {
  auth: {
    type: 'token', // PAT認証の場合
    token: 'ghp_xxxx', // ← Step 4で取得したトークン
  },
  spreadsheet: {
    id: 'spreadsheet-id', // ← Step 2で取得したID
  },
  repositories: [
    { owner: 'your-org', name: 'your-repo' }, // ← 実際のリポジトリ名
    // 複数リポジトリを追加可能
  ],
};
```

3. デプロイ:

```bash
bun run push
```

4. [script.google.com](https://script.google.com/) にアクセス
5. 「DevSyncGAS」プロジェクトを開く
6. 上部メニューから `initConfig` 関数を選択
7. **実行ボタン（▶）をクリック**
8. 初回は権限承認が必要 → 「許可」をクリック

> **🔒 セキュリティTips:** 設定は PropertiesService に保存されるため、デプロイ後は `src/init.ts` から機密情報を削除してもOKです。

✅ **完了の目印:** エラーなく実行が完了する

## Step 6: 動作確認（30秒）

**なぜ:** 実際にGitHubからデータを取得して、スプレッドシートに書き込めることを確認します。

GASエディタで `syncDevOpsMetrics` 関数を実行:

```javascript
syncDevOpsMetrics();
```

**実行中（30秒〜1分）...**

✅ **成功！** スプレッドシートを開くと、以下のシートが作成されています:

| シート名 | 内容 |
|---------|------|
| 📊 **Dashboard** | 全リポジトリの指標一覧（一目で現状把握） |
| 📈 **Dashboard - Trend** | 週次トレンド（改善しているか追跡） |
| 📋 **DevOps Summary** | リポジトリ比較（どこがボトルネックか） |
| 📁 **owner/repo** | リポジトリ別の詳細データ |

**おめでとうございます！** これであなたのチームのDORA指標が可視化されました。

## 日次自動実行を設定する（オプション）

毎日自動でメトリクスを収集したい場合、トリガーを設定します:

1. GASエディタ → 左サイドバー「トリガー」（時計アイコン）
2. 「トリガーを追加」をクリック
3. 以下を設定:
   - 実行する関数: `syncDevOpsMetrics`
   - イベントのソース: `時間主導型`
   - 時間ベースのトリガー: `日付ベースのタイマー`
   - 時刻: `午前9時〜10時`

これで毎日午前9時に自動実行されます。

## 次のステップ

- [計測思想を理解する](MEASUREMENT_PHILOSOPHY.md) - なぜこの指標を、この方法で測るのか
- [セットアップガイド](SETUP.md) - チームでの導入、詳細な設定方法
- [トラブルシューティング](TROUBLESHOOTING.md) - エラー解決方法
- [GitHub Apps認証](GITHUB_APPS_AUTH.md) - 組織向けのセキュアな認証方式

## よくある質問

### 「認証が必要です」が繰り返し表示される

一部の権限のみ許可している可能性があります。[トラブルシューティング](TROUBLESHOOTING.md) を参照してください。

### スプレッドシートにデータが出力されない

`checkConfig()` を実行して設定を確認してください:

```javascript
checkConfig();
```

### 複数のリポジトリを監視したい

`src/init.ts` の `repositories` 配列に追加して、再デプロイ＆`initConfig()` を実行:

```typescript
repositories: [
  { owner: 'your-org', name: 'frontend' },
  { owner: 'your-org', name: 'backend' },
  { owner: 'your-org', name: 'api' },
],
```

> **Note:** リポジトリ管理は `src/init.ts` で行うことを推奨します。変更後は `bun run push` → `initConfig()` で反映してください。

### トークンの有効期限が切れた

新しいトークンを発行して、`src/init.ts` を更新し、再デプロイ＆`initConfig()` を実行してください:

```typescript
// src/init.ts
auth: {
  type: 'token',
  token: 'ghp_新しいトークン', // ← 新しいトークンに更新
},
```

```bash
bun run push  # 再デプロイ
```

その後、GASエディタで `initConfig()` を実行します。
