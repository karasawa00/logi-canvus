# テスト コーディングルール

## 基本方針

- テストは `Vitest` を使う（`make test` で実行）
- DB をモックしない。実際の DB（Docker MySQL）に接続して検証する
- テストコードにもコメントは「なぜ」が非自明な場合のみ書く

---

## ファイル配置

```
src/
  test/
    setup.ts                          ← グローバルセットアップ（DB 接続など）
    api/
      v1/
        auth/
          signup/
            post.test.ts              ← POST /api/v1/auth/signup
        organizations/
          [org-slug]/
            members/
              me/
                delete.test.ts        ← DELETE /api/v1/organizations/:org-slug/members/me
    components/
      ConfirmModal.test.tsx           ← 共有コンポーネントのテスト（必要な場合のみ）
```

- テストファイルは `src/test/` 配下に置く
- API テストは実際のエンドポイントと同じ階層でフォルダを切り、HTTPメソッドごとに `{method}.test.ts` として作成する
  - 例: `POST /api/v1/auth/signup` → `src/test/api/v1/auth/signup/post.test.ts`
  - 例: `GET /api/v1/organizations/:org-slug/members` → `src/test/api/v1/organizations/[org-slug]/members/get.test.ts`
- 共有コンポーネントのテストファイルは `src/test/components/<対象>.test.tsx`

---

## テスト構造

`describe` → `it` の2階層を基本とする。3階層以上はネストしない。

```ts
import { describe, it, expect, beforeEach } from 'vitest'

describe('POST /api/v1/auth/signup', () => {
  beforeEach(async () => {
    // DB クリーンアップ
  })

  it('create_org: 正常系 — 201 とユーザー・組織を返す', async () => { ... })
  it('create_org: email 重複 — 409 CONFLICT を返す', async () => { ... })
  it('join_org: 無効トークン — 404 NOT_FOUND を返す', async () => { ... })
})
```

---

## テスト名の命名規則

- `it` の説明は「条件 — 期待結果」の形式で書く
- 日本語で書く（コードベースのドキュメントに合わせる）
- 正常系・異常系・境界値の順に並べる

```ts
// 良い例
it('正常系 — 201 とユーザーデータを返す', ...)
it('email が空文字 — 400 VALIDATION_ERROR を返す', ...)
it('トークン期限切れ — 404 NOT_FOUND を返す', ...)

// 悪い例
it('works', ...)
it('test1', ...)
```

---

## DB とモック

- **DB はモックしない**。テストは Docker MySQL（`.env.test` の接続先）に対して実行する
- `vi.mock` は外部 HTTP API・メール送信など I/O のみに使用する
- Prisma クライアントはモックせず実際のクエリを発行する

```ts
// 禁止: DB モック
vi.mock('@/lib/prisma')

// 許可: 外部サービスのモック
vi.mock('@/lib/email', () => ({ sendInvitationEmail: vi.fn() }))
```

---

## テストデータ管理

- 各テストの `beforeEach` で使用テーブルを削除してクリーンな状態から始める
- テストデータは各 `it` 内で最小限だけ作成する（共有フィクスチャは原則使わない）
- `afterAll` でテスト用 DB の全テーブルをクリーンアップする

```ts
import { prisma } from '@/lib/prisma'

beforeEach(async () => {
  await prisma.user.deleteMany()
  await prisma.organization.deleteMany()
})
```

---

## Route Handler のテスト

- `NextRequest` を直接生成してハンドラ関数を呼び出す
- レスポンスの `status` と `body` を検証する

```ts
import { POST } from '@/app/api/v1/auth/signup/route'

it('正常系 — 201 を返す', async () => {
  const req = new Request('http://localhost/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'テスト太郎',
      email: 'test@example.com',
      password: 'password123',
      organization: { action: 'create', name: 'Test Org' },
    }),
  })

  const res = await POST(req as any)
  expect(res.status).toBe(201)

  const json = await res.json()
  expect(json.data.user.email).toBe('test@example.com')
  expect(json.data.organization.slug).toBeDefined()
})
```

---

## アサーション

- `expect(value).toBe(expected)` は厳密等価に使う
- オブジェクトの部分一致は `expect(value).toMatchObject({ ... })` を使う
- エラーケースはステータスコードと `error.code` の両方を確認する

```ts
// エラーケースのアサーション
expect(res.status).toBe(409)
const json = await res.json()
expect(json.error.code).toBe('CONFLICT')
```

---

## カバレッジ方針

- API Route Handler は正常系・主要な異常系（バリデーション・認可・競合）を必ずカバーする
- UI の動作検証は E2E（Playwright）を優先する
- `src/components/` の共有コンポーネントに複雑なロジックがある場合のみ Vitest で単体テストを書く
- 100% カバレッジは目標としない。価値のある境界値・エラーパスに絞る

---

## E2E テスト（Playwright）

### 基本方針

- E2E テストは Playwright を使う（`make test:e2e` で実行）
- Vitest（`make test`）とは完全に分離し、互いの設定・実行に干渉しない
- ブラウザ操作が必要な画面フロー（フォーム送信・ページ遷移）に限定して使う
- ユニットテスト・統合テストで検証できるロジックはそちらに任せる

### ファイル配置

```
src/
  test/
    e2e/
      login.test.ts    ← 画面単位で1ファイル
      signup.test.ts
      ...
playwright.config.ts   ← プロジェクトルート
```

### テスト構造

`test.describe` → `test` の2階層。Vitest と異なり `it` ではなく `test` を使う。

```ts
import { test, expect } from '@playwright/test'

test.describe('ログイン画面 /login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
  })

  test('Email空のまま送信 — エラーが表示される', async ({ page }) => {
    await page.getByTestId('submit-button').click()
    await expect(page.getByTestId('error-message')).toHaveText('メールアドレスを入力してください。')
  })
})
```

### セレクタ方針

- `data-testid` 属性を優先する（実装コンポーネントに `data-testid` を付与すること）
- ロール指定（`getByRole`）はリンク・ボタンなどセマンティクスが明確な場合に使う
- テキスト指定（`getByText`）はコピーが変わるとテストが壊れるため避ける

### dev server との関係

- `playwright.config.ts` に `webServer` を設定し、CI では自動起動する
- ローカルでは `reuseExistingServer: true`（`npm run dev` 起動済みを再利用）

### CI での実行

- `e2e` ジョブで MySQL サービスコンテナを起動し、`prisma migrate deploy` 後に実行する
- E2E ジョブは `test` ジョブ（Vitest）と並列実行する
- 実行コマンド: `make test:e2e`
