# logi-canvus 技術スタック

## フロントエンド

| 用途 | ライブラリ |
|------|-----------|
| フレームワーク | Next.js 15（App Router） |
| 言語 | TypeScript |
| ブロックエディタ | TipTap |
| 図キャンバス | React Flow（@xyflow/react） |
| スタイリング | Tailwind CSS |
| クライアント状態管理 | Zustand |
| サーバー状態管理 | TanStack Query |

## バックエンド

| 用途 | ライブラリ |
|------|-----------|
| API | Next.js Route Handlers（App Router） |
| ORM | Prisma |
| DB | MySQL |
| 認証 | Auth.js v5（NextAuth / Credentials Provider）+ Prisma Adapter。ログイン・ログアウト・セッション確認は Auth.js の `/api/auth/*` ルートに委譲。ユーザー登録（signup）のみカスタム Route Handler（`/api/v1/auth/signup`）として実装する。 |
| リアルタイム通知 | Socket.io |

## インフラ（ローカル開発）

- MySQL は Docker コンテナで起動
- `docker-compose.yml` でコンテナ定義・管理
- 接続先は `.env.local` の `DATABASE_URL` で切り替え

## インフラ（本番）

- デプロイ先: **GCP Cloud Run**
- デプロイ関連コマンドは Makefile に追記予定（`make deploy` 等）

## 開発ツール

| 用途 | ツール |
|------|--------|
| パッケージ管理 | npm |
| Git フック | Husky |
| コマンド管理 | Makefile |
| Lint | ESLint |
| フォーマット | Prettier |
| テスト | Vitest |

## Makefile コマンド一覧

| コマンド | 内容 |
|---------|------|
| `make setup` | 初回セットアップ（npm install + DB起動 + マイグレーション） |
| `make dev` | 開発サーバー起動（`next dev`） |
| `make build` | プロダクションビルド（`next build`） |
| `make lint` | ESLint 実行 |
| `make type-check` | TypeScript 型チェック（`tsc --noEmit`） |
| `make db:up` | MySQL コンテナ起動（`docker compose up -d`） |
| `make db:down` | MySQL コンテナ停止（`docker compose down`） |
| `make db:migrate` | Prisma マイグレーション実行（`prisma migrate dev`） |
| `make db:generate` | Prisma クライアント生成（`prisma generate`） |
| `make db:studio` | Prisma Studio 起動 |
| `make test` | Vitest 実行 |
| `make deploy` | GCP Cloud Run へデプロイ（詳細は別途追記） |

## Husky フック

| フック | 実行内容 |
|--------|---------|
| `pre-commit` | Prettier フォーマット + `make lint` + `make type-check` |
| `pre-push` | `make test` |
| `commit-msg` | コミットメッセージのフォーマット検証 |

## アーキテクチャ概要

```
TipTap（ドキュメントエディタ）
  ├── TextBlock    → TipTap 標準ノード
  ├── HeadingBlock → TipTap 標準ノード
  └── DiagramBlock → TipTap カスタム Extension
                        └── React Flow（図キャンバス）
                              ├── ScreenNode
                              ├── ActionNode
                              ├── BranchNode
                              ├── StartNode / EndNode
                              └── ExternalNode

Next.js App Router
  ├── app/（画面ルーティング）
  └── app/api/（Route Handlers）
        ├── 認証（Auth.js）
        ├── ページ・ブロック CRUD
        ├── アノテーション・コメント
        └── 通知（Socket.io）

Prisma → MySQL（ローカルは Docker コンテナ）
```
