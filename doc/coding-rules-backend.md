# バックエンド コーディングルール

## 基本方針

- コメントは「なぜ」が非自明な場合のみ書く。コードが何をするかは書かない
- `any` を使わない。型が不明な場合は `unknown` を使い、型ガードで絞る
- エラー握りつぶし禁止。`catch` は必ずハンドリングするか再スローする

---

## レスポンス形式

すべての Route Handler は以下の形式を使う。

```ts
// 成功
return NextResponse.json({ data: { ... } }, { status: 200 })

// エラー
return NextResponse.json(
  { error: { code: 'VALIDATION_ERROR', message: '...' } },
  { status: 400 },
)
```

### エラーコード対応表

| HTTPステータス | code | 用途 |
|--------------|------|------|
| 400 | `VALIDATION_ERROR` | 入力不正 |
| 401 | `UNAUTHORIZED` | 未認証 |
| 403 | `FORBIDDEN` | 権限なし |
| 404 | `NOT_FOUND` | リソースなし |
| 409 | `CONFLICT` | 楽観的ロック競合・重複 |
| 500 | `INTERNAL_ERROR` | 予期しないサーバーエラー |

---

## 入力バリデーション

- リクエストボディは `as T` でキャストした直後に各フィールドを検証する
- null・undefined・型・空文字の順で確認する
- JSON パース失敗は `try/catch` で捕捉して `400 VALIDATION_ERROR` を返す

```ts
let body: RequestBody
try {
  body = (await request.json()) as RequestBody
} catch {
  return NextResponse.json(
    { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body.' } },
    { status: 400 },
  )
}
```

---

## 認証・認可

- Route Handler の先頭で `auth()` を呼び、未認証なら即 `401` を返す
- `session.user.orgId` が null のユーザー（組織脱退済み）はログイン不可のため `403` を返す
- リソースの組織帰属チェック（`resource.orgId !== session.user.orgId`）を必ず行う

```ts
const session = await auth()
if (!session?.user) {
  return NextResponse.json(
    { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
    { status: 401 },
  )
}
if (!session.user.orgId) {
  return NextResponse.json(
    { error: { code: 'FORBIDDEN', message: 'Organization membership required.' } },
    { status: 403 },
  )
}
```

---

## Prisma

- `prisma` クライアントは `@/lib/prisma` からインポートする（直接 `new PrismaClient()` しない）
- 複数テーブルを更新する場合は `prisma.$transaction` でまとめる
- Prisma P2002（unique 制約違反）は明示的にキャッチして適切なエラーを返す

```ts
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

try {
  await prisma.$transaction(async (tx) => { ... })
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    return NextResponse.json(
      { error: { code: 'CONFLICT', message: 'Resource already exists.' } },
      { status: 409 },
    )
  }
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Unexpected error.' } },
    { status: 500 },
  )
}
```

---

## 楽観的ロック

- `Page` と `Block` の更新時はリクエストに `version` を含め、DB の値と比較する
- 不一致なら `409 CONFLICT` を返し、レスポンスに現在の最新リソースを含める
- `version` のインクリメントは `update` クエリと同じトランザクション内で行う

```ts
const block = await tx.block.findUnique({ where: { id } })
if (!block || block.version !== requestedVersion) {
  return NextResponse.json(
    {
      error: {
        code: 'CONFLICT',
        message: 'Block has been modified by another user.',
        current: block,
      },
    },
    { status: 409 },
  )
}
await tx.block.update({ where: { id }, data: { ..., version: { increment: 1 } } })
```

---

## email の正規化

- email を受け取る箇所ではすべて `.toLowerCase()` してから DB に保存・照合する
- 招待作成（`POST /invitations`）、サインアップ（`POST /auth/signup`）の両方で適用済み

```ts
const normalizedEmail = email.toLowerCase()
```

---

## Auth.js

- セッション取得はサーバーコンポーネント・Route Handler では `auth()` を使う
- `strategy: 'jwt'` を採用しているため `@auth/prisma-adapter` は使用しない（→ ADR-002）
- JWT には `id`, `email`, `name`, `orgId`, `orgSlug` を格納する

---

## パスワード

- ハッシュ化には `bcryptjs` を使い、`saltRounds` は `12` にする
- パスワード検証は `bcrypt.compare(plain, hash)` で行う
- 入力バリデーション（8文字以上）→ invitation 検証 → `bcrypt.hash` の順で実行する（無効な状態では bcrypt を走らせない）

---

## slug 生成

- 組織 slug はサーバー側で自動生成する（`slugify` → `uniqueOrgSlug`）
- `uniqueOrgSlug` はトランザクション内で実行し、slug チェックと作成を原子化する
- 重複時は `-2`, `-3` のサフィックスを付与する
