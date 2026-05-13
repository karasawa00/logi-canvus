---
name: implement-issue
description: >
  GitHubのIssueをgit worktreeで実装するスキル。
  「issue #42 を実装して」「issue-XXの作業を始めて」「worktreeを作ってissueを進めて」
  「#〇〇番のissueやって」のように、issueの実装・着手・開始を求められたときは必ずこのスキルを使うこと。
  main を最新化 → worktree 作成 → husky セットアップ → issue内容に合ったエージェントで実装、まで一気通貫で行う。
---

# Issue 実装スキル

## Step 1: Issue 番号を確認する

ユーザーのメッセージに issue 番号が含まれていない場合は、実装を始める前に必ず聞く。

> 「何番のIssueを実装しますか？」

---

## Step 2: main を最新化する

```bash
git switch main && git pull
```

---

## Step 3: Issue 内容を取得し、ステータスを In Progress に変更する

```bash
gh issue view <番号> --json title,body,labels,projectItems
```

取得した内容（タイトル・本文・ラベル）を読み、次のステップのエージェント選択と実装方針の判断に使う。

GitHub Projects のステータスが "Todo" だった場合は "In Progress" に変更する。

**アイテムIDの取得は `gh issue view` の `projectItems` から行う**（`gh project item-list` は件数上限の問題があるため使わない）：

```bash
# issue 側からプロジェクトアイテムIDを取得
gh issue view <番号> --json projectItems
# → projectItems[].id にアイテムIDが含まれる
```

`projectItems` が空の場合は issue がプロジェクト未登録のため、先に追加してから再取得する：

```bash
gh project item-add <project-number> --owner <owner> --url <issue-url>
gh issue view <番号> --json projectItems  # 再取得
```

取得したアイテムIDでステータスを更新する：

```bash
gh project item-edit --id <item-id> --field-id <status-field-id> --project-id <project-id> --single-select-option-id <in-progress-option-id>
```

> ステータスフィールドIDや選択肢IDが不明な場合は `gh project field-list <project-number> --owner <owner>` で確認する。プロジェクトに紐づいていない場合やステータスが Todo 以外の場合はスキップする。

---

## Step 4: Worktree を作成する

```bash
git worktree add worktrees/issue-<番号> -b issue-<番号>
```

作成後、その worktree 内で husky をセットアップし、`.env.local` を生成する。

```bash
cd worktrees/issue-<番号> && npm run prepare
```

`.env.local` はルートのファイルをコピーして作成する。

```bash
# .env.local が存在すればコピー、なければ .env.local.example からコピーしてユーザーに警告
if [ -f ../../.env.local ]; then
  cp ../../.env.local .env.local
else
  cp .env.local.example .env.local
  echo "⚠️  .env.local が見つかりませんでした。.env.local.example をコピーしました。worktrees/issue-<番号>/.env.local の各値を埋めてください。"
fi
```

---

## Step 5: エージェントを選択して実装を委譲する

Issue の内容を読んで、最も適切なエージェントを選ぶ。複数の領域にまたがる場合は複数エージェントを順番に使う。

| Issue の性質 | 使うエージェント |
|-------------|----------------|
| UI・React コンポーネント・TipTap・React Flow・スタイリング | `frontend-expert` |
| API Route・Prisma・DB・認証・Socket.io | `backend-expert` |
| テスト追加・テストカバレッジ改善 | `test-expert` |
| フルスタック（API + UI 両方） | `backend-expert` → `frontend-expert` の順 |

エージェントには以下の情報を渡す：
- 作業ディレクトリ：`worktrees/issue-<番号>/`
- Issue のタイトルと本文
- 実装方針（自分の判断を添える）

---

## Step 6: ライブラリ追加が必要な場合

実装中に新しいライブラリが必要になったら、`add-library` スキルに従い context7 MCP で最新ドキュメントを取得してから追加する。

```
mcp__context7__resolve-library-id → mcp__context7__query-docs → npm install
```

---

## Step 7: PR 作成はユーザーが明示的に依頼してから行う

実装完了後、PR の作成は自動で行わない。ユーザーが「PRを作って」と依頼したときに `create-pr` スキルを使う。

---

## 注意事項

- `git worktree add` 時にブランチ名が既存と衝突する場合は `issue-<番号>-2` などで回避する
- GitHub Projects のステータス変更に必要な ID（project-id, field-id, option-id）は `gh project field-list` と `gh project item-list` で動的に取得する
