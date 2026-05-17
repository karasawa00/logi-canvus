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
| `make test:e2e`   | Playwright E2E テスト実行   |
| `make db:up`      | MySQL コンテナ起動          |
| `make db:down`    | MySQL コンテナ停止          |
| `make db:migrate` | Prisma マイグレーション実行 |
| `make db:studio`  | Prisma Studio 起動          |

## MCP サーバー

Claude Code でこのプロジェクトを開く際、`.mcp.json` に定義された以下の MCP サーバーが利用可能です。

| サーバー   | 用途                                     |
| ---------- | ---------------------------------------- |
| context7   | ライブラリの最新ドキュメント取得         |
| playwright | ブラウザ操作・E2E デバッグ               |
| serena     | コードシンボル検索・リファクタリング支援 |
| stitch     | UI デザイン生成・デザインシステム管理    |

### Stitch MCP の注意事項

Stitch MCP は `@_davideast/stitch-mcp` プロキシ経由で gcloud のアクセストークンを使います。API キーは Stitch API で使用できません。

**必須の設定手順：**

1. [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) をインストールする
2. アプリケーションデフォルト認証を実行する

```bash
gcloud auth application-default login
```

3. GCP プロジェクトを設定する

```bash
gcloud config set project <your-gcp-project-id>
```

4. GCP コンソールで [Stitch API](https://console.cloud.google.com/apis/library/stitch.googleapis.com) を有効にする

5. Claude Code を起動する（`.mcp.json` の設定は変更不要）

> `npx @_davideast/stitch-mcp proxy` が初回起動時に自動インストールされます。

**制限事項：**

ADC のアクセストークンは約 1 時間で失効します。Claude Code のセッションが 1 時間を超えると Stitch MCP が応答しなくなるため、Claude Code を再起動してください。

---

## 設計ドキュメント

| ドキュメント                                 | 内容             |
| -------------------------------------------- | ---------------- |
| [doc/spec.md](doc/spec.md)                   | プロダクト仕様書 |
| [doc/tech-stack.md](doc/tech-stack.md)       | 技術スタック詳細 |
| [doc/er-diagram.md](doc/er-diagram.md)       | ER ダイアグラム  |
| [doc/screen-design.md](doc/screen-design.md) | 画面設計書       |
| [doc/api-design.md](doc/api-design.md)       | API 設計書       |
| [doc/test-spec.md](doc/test-spec.md)         | テスト設計書     |
