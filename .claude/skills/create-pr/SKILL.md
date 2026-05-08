---
name: create-pr
description: >
  実装済みブランチのPRを作成するスキル。
  「PRを作って」「PRを作成して」「PRを出して」「レビューに出して」「プルリクを作って」
  のように、PR作成・提出・レビュー依頼を求められたときは必ずこのスキルを使うこと。
  PR説明文の生成・GitHub Projects ステータスの "In Review" 更新まで一気通貫で行う。
---

# PR 作成スキル

## Step 1: 現在のブランチと関連 Issue を確認する

```bash
git branch --show-current
git log main..HEAD --oneline
```

ブランチ名が `issue-<番号>` の形式であれば Issue 番号を自動取得する。
不明な場合はユーザーに確認する。

> 「何番の Issue に対する PR ですか？」

---

## Step 2: 変更内容を把握する

```bash
git diff main..HEAD --stat
git log main..HEAD --pretty=format:"%s"
```

コミット履歴と差分から PR タイトルと Summary を生成する。

---

## Step 3: PR を作成する

PR body の**末尾には必ず** `Closes #<issue番号>` を記載する。これによりマージ時に Issue が自動クローズされる。

```bash
gh pr create \
  --title "<PRタイトル>" \
  --body "$(cat <<'EOF'
## Summary
<変更内容の説明>

## Test plan
<動作確認の手順>

Closes #<issue番号>
EOF
)"
```

> `Closes #<番号>` の記載漏れは Issue の自動クローズが機能しなくなるため、必須とする。

---

## Step 4: GitHub Projects のステータスを "In Review" に変更する

PR 作成後、GitHub Projects のステータスを "In Review" に更新する。

```bash
# プロジェクト情報の確認（ID が不明な場合）
gh project field-list <project-number> --owner <owner>
gh project item-list <project-number> --owner <owner>

# ステータス更新
gh project item-edit \
  --id <item-id> \
  --field-id <status-field-id> \
  --project-id <project-id> \
  --single-select-option-id <in-review-option-id>
```

プロジェクトに紐づいていない場合はスキップする。

---

## 注意事項

- GitHub Projects のステータス変更に必要な ID（project-id, field-id, option-id）は `gh project field-list` と `gh project item-list` で動的に取得する
