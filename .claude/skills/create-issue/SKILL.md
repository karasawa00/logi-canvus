---
name: create-issue
description: >
  logi-canvus リポジトリに GitHub Issue を作成するスキル。
  「issueを作って」「issue作成して」「〇〇のissueを立てて」「バグをissueに起票して」など、
  issueの作成・起票・登録を求められたときは必ずこのスキルを使うこと。
  作成したissueはGitHub Projects（logi-canvus）に自動で紐付け、
  内容からラベルを自動推論して付与する。ユーザーが明示したラベルは推論より優先する。
---

# GitHub Issue 作成スキル

## リポジトリ情報

- **リポジトリ**: `karasawa00/logi-canvus`
- **GitHub Project**: `logi-canvus`（Project番号: 1、オーナー: `karasawa00`）

---

## 手順

### 1. 情報収集

ユーザーのメッセージからissue情報を抽出する。不足している場合のみ確認する。

| 項目 | 必須 | 備考 |
|------|------|------|
| タイトル | ✅ | 簡潔に何をするか |
| 本文 | 任意 | 背景・詳細・再現手順など |
| ラベル | 任意 | 指定があれば優先。なければ自動推論 |

タイトルだけ明確なら本文なしで進めてよい。

### 2. ラベル決定

**ユーザーが明示した場合** → そのまま使う（推論不要）

**指定がない場合** → 以下の基準でドメイン系ラベルを1つ以上推論する。
タイプ系ラベル（bug / enhancement / documentation など）は付与しない。

#### ドメイン系ラベル（1つ以上選ぶ）

| ラベル | 選ぶ基準 |
|--------|---------|
| `auth` | 認証・ログイン・セッション・Auth.js・パスワード |
| `frontend` | UI・画面・コンポーネント・React・TipTap・React Flow |
| `backend` | API・Route Handler・サーバー・Prisma・エンドポイント |
| `infra` | DB・MySQL・Docker・環境・デプロイ・Cloud Run |
| `setup` | 初期設定・セットアップ・開発環境・Makefile・Husky |

複数ドメインにまたがるissueは複数付与する。
判断に迷う場合は推論したラベルをユーザーに確認してから進める。

### 3. Issue作成

```bash
gh issue create \
  --repo karasawa00/logi-canvus \
  --title "タイトル" \
  --body "本文（なければ空文字）" \
  --label "ラベル1,ラベル2"
```

### 4. GitHub Projectsに紐付け

issueのURLを取得してProjectに追加する。

```bash
gh project item-add 1 \
  --owner karasawa00 \
  --url <issueのURL>
```

### 5. 完了報告

作成したissueのURL・タイトル・付与したラベルをユーザーに伝える。

---

## 出力例

```
Issue #42 を作成しました。

タイトル: ログイン画面のバリデーションエラーが表示されない
ラベル: bug, frontend
Project: logi-canvus に追加済み
URL: https://github.com/karasawa00/logi-canvus/issues/42
```
