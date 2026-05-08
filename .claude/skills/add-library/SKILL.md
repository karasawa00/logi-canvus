---
name: add-library
description: >
  ライブラリ・パッケージをプロジェクトに追加・導入するときのスキル。
  context7 MCP で最新ドキュメントを取得してから、正しい API・設定・使い方でインストールと実装を行う。
  「〇〇を追加して」「〇〇をインストールして」「〇〇を導入したい」「〇〇を使って実装して」
  「〇〇のセットアップをして」のように、新しい npm パッケージやライブラリの統合が必要なときは
  必ずこのスキルを使うこと。既存ライブラリのバージョンアップや設定変更にも使う。
---

# ライブラリ追加スキル

新しいライブラリを追加するとき、API の変化や設定方法の変更は頻繁に起きる。
記憶の中の知識は古い可能性があるので、context7 で最新ドキュメントを取得してから実装する。

## 手順

### Step 1: ライブラリIDを解決する

`mcp__context7__resolve-library-id` を使って、ライブラリ名から context7 のドキュメント ID を取得する。

```
tool: mcp__context7__resolve-library-id
libraryName: "<ライブラリ名>"
```

候補が複数返ってきた場合は、プロジェクトのスタック（Next.js / TypeScript / React）に合ったものを選ぶ。
見つからなければ別の表記（例: `@xyflow/react` → `react-flow`）で再試行する。

### Step 2: 関連ドキュメントを取得する

`mcp__context7__query-docs` で必要なトピックのドキュメントを取得する。

```
tool: mcp__context7__query-docs
context7CompatibleLibraryID: "<Step1で得たID>"
topic: "<インストール方法・セットアップ・主要APIなど>"
tokens: 5000
```

取得すべきトピックの目安：
- インストール・セットアップ手順
- このプロジェクトで使う主要 API・コンポーネント
- Next.js App Router や TypeScript との統合方法（該当する場合）

### Step 3: インストールと実装

ドキュメントの内容を踏まえて：

1. `npm install <package>` でパッケージを追加
2. ドキュメントに従って設定ファイルや初期化コードを記述
3. プロジェクトの既存コードスタイル・ディレクトリ構成に合わせて実装

ドキュメントと記憶の内容が食い違う場合は、**ドキュメントを優先する**。

## プロジェクト情報（参考）

- フレームワーク: Next.js 15（App Router）
- 言語: TypeScript
- スタイリング: Tailwind CSS
- パッケージ管理: npm
