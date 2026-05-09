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

### 1. 情報収集・種別判定

ユーザーのメッセージから以下を判断する。

| 項目 | 必須 | 備考 |
|------|------|------|
| タイトル | ✅ | 簡潔に何をするか |
| 種別 | ✅ | バグ報告 or 機能要望（内容から自動判定。不明なら確認する） |
| ラベル | 任意 | 指定があれば優先。なければ自動推論 |

### 2. ラベル決定

**ユーザーが明示した場合** → そのまま使う（推論不要）

**指定がない場合** → 以下のルールに従う。

- **バグ報告** → `bug` ラベル ＋ ドメイン系ラベル1つ以上
- **機能要望** → ドメイン系ラベル1つ以上のみ（`enhancement` は付与しない）

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

### 3. 本文生成（テンプレートファイルから取得）

種別に応じてテンプレートファイルを読み込み、frontmatter（`---` で囲まれた YAML 部分）を除去した本文を使う。

```bash
# バグ報告の場合
body=$(awk '/^---$/{f++; next} f==2{print}' .github/ISSUE_TEMPLATE/bug_report.md)

# 機能要望の場合
body=$(awk '/^---$/{f++; next} f==2{print}' .github/ISSUE_TEMPLATE/feature_request.md)
```

ユーザーが内容を提供している場合は、取得した本文の該当セクションにその内容を埋め込む。
空欄セクションはそのまま残す（GitHub 上でユーザーが補完できるようにする）。

### 4. Issue作成

```bash
gh issue create \
  --repo karasawa00/logi-canvus \
  --title "タイトル" \
  --body "$body" \
  --label "ラベル1,ラベル2"
```

### 5. GitHub Projectsに紐付け

issueのURLを取得してProjectに追加する。

```bash
gh project item-add 1 \
  --owner karasawa00 \
  --url <issueのURL>
```

### 6. 完了報告

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
