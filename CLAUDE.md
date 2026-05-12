# logi-canvus

エンジニア向けのドキュメント型仕様策定ツール。Notion的なブロックエディタに、ドラッグ&ドロップによるフロー作図機能を統合したWebアプリ。

## 設計ドキュメント

※テスト設計書はcontext切迫しないよう、記載していない（/doc/test-spec.md）
| ドキュメント | 内容 |
| --------------------- | ------------------------------------------------------------------ |
| @doc/spec.md | プロダクト仕様書（機能・権限・データモデル骨格） |
| @doc/tech-stack.md | 技術スタック・Makefile・Husky・デプロイ先 |
| @doc/er-diagram.md | ERダイアグラム（Mermaid）・インデックス・カスケード削除方針 |
| @doc/screen-design.md | 画面設計書（画面一覧・遷移図・UIレイアウト・App Routerルート構成） |
| @doc/api-design.md | API設計書 |
| @doc/coding-rules-backend.md | バックエンド コーディングルール（Route Handler・Prisma・Auth.js・楽観的ロック） |
| @doc/coding-rules-frontend.md | フロントエンド コーディングルール（Next.js App Router・TipTap・React Flow・Tailwind） |
| @doc/coding-rules-test.md | テスト コーディングルール（Vitest・Playwright・命名規則・モック方針・カバレッジ） |

## プロダクトの核心

- **ドキュメントが主体。** テキストで仕様・背景を書き、必要な箇所に図ブロックを挿入するスタイル。図がメインではない。
- **図はキャンバス完結。** Mermaid記法は使わない。ドラッグ&ドロップのみで作図する。
- **組織内フラット権限。** 組織メンバー全員が同等権限（閲覧・編集・作成）。ページ単位の権限管理は不要。

## 実装上の制約・決定事項

- Mermaid互換は実装しない
- リアルタイム同時編集（CRDT / OT）は実装しない。楽観的ロック方式で競合を検出・通知する
- メール通知は実装しない。ツール内通知のみ
- 認証はEmail/Passwordのみ（OAuth不要）
- コードスケルトン生成・埋め込みURL発行はMVP対象外

## データモデルの骨格

```
Organization → User, Folder, Page
Page → Block（text / heading / diagram）
Block → DiagramNode, DiagramEdge（図ブロックのみ）
Block → Annotation → Comment
User → Notification
```
