# よくある質問（FAQ）

DevSyncGASに関するよくある質問と回答をまとめたガイドです。

---

## 目次

1. [機能に関する質問](#機能に関する質問)
2. [認証に関する質問](#認証に関する質問)
3. [運用に関する質問](#運用に関する質問)
4. [関連ドキュメント](#関連ドキュメント)
5. [外部リンク](#外部リンク)

---

## 機能に関する質問

### Q: 複数のリポジトリを監視できますか？

**A:** はい、`src/init.ts` で複数のリポジトリを設定できます。

```typescript
// src/init.ts
projects: [
  {
    name: 'My Project',
    spreadsheet: { id: 'xxx' },
    repositories: [
      { owner: 'owner', name: 'repo1' },
      { owner: 'owner', name: 'repo2' },
      { owner: 'other-owner', name: 'repo3' },
    ],
  },
],
```

変更後は `bun run push` → `initConfig()` で反映してください。

---

### Q: 過去のデータを取得できますか？

**A:** はい、各関数に日数を指定できます。

```javascript
syncHistoricalMetrics(90);  // 過去90日のDORA指標
syncCycleTime(60);           // 過去60日のサイクルタイム
syncReworkRate(90);          // 過去90日の手戻り率
```

---

### Q: 日次で自動実行したいのですが？

**A:** GASエディタのトリガーメニューから設定します。

1. GASエディタ → 左サイドバー「トリガー」（時計アイコン）
2. 「トリガーを追加」→ 関数: `syncDevOpsMetrics`、イベント: 時間主導型、日付ベースのタイマー、午前9時〜10時

---

### Q: プライベートリポジトリでも使えますか？

**A:** はい、トークンに対象リポジトリへのアクセス権があれば使用できます。Fine-grained PATの場合、Repository accessで対象リポジトリを選択してください。

---

## 認証に関する質問

### Q: PATとGitHub Apps、どちらを選ぶべきですか？

**A:** 以下を目安にしてください。

| ケース | 推奨 |
|--------|------|
| 個人で試しに使ってみたい | PAT |
| 小規模チーム（2〜3人） | PAT（シンプル） or GitHub Apps（退職対策） |
| 組織での本格運用 | **GitHub Apps** |
| セキュリティ監査がある | **GitHub Apps** |
| 多数のリポジトリを監視 | **GitHub Apps**（レート制限3倍） |

組織での運用では、**PAT発行者の退職時にトークンが無効になるリスク**を考慮して、GitHub Appsを推奨します。

---

### Q: トークンの有効期限が切れたらどうなりますか？

**A:** 認証方式によって異なります。

**PAT認証の場合:**
API呼び出しが401エラーで失敗します。新しいトークンを発行して再設定してください。

```typescript
// src/init.ts を更新
auth: { type: 'token', token: 'ghp_新しいトークン' }
// 再デプロイして initConfig() を実行
```

**GitHub Apps認証の場合:**
Installation Access Tokenは1時間で失効しますが、**自動的に新しいトークンが取得される**ため、通常は対応不要です。

Private Keyには有効期限がないため、明示的に無効化（revoke）しない限り使い続けられます。
セキュリティのため、定期的なKeyローテーションを推奨します。

---

## 運用に関する質問

### Q: エラーが発生したらどうすればいいですか？

**A:** まず `checkConfig()` を実行して設定を診断してください。

```javascript
checkConfig();
```

詳細は [トラブルシューティング](TROUBLESHOOTING.md) を参照してください。

---

### Q: 設定を変更したい場合は？

**A:** `src/init.ts` を編集して、再デプロイ後に `initConfig()` を実行してください。

```bash
# 設定変更後
bun run push
```

```javascript
// GASエディタで実行
initConfig();
```

---

### Q: トリガーが動作しているか確認したい

**A:** GASエディタの「トリガー」画面で実行履歴を確認できます。

1. GASエディタ → 左サイドバー「トリガー」（時計アイコン）
2. 実行履歴を確認

---

## 関連ドキュメント

- [README](../README.md) - プロジェクト概要
- [セットアップガイド](SETUP.md) - 初期設定方法
- [トラブルシューティング](TROUBLESHOOTING.md) - エラー解決方法
- [GitHub Apps 認証ガイド](GITHUB_APPS_AUTH.md) - GitHub Apps認証の設定方法
- [サイクルタイム](CYCLE_TIME.md) - サイクルタイム計測
- [コーディング時間](CODING_TIME.md) - コーディング時間計測
- [手戻り率](REWORK_RATE.md) - 手戻り率計測
- [レビュー効率](REVIEW_EFFICIENCY.md) - レビュー効率計測
- [PRサイズ](PR_SIZE.md) - PRサイズ計測

---

## 外部リンク

### 公式ドキュメント

- [GitHub REST API - Fine-grained PAT permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [GitHub - Managing PATs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Google Apps Script - clasp](https://developers.google.com/apps-script/guides/clasp)

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2025-01 | 初版作成 |
| 2025-02 | SETUP_AND_TROUBLESHOOTING.md から分割 |
