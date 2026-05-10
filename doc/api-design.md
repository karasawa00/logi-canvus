# logi-canvus API設計書

## 1. 概要

### ベースURL
```
/api/v1
```

### 認証方式
- Auth.js v5（NextAuth / Credentials Provider）でセッション管理を行う
- セッション Cookie（`HttpOnly`）は Auth.js が発行・検証する
- ログイン・ログアウト・セッション確認は Auth.js の `/api/auth/*` ルートが処理する（カスタム実装不要）
- ユーザー登録（signup）と招待受け入れのみカスタム Route Handler（`/api/v1/`）として実装する
- 全エンドポイント（認証系を除く）でセッション Cookie が必要
- 未認証時は `401 Unauthorized`

### 共通レスポンス形式

**成功**
```json
{ "data": { ... } }
```

**エラー**
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Block has been modified by another user."
  }
}
```

### 共通エラーコード

| HTTPステータス | code | 意味 |
|--------------|------|------|
| 400 | `VALIDATION_ERROR` | リクエスト不正 |
| 401 | `UNAUTHORIZED` | 未認証 |
| 403 | `FORBIDDEN` | 権限なし |
| 404 | `NOT_FOUND` | リソースなし |
| 409 | `CONFLICT` | 楽観的ロック競合 |
| 500 | `INTERNAL_ERROR` | サーバーエラー |

### 楽観的ロック

`Page` と `Block` は楽観的ロックで競合を検出する。

- クライアントは取得時の `version` を更新リクエストに含める
- サーバー側で `version` が一致しない場合は `409 CONFLICT` を返す
- `409` レスポンスボディには最新のリソースデータを含める（diff表示に使用）

```
クライアント           サーバー
  GET /blocks/xxx  →
                   ←  { version: 3, content: "..." }
  （編集）
  PATCH /blocks/xxx { version: 3, content: "new" }  →
                   ←  409 { current: { version: 4, content: "other" } }
  （競合解決UI表示）
  PATCH /blocks/xxx { version: 4, content: "new" }  →   ← 強制上書き
                   ←  200 { version: 5, content: "new" }
```

---

## 2. エンドポイント一覧

### 2-1. 認証

Auth.js v5（Credentials Provider）を使用する。ログイン・ログアウト・セッション確認は
Auth.js が生成する `/api/auth/*` ルートで処理され、カスタム実装は不要。

#### Auth.js 標準エンドポイント（カスタム実装不要）

| エンドポイント | 用途 | 備考 |
|---|---|---|
| `POST /api/auth/signin` | ログイン（Credentials Provider） | `email` / `password` を受け取りセッション Cookie を発行 |
| `POST /api/auth/signout` | ログアウト | セッション Cookie を破棄 |
| `GET /api/auth/session` | セッション情報取得 | `{ user: { id, name, email }, expires }` を返す |

> サーバーコンポーネント・Route Handler では `auth()` 関数でセッションを取得する。
> クライアントコンポーネントでは `useSession()` フックを使用する。
> 組織情報（`organization`）は Auth.js のセッションオブジェクトを拡張して保持する。

---

#### POST `/api/v1/auth/signup`
（カスタム Route Handler）新規ユーザー登録と組織の作成または既存組織への参加を行う。
登録完了後、クライアントは `signIn('credentials', { email, password })` を呼び出してセッションを開始する。

> **email の正規化:** サーバー側で email を小文字に正規化してから保存・照合する。

**Request**
```json
{
  "name": "田中太郎",
  "email": "tanaka@example.com",
  "password": "password123",
  "organization": {
    "action": "create",
    "name": "Acme Inc"
  }
}
```
```json
{
  "name": "田中太郎",
  "email": "tanaka@example.com",
  "password": "password123",
  "organization": {
    "action": "join",
    "invite_token": "abc123"
  }
}
```

**Response** `201`
```json
{
  "data": {
    "user": { "id": "u_xxx", "name": "田中太郎", "email": "tanaka@example.com" },
    "organization": { "id": "o_xxx", "name": "Acme Inc", "slug": "acme-inc" }
  }
}
```

| エラー | 条件 |
|--------|------|
| `409 CONFLICT` | 同じ email のアカウントが既に存在する |
| `403 FORBIDDEN` | `join` 時: リクエストの email が招待の宛先 email と不一致 |
| `404 NOT_FOUND` | `join` 時: トークンが無効・期限切れ・使用済み |

---

### 2-2. 組織

#### GET `/api/v1/organizations/:org-slug`
組織情報を取得する。

**Response** `200`
```json
{
  "data": {
    "id": "o_xxx",
    "name": "Acme Inc",
    "slug": "acme-inc",
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

---

#### PATCH `/api/v1/organizations/:org-slug`
組織名を更新する。

**Request**
```json
{ "name": "Acme Corporation" }
```

**Response** `200`
```json
{
  "data": { "id": "o_xxx", "name": "Acme Corporation", "slug": "acme-inc" }
}
```

---

#### GET `/api/v1/organizations/:org-slug/members`
組織メンバー一覧を取得する。

**Response** `200`
```json
{
  "data": [
    { "id": "u_xxx", "name": "田中太郎", "email": "tanaka@example.com" },
    { "id": "u_yyy", "name": "山田花子", "email": "yamada@example.com" }
  ]
}
```

---

#### DELETE `/api/v1/organizations/:org-slug/members/me`
自分自身が組織から脱退する。脱退後も自分が作成したページ・アノテーション・コメントは残存する。

> 組織内の最終メンバーであっても脱退は可能。Organization レコードは追跡性の観点から削除しない（メンバー 0 名の状態で残存する）。

**Response** `204`

---

### 2-3. 招待

#### POST `/api/v1/organizations/:org-slug/invitations`
招待メールを送信する。

**Request**
```json
{ "email": "newmember@example.com" }
```

**Response** `201`
```json
{
  "data": {
    "id": "inv_xxx",
    "email": "newmember@example.com",
    "token": "abc123",
    "expires_at": "2026-01-08T00:00:00Z",
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

---

#### GET `/api/v1/invitations/:token`
招待トークンの情報を取得する（組織名の表示用）。

**Response** `200`
```json
{
  "data": {
    "organization": { "id": "o_xxx", "name": "Acme Inc", "slug": "acme-inc" },
    "email": "newmember@example.com"
  }
}
```

| エラー | 条件 |
|--------|------|
| `404 NOT_FOUND` | トークンが無効または期限切れ |

---

#### POST `/api/v1/invitations/:token/accept`
招待を受け入れて組織に参加する。ログイン済みのユーザーが呼び出す。

> ログイン中のユーザーの email が招待の宛先 email と一致しない場合は `403 FORBIDDEN` を返す。

**Response** `200`
```json
{
  "data": {
    "organization": { "id": "o_xxx", "name": "Acme Inc", "slug": "acme-inc" }
  }
}
```

| エラー | 条件 |
|--------|------|
| `403 FORBIDDEN` | ログイン中ユーザーの email が招待の宛先 email と不一致 |
| `404 NOT_FOUND` | トークンが無効・期限切れ・使用済み |

---

### 2-4. フォルダ

#### GET `/api/v1/organizations/:org-slug/folders`
フォルダ一覧をツリー構造で取得する（サイドバー表示用）。

**Response** `200`
```json
{
  "data": [
    {
      "id": "f_xxx",
      "name": "機能仕様",
      "parent_folder_id": null,
      "created_at": "2026-01-01T00:00:00Z",
      "children": [
        { "id": "f_yyy", "name": "認証", "parent_folder_id": "f_xxx", "children": [] }
      ]
    }
  ]
}
```

---

#### POST `/api/v1/organizations/:org-slug/folders`
フォルダを作成する。

**Request**
```json
{
  "name": "新規フォルダ",
  "parent_folder_id": null
}
```

**Response** `201`
```json
{
  "data": {
    "id": "f_zzz",
    "name": "新規フォルダ",
    "parent_folder_id": null,
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

---

#### PATCH `/api/v1/organizations/:org-slug/folders/:folder-id`
フォルダ名・親フォルダを更新する。

**Request**
```json
{
  "name": "リネーム後",
  "parent_folder_id": "f_xxx"
}
```

**Response** `200`

---

#### DELETE `/api/v1/organizations/:org-slug/folders/:folder-id`
フォルダを削除する。サブフォルダも再帰的に削除される。削除されたフォルダ配下のページはすべて `folder_id = null` になる（孤立ページとして残存）。

**Response** `204`

---

### 2-4b. サイドバー

#### GET `/api/v1/organizations/:org-slug/sidebar`
サイドバー表示用にフォルダツリーとページ一覧を1リクエストで返す。

**Response** `200`
```json
{
  "data": {
    "folders": [
      {
        "id": "f_xxx",
        "name": "機能仕様",
        "parent_folder_id": null,
        "children": [
          { "id": "f_yyy", "name": "認証", "parent_folder_id": "f_xxx", "children": [] }
        ]
      }
    ],
    "pages": [
      {
        "id": "p_xxx",
        "title": "ログイン機能 仕様",
        "url_slug": "login-spec-a1b2c3",
        "folder_id": "f_xxx",
        "updated_at": "2026-01-02T10:00:00Z"
      },
      {
        "id": "p_yyy",
        "title": "フォルダなしのページ",
        "url_slug": "orphan-page-c3d4e5",
        "folder_id": null,
        "updated_at": "2026-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

### 2-5. ページ

#### GET `/api/v1/organizations/:org-slug/pages`
ページ一覧を取得する（ダッシュボード用）。

**Query Parameters**
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `folder_id` | string | フォルダ絞り込み（省略で全ページ） |
| `recent` | boolean | `true` のとき更新日時降順で最大10件 |

**Response** `200`
```json
{
  "data": [
    {
      "id": "p_xxx",
      "title": "ログイン機能 仕様",
      "url_slug": "login-spec-a1b2c3",
      "folder_id": "f_xxx",
      "created_by": { "id": "u_xxx", "name": "田中太郎" },
      "created_at": "2026-01-01T00:00:00Z",
      "updated_at": "2026-01-02T10:00:00Z"
    }
  ]
}
```

---

#### POST `/api/v1/organizations/:org-slug/pages`
ページを新規作成する。`url_slug` はサーバー側で自動生成する。

**Request**
```json
{
  "title": "新しい仕様書",
  "folder_id": null
}
```

**Response** `201`
```json
{
  "data": {
    "id": "p_yyy",
    "title": "新しい仕様書",
    "url_slug": "new-spec-b2c3d4",
    "folder_id": null,
    "version": 1,
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-01T00:00:00Z"
  }
}
```

---

#### GET `/api/v1/organizations/:org-slug/pages/:page-slug`
ページ詳細をブロック・ノード・エッジ込みで取得する（ページエディタ初期ロード用）。

**Response** `200`
```json
{
  "data": {
    "id": "p_xxx",
    "title": "ログイン機能 仕様",
    "url_slug": "login-spec-a1b2c3",
    "version": 3,
    "folder_id": "f_xxx",
    "created_by": { "id": "u_xxx", "name": "田中太郎" },
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-02T10:00:00Z",
    "blocks": [
      {
        "id": "b_aaa",
        "type": "heading",
        "order": 1.0,
        "content": "ログイン機能 仕様",
        "version": 1,
        "nodes": [],
        "edges": []
      },
      {
        "id": "b_bbb",
        "type": "diagram",
        "order": 2.0,
        "content": null,
        "version": 2,
        "nodes": [
          {
            "id": "n_aaa",
            "type": "Start",
            "label": "",
            "position_x": 100.0,
            "position_y": 100.0
          }
        ],
        "edges": [
          {
            "id": "e_aaa",
            "source_node_id": "n_aaa",
            "target_node_id": "n_bbb",
            "label": null
          }
        ]
      }
    ]
  }
}
```

---

#### PATCH `/api/v1/organizations/:org-slug/pages/:page-slug`
ページタイトルまたはフォルダを更新する。楽観的ロック対象。

**Request**
```json
{
  "title": "ログイン機能 仕様 v2",
  "folder_id": "f_yyy",
  "version": 3
}
```

**Response** `200`
```json
{
  "data": {
    "id": "p_xxx",
    "title": "ログイン機能 仕様 v2",
    "version": 4,
    "updated_at": "2026-01-03T00:00:00Z"
  }
}
```

| エラー | 条件 |
|--------|------|
| `409 CONFLICT` | `version` が現在値と不一致 |

**409レスポンスボディ**
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Page has been modified by another user.",
    "current": {
      "id": "p_xxx",
      "title": "別のタイトル",
      "version": 4,
      "updated_at": "2026-01-03T00:00:00Z"
    }
  }
}
```

---

#### DELETE `/api/v1/organizations/:org-slug/pages/:page-slug`
ページを削除する。配下のブロック・アノテーション・コメントも CASCADE 削除される。

**Response** `204`

---

### 2-6. ブロック

#### POST `/api/v1/pages/:page-id/blocks`
ブロックを追加する。`order` はサーバー側で末尾または指定位置の中間値を計算する。

**Request**
```json
{
  "type": "text",
  "after_block_id": "b_aaa"
}
```

**Response** `201`
```json
{
  "data": {
    "id": "b_ccc",
    "type": "text",
    "order": 1.5,
    "content": "",
    "version": 1,
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

---

#### PATCH `/api/v1/blocks/:block-id`
ブロックの内容を更新する。楽観的ロック対象。

**Request（テキスト / 見出しブロック）**
```json
{
  "content": "更新後のテキスト",
  "version": 2
}
```

**Response** `200`
```json
{
  "data": {
    "id": "b_aaa",
    "content": "更新後のテキスト",
    "version": 3,
    "updated_at": "2026-01-03T00:00:00Z"
  }
}
```

| エラー | 条件 |
|--------|------|
| `409 CONFLICT` | `version` が現在値と不一致 |

**409レスポンスボディ**
```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Block has been modified by another user.",
    "current": {
      "id": "b_aaa",
      "type": "text",
      "content": "他ユーザーの変更内容",
      "version": 3,
      "updated_at": "2026-01-03T00:00:00Z"
    }
  }
}
```

> **副作用（409時）：** サーバーは競合を検出した時点で、リクエスト送信者に対して `conflict` 通知を生成する。

---

#### PATCH `/api/v1/blocks/:block-id/order`
ブロックの並び順を変更する。

**Request**
```json
{
  "after_block_id": "b_bbb"
}
```
> `after_block_id: null` で先頭に移動。

**Response** `200`

リバランス未発生時（通常）:
```json
{
  "data": {
    "id": "b_aaa",
    "order": 0.5,
    "rebalanced": false
  }
}
```

リバランス発生時（float 精度が尽きた場合）:
```json
{
  "data": {
    "id": "b_aaa",
    "order": 2.0,
    "rebalanced": true,
    "all_orders": [
      { "id": "b_xxx", "order": 1.0 },
      { "id": "b_aaa", "order": 2.0 },
      { "id": "b_yyy", "order": 3.0 }
    ]
  }
}
```

> `rebalanced: true` の場合、クライアントは `all_orders` で全ブロックの order を更新する。

---

#### DELETE `/api/v1/blocks/:block-id`
ブロックを削除する。図ブロックの場合は DiagramNode / DiagramEdge / Annotation も CASCADE 削除される。

**Response** `204`

---

### 2-7. 図ノード

#### POST `/api/v1/blocks/:block-id/nodes`
図ブロックにノードを追加する。`Block.version` をインクリメントする。

**Request**
```json
{
  "type": "Screen",
  "label": "ログイン画面",
  "position_x": 200.0,
  "position_y": 150.0,
  "block_version": 2
}
```

**Response** `201`
```json
{
  "data": {
    "id": "n_bbb",
    "type": "Screen",
    "label": "ログイン画面",
    "position_x": 200.0,
    "position_y": 150.0,
    "block_version": 3,
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

| エラー | 条件 |
|--------|------|
| `409 CONFLICT` | `block_version` が現在値と不一致 |

---

#### PATCH `/api/v1/nodes/:node-id`
ノードの位置・ラベル・種別を更新する。図ブロック全体の `Block.version` をインクリメントする。

> すべてのフィールドは省略可能（`block_version` のみ必須）。指定したフィールドのみ更新される。

**Request**
```json
{
  "type": "Action",
  "label": "ログイン画面（更新）",
  "position_x": 250.0,
  "position_y": 150.0,
  "block_version": 2
}
```

**Response** `200`
```json
{
  "data": {
    "id": "n_bbb",
    "type": "Action",
    "label": "ログイン画面（更新）",
    "position_x": 250.0,
    "position_y": 150.0,
    "block_version": 3
  }
}
```

| エラー | 条件 |
|--------|------|
| `409 CONFLICT` | `block_version` が現在値と不一致 |

---

#### DELETE `/api/v1/nodes/:node-id`
ノードを削除する。接続するエッジも CASCADE 削除される。`Block.version` をインクリメントする。

**Query Parameters**
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `block_version` | int | 楽観的ロック用。現在の `Block.version` を指定する |

例: `DELETE /api/v1/nodes/n_bbb?block_version=3`

**Response** `204`

| エラー | 条件 |
|--------|------|
| `409 CONFLICT` | `block_version` が現在値と不一致 |

---

### 2-8. 図エッジ

#### POST `/api/v1/blocks/:block-id/edges`
図ブロックにエッジを追加する。`Block.version` をインクリメントする。

> **自己ループ・重複エッジは許可する。**
> - 自己ループ（`source_node_id === target_node_id`）を作成できる
> - 同一 source/target ペアへの重複エッジ（ラベルが異なる複数の接続線）を作成できる

**Request**
```json
{
  "source_node_id": "n_aaa",
  "target_node_id": "n_bbb",
  "label": null,
  "block_version": 3
}
```

**Response** `201`
```json
{
  "data": {
    "id": "e_bbb",
    "source_node_id": "n_aaa",
    "target_node_id": "n_bbb",
    "label": null,
    "block_version": 4,
    "created_at": "2026-01-01T00:00:00Z"
  }
}
```

| エラー | 条件 |
|--------|------|
| `409 CONFLICT` | `block_version` が現在値と不一致 |

---

#### PATCH `/api/v1/edges/:edge-id`
エッジのラベルを更新する。`Block.version` をインクリメントする。

**Request**
```json
{
  "label": "認証失敗",
  "block_version": 4
}
```

**Response** `200`
```json
{
  "data": { "id": "e_bbb", "label": "認証失敗", "block_version": 5 }
}
```

| エラー | 条件 |
|--------|------|
| `409 CONFLICT` | `block_version` が現在値と不一致 |

---

#### DELETE `/api/v1/edges/:edge-id`
エッジを削除する。`Block.version` をインクリメントする。

**Query Parameters**
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `block_version` | int | 楽観的ロック用。現在の `Block.version` を指定する |

例: `DELETE /api/v1/edges/e_bbb?block_version=5`

**Response** `204`

| エラー | 条件 |
|--------|------|
| `409 CONFLICT` | `block_version` が現在値と不一致 |

---

### 2-9. アノテーション

#### GET `/api/v1/organizations/:org-slug/pages/:page-slug/annotations`
ページ全体のアノテーション（コメントスレッド込み）を取得する。

**Query Parameters**
| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `resolved` | boolean | `true` で解決済みのみ、`false` で未解決のみ（省略で全件） |

**Response** `200`
```json
{
  "data": [
    {
      "id": "a_xxx",
      "block_id": "b_bbb",
      "node_id": "n_aaa",
      "block_offset": null,
      "created_by": { "id": "u_xxx", "name": "田中太郎" },
      "resolved_at": null,
      "created_at": "2026-01-01T00:00:00Z",
      "comments": [
        {
          "id": "c_xxx",
          "body": "この遷移は正しいですか？",
          "created_by": { "id": "u_xxx", "name": "田中太郎" },
          "created_at": "2026-01-01T00:00:00Z",
          "updated_at": "2026-01-01T00:00:00Z"
        }
      ]
    }
  ]
}
```

---

#### POST `/api/v1/blocks/:block-id/annotations`
アノテーションを作成する。最初のコメントを同時に作成する。

**Request（図ブロックのノード指定）**
```json
{
  "node_id": "n_aaa",
  "comment": "この遷移は正しいですか？"
}
```

**Request（テキストブロックの文字位置指定）**
```json
{
  "block_offset": 42,
  "comment": "この記述が曖昧です"
}
```

**Response** `201`
```json
{
  "data": {
    "id": "a_yyy",
    "block_id": "b_aaa",
    "node_id": null,
    "block_offset": 42,
    "resolved_at": null,
    "created_at": "2026-01-01T00:00:00Z",
    "comments": [
      {
        "id": "c_yyy",
        "body": "この記述が曖昧です",
        "created_by": { "id": "u_xxx", "name": "田中太郎" },
        "created_at": "2026-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

#### PATCH `/api/v1/annotations/:annotation-id`
アノテーションを解決済みまたは未解決に変更する。

**Request**
```json
{ "resolved": true }
```

**Response** `200`
```json
{
  "data": {
    "id": "a_xxx",
    "resolved_at": "2026-01-03T00:00:00Z"
  }
}
```

---

#### DELETE `/api/v1/annotations/:annotation-id`
アノテーションを削除する。配下の Comment も CASCADE 削除される。

**Response** `204`

---

### 2-10. コメント

#### POST `/api/v1/annotations/:annotation-id/comments`
アノテーションに返信コメントを追加する。メンションはリッチマークアップ形式（`@[表示名](user_id)`）でボディに埋め込む。サーバー側でパースして `Notification` を生成する。

**Request**
```json
{ "body": "@[山田花子](u_yyy) この画面遷移を確認してください" }
```

**Response** `201`
```json
{
  "data": {
    "id": "c_zzz",
    "annotation_id": "a_xxx",
    "body": "@[山田花子](u_yyy) この画面遷移を確認してください",
    "created_by": { "id": "u_xxx", "name": "田中太郎" },
    "created_at": "2026-01-03T00:00:00Z"
  }
}
```

> **副作用：** サーバー側でアノテーション作成者への `annotation_reply` 通知、メンション対象ユーザーへの `mention` 通知を生成する。

---

#### PATCH `/api/v1/comments/:comment-id`
コメントを編集する。自分が作成したコメントのみ可。

> **通知の再生成なし：** 編集でメンションを追加・変更しても `mention` 通知は再生成しない。
> 通知は初回投稿時のみ発生する。

**Request**
```json
{ "body": "修正後の文章" }
```

**Response** `200`

---

#### DELETE `/api/v1/comments/:comment-id`
コメントを削除する。自分が作成したコメントのみ可。

**Response** `204`

---

### 2-11. 通知

#### GET `/api/v1/notifications`
自分宛の通知一覧を取得する（最新50件）。

**Response** `200`
```json
{
  "data": [
    {
      "id": "notif_aaa",
      "type": "annotation_reply",
      "comment_id": "c_xxx",
      "page_id": null,
      "read_at": null,
      "created_at": "2026-01-03T00:00:00Z",
      "meta": {
        "actor": { "id": "u_yyy", "name": "山田花子" },
        "page": { "title": "ログイン機能 仕様", "url_slug": "login-spec-a1b2c3", "org_slug": "acme-inc" }
      }
    },
    {
      "id": "notif_bbb",
      "type": "conflict",
      "comment_id": null,
      "page_id": "p_xxx",
      "read_at": null,
      "created_at": "2026-01-03T01:00:00Z",
      "meta": {
        "page": { "title": "ログイン機能 仕様", "url_slug": "login-spec-a1b2c3", "org_slug": "acme-inc" }
      }
    }
  ],
  "unread_count": 2
}
```

---

#### PATCH `/api/v1/notifications/:notification-id/read`
指定通知を既読にする。

**Response** `200`
```json
{
  "data": { "id": "notif_aaa", "read_at": "2026-01-03T02:00:00Z" }
}
```

---

#### POST `/api/v1/notifications/read-all`
全通知を既読にする。

**Response** `200`
```json
{
  "data": { "updated_count": 2 }
}
```

---

## 3. Socket.io リアルタイムイベント

REST API の通知エンドポイントはポーリング用。実際のプッシュ配信は Socket.io で行う。

### 接続・ルーム

| タイミング | 操作 |
|-----------|------|
| ログイン後 | クライアントが `user:{user_id}` ルームに join する |
| ログアウト時 | ルームから leave する |

> 認証済みセッションを持つ接続のみ受け付ける。未認証の接続は切断する。

### サーバー → クライアント イベント

#### `notification:new`
新しい通知が生成されたときに、対象ユーザーの `user:{user_id}` ルームへ emit する。

**Payload**（`GET /api/v1/notifications` のレスポンスと同形式）
```json
{
  "id": "notif_aaa",
  "type": "annotation_reply",
  "comment_id": "c_xxx",
  "page_id": null,
  "read_at": null,
  "created_at": "2026-01-03T00:00:00Z",
  "meta": {
    "actor": { "id": "u_yyy", "name": "山田花子" },
    "page": { "title": "ログイン機能 仕様", "url_slug": "login-spec-a1b2c3", "org_slug": "acme-inc" }
  }
}
```

**発火タイミング**

| 通知 type | 発火条件 |
|-----------|---------|
| `annotation_reply` | `POST /annotations/:id/comments` 成功時（アノテーション作成者へ） |
| `mention` | `POST /annotations/:id/comments` 成功時（メンション対象ユーザーへ） |
| `conflict` | `PATCH /blocks/:id` または図ノード/エッジ操作で `409` 発生時（リクエスト送信者へ） |

---

## 4. 設計上の補足

### 楽観的ロック競合フロー（ページエディタ）

1. `GET /pages/:page-slug` でブロック一覧と各 `Block.version` を取得
2. ユーザーがブロックを編集 → `PATCH /blocks/:block-id` に `version` を含めて送信
3. サーバーが `409` を返した場合：
   - レスポンスの `current` フィールドで最新状態を取得済み
   - 競合解決ダイアログ（diff表示）をモーダルで表示
   - 「自分の変更を採用」→ 最新 `version` を使って再度 `PATCH`（強制上書き）
   - 「最新の内容を採用」→ ローカル変更を破棄してエディタを最新状態に更新

### 図ブロックの楽観的ロック粒度

- ノード・エッジの変更（`PATCH /nodes`, `POST /edges` 等）はすべて親 `Block.version` をインクリメントする
- リクエスト時に `block_version` を送り、不一致で `409` を返す
- 競合解決UIでは「ノードが追加された」「エッジが削除された」等の人間可読な差分テキストで表示する

### メンション形式

メンションはリッチマークアップ形式 `@[表示名](user_id)` で `body` に保持する。

- フロントエンドはメンション入力時に候補サジェストUIを表示し、選択時に `user_id` を埋め込む
- サーバーは正規表現 `/@\[.+?\]\(([^)]+)\)/g` で `user_id` を抽出し、組織メンバーと照合して `mention` 通知を生成する
- 表示名は body に含まれるが、通知・権限チェックは `user_id` を使用するため改名の影響を受けない

### 通知の `meta` フィールド

`Notification` テーブルには `comment_id` / `page_id` のみ保持し、通知一覧API応答時にJOINで `meta`（actor・page情報）を付加する。テーブルには非正規化しない。

### インデックス設計（主要なもの）

| テーブル | インデックス |
|---------|------------|
| `blocks` | `(page_id, order)` |
| `annotations` | `(block_id)` |
| `notifications` | `(user_id, read_at)` |
| `diagram_nodes` | `(block_id)` |
| `diagram_edges` | `(block_id)`, `(source_node_id)`, `(target_node_id)` |
