# logi-canvus

エンジニア向けのドキュメント型仕様策定ツール。Notion 的なブロックエディタに、ドラッグ&ドロップによるフロー作図機能を統合した Web アプリ。

## 概要

テキストで仕様・背景を書き、必要な箇所にフロー図ブロックを挿入するスタイルのドキュメントツール。アノテーション（ピン）機能で未確定箇所に質問を残し、コメントを通じて合意形成を行う。

## 技術スタック

| 用途                 | ライブラリ                         |
| -------------------- | ---------------------------------- |
| フレームワーク       | Next.js 15（App Router）           |
| ブロックエディタ     | TipTap                             |
| 図キャンバス         | React Flow（@xyflow/react）        |
| スタイリング         | Tailwind CSS                       |
| クライアント状態管理 | Zustand                            |
| サーバー状態管理     | TanStack Query                     |
| ORM                  | Prisma                             |
| DB                   | MySQL（Docker）                    |
| 認証                 | Auth.js v5（Credentials Provider） |
| リアルタイム通知     | Socket.io                          |

## セットアップ

### 前提条件

- Node.js
- Docker

### 初回セットアップ

1. 環境変数ファイルを作成する

```bash
cp .env.local.example .env.local
```

必要に応じて `.env.local` の値を編集してください。

2. セットアップを実行する

```bash
make setup
```

npm install・DB コンテナ起動・マイグレーションを一括実行します。

### 開発サーバー起動

```bash
make dev
```

## 主要コマンド

| コマンド          | 内容                        |
| ----------------- | --------------------------- |
| `make setup`      | 初回セットアップ            |
| `make dev`        | 開発サーバー起動            |
| `make build`      | プロダクションビルド        |
| `make lint`       | ESLint 実行                 |
| `make type-check` | TypeScript 型チェック       |
| `make test`       | Vitest 実行                 |
| `make db:up`      | MySQL コンテナ起動          |
| `make db:down`    | MySQL コンテナ停止          |
| `make db:migrate` | Prisma マイグレーション実行 |
| `make db:studio`  | Prisma Studio 起動          |

## 設計ドキュメント

| ドキュメント                                 | 内容             |
| -------------------------------------------- | ---------------- |
| [doc/spec.md](doc/spec.md)                   | プロダクト仕様書 |
| [doc/tech-stack.md](doc/tech-stack.md)       | 技術スタック詳細 |
| [doc/er-diagram.md](doc/er-diagram.md)       | ER ダイアグラム  |
| [doc/screen-design.md](doc/screen-design.md) | 画面設計書       |
| [doc/api-design.md](doc/api-design.md)       | API 設計書       |
| [doc/test-spec.md](doc/test-spec.md)         | テスト設計書     |
