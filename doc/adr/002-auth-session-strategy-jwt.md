# ADR-002: Auth.js セッション戦略を JWT にする

## ステータス

採用済み（2026-05-09）

## 背景

Auth.js v5（Credentials Provider）のセッション管理方式として、**JWT セッション**と**database セッション**の2つの選択肢がある。

database セッションを使う場合は `@auth/prisma-adapter` が必要になり、Prisma スキーマに `Session` / `Account` / `VerificationToken` テーブルを追加しなければならない。
JWT セッションは追加テーブルが不要でステートレスに動作する。

本プロジェクトのインフラ・設計要件を踏まえ、どちらを採用すべきか検討した。

## 決定事項

**JWT セッション**（`strategy: 'jwt'`）を採用する。
`@auth/prisma-adapter` は依存関係に追加しない。

## 検討した選択肢

### 選択肢 A: database セッション（`strategy: 'database'`）

Auth.js が発行するセッショントークンを DB に保存し、リクエストごとに `sessions` テーブルを参照して検証する。

**メリット**
- セッションを即時無効化できる（強制ログアウトが確実に反映される）
- セッション情報がサーバー管理のため、クライアントに渡る情報を最小化できる

**デメリット**
- **Cloud Run スケールアウトで全リクエストに DB ルックアップが増える**: ステートレスインスタンスが増えるほどセッション参照のクエリ数が増加し、MySQL に負荷が集中する
- **ER 図への追加が必要**: `sessions` / `accounts` / `verification_tokens` テーブルを Prisma スキーマと ER 図に追加しなければならない。設計上これらは不要だったため後付けになる
- **Credentials Provider との相性**: OAuth を使わないため `accounts` テーブルはほぼ空になり、リフレッシュトークン管理の恩恵を受けられない

### 選択肢 B: JWT セッション（`strategy: 'jwt'`）（採用）

セッション情報を署名済み JWT に格納し、Cookie でクライアントに保持させる。リクエストごとの DB 参照は不要。

**メリット**
- **Cloud Run のスケールアウトとの相性が良い**: JWT の検証は署名のみで完結するため、インスタンスを増やしても DB 負荷が増加しない
- **Socket.io との接続認証が簡潔**: Socket.io のハンドシェイク時に Cookie の JWT をそのまま検証できる。database セッションでは接続ごとに DB クエリが必要になる
- **追加スキーマが不要**: ER 図の設計方針（`sessions` / `accounts` テーブルを持たない）と一致する
- **Credentials Provider 専用設計と一致**: OAuth のリフレッシュトークン管理が不要なため、JWT の主なデメリット（トークン更新の複雑さ）が発生しない
- **MVP スコープへの適合**: 強制ログアウトが即時反映されないというデメリットは、フラット権限・組織内完結の本プロジェクトでは許容範囲内

**デメリット**
- セッション無効化（強制ログアウト・権限剥奪の即時反映）がトークン期限切れまで遅れる
- JWT にはセッション固定情報（`orgId`, `orgSlug`）が含まれるため、組織脱退後も期限内は古い情報を持ち続ける可能性がある（API 側の認可チェックで補完する）

## 実装指針

- セッション有効期限はデフォルト（30日）を使用する
- JWT には `id`, `email`, `name`, `orgId`, `orgSlug` を格納する（`src/types/next-auth.d.ts` で型定義済み）
- `orgId = null`（組織脱退済み）のユーザーはサーバー側の認可チェックで弾く（`auth()` 関数で取得したセッションの `orgId` を各 Route Handler で確認する）
- 組織脱退後にセッションが残る問題は、脱退 API（`DELETE /organizations/:org-slug/members/me`）の実装時にサーバーサイドでセッションを無効化する仕組みを検討する

## 関連ファイル

| ファイル | 内容 |
|---------|------|
| `src/lib/auth.ts` | Auth.js 設定（`strategy: 'jwt'`、JWT/セッションコールバック） |
| `src/middleware.ts` | JWT 検証によるルート保護 |
| `src/types/next-auth.d.ts` | JWT・Session の型拡張定義 |
| `doc/er-diagram.md` | ER 図（Session / Account テーブルを持たない設計） |
