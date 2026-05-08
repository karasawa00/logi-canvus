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

## Step 3: Issue 内容を取得する

```bash
gh issue view <番号> --json title,body,labels
```

取得した内容（タイトル・本文・ラベル）を読み、次のステップのエージェント選択と実装方針の判断に使う。

---

## Step 4: Worktree を作成する

```bash
git worktree add worktrees/issue-<番号> -b issue-<番号>
```

作成後、その worktree 内で husky をセットアップする。

```bash
cd worktrees/issue-<番号> && npm prepare
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

## 注意事項

- worktree 内の作業が完了したら、PR の作成はユーザーに確認を取ってから行う
- `git worktree add` 時にブランチ名が既存と衝突する場合は `issue-<番号>-2` などで回避する
