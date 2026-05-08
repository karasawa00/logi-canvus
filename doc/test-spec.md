# logi-canvus テスト仕様書

バージョン: 1.0  
作成日: 2026-05-07  
対象ブランチ: main

---

## 1. テスト方針

### 1-1. 目的

logi-canvus のビジネスルールが実装を通じて正しく保証されることを検証する。特に以下の3点を最重要とする。

1. **楽観的ロックの正確な動作** — `Page.version` / `Block.version` の競合検出・解決フローが仕様通りに機能すること
2. **フラット権限の貫徹** — 組織内全メンバーが同等の操作権限を持ち、除名操作が存在しないこと
3. **アノテーションのライフサイクル** — 作成・返信・Resolved・非表示のフローが正確に動作すること

### 1-2. テストスコープ

| レイヤー | テスト種別 | 対象 |
|---------|-----------|------|
| APIレイヤー | 統合テスト | Next.js Route Handlers（`/api/v1/*`）、Auth.js エンドポイント |
| ビジネスロジック | ユニットテスト | 楽観的ロック判定、url_slug 生成、block.order 計算、メンションパース |
| フロント状態管理 | ユニットテスト | Zustand ストア（図ブロック専用ストア）、TanStack Query キャッシュ更新 |
| E2E | E2Eテスト | 主要ユーザーフロー（代表5シナリオ） |

### 1-3. スコープ外

- リアルタイム同時編集（CRDT / OT）— 実装対象外
- Mermaid互換機能 — 実装対象外
- メール通知 — 実装対象外（Socket.io によるツール内通知のみ検証）
- OAuth認証 — 実装対象外

### 1-4. テストツール

| 用途 | ツール |
|------|--------|
| テストランナー | Vitest |
| HTTP テスト | Vitest + `fetch` モック または統合テスト用 test server |
| Socket.io テスト | `socket.io-client` + Vitest |
| E2E | Playwright（別途検討、本仕様書ではシナリオ定義のみ） |

### 1-5. カバレッジ目標

| 対象 | 目標 |
|------|------|
| 楽観的ロック関連ロジック | 分岐網羅 100% |
| APIルートハンドラ（ビジネスロジック部分） | 行カバレッジ 80% 以上 |
| ユニットテスト対象ユーティリティ | 行カバレッジ 90% 以上 |

### 1-6. テストデータ方針

- 統合テストはテスト専用 MySQL データベース（`logi_canvus_test`）を使用する
- 各テストケースは `beforeEach` でデータをリセットし、テスト間の依存を排除する
- ランダムデータを使用する場合は固定シードを設定し、再現性を保証する

---

## 2. 認証テスト

### 2-1. サインアップ

#### AUTH-001
- **テスト名**: 新規ユーザー登録と組織作成が成功する
- **前提条件**: 指定の email が未登録
- **入力**: `name="田中太郎"`, `email="tanaka@example.com"`, `password="Password1!"`, `organization.action="create"`, `organization.name="Acme Inc"`
- **期待結果**: HTTP 201、レスポンスに `user.id`, `user.email`, `organization.slug` が含まれる。DB に User・Organization・所属レコードが作成される
- **重要度**: HIGH

#### AUTH-002
- **テスト名**: 招待トークンを使って新規ユーザー登録と組織参加が成功する
- **前提条件**: 有効な招待トークン `inv_token_abc` が存在し、期限内（`expires_at` が現在時刻より未来）、未使用（`used_at` が null）
- **入力**: `name="山田花子"`, `email="yamada@example.com"`, `password="Password1!"`, `organization.action="join"`, `organization.invite_token="inv_token_abc"`
- **期待結果**: HTTP 201、User が組織に所属する。招待レコードの `used_at` が現在時刻で更新される
- **重要度**: HIGH

#### AUTH-003
- **テスト名**: email が重複している場合は登録に失敗する
- **前提条件**: `tanaka@example.com` が既に登録済み
- **入力**: `email="tanaka@example.com"`, その他任意
- **期待結果**: HTTP 400、`error.code = "VALIDATION_ERROR"`
- **重要度**: HIGH

#### AUTH-004
- **テスト名**: パスワードが空文字の場合は登録に失敗する
- **前提条件**: なし
- **入力**: `password=""`（空文字）
- **期待結果**: HTTP 400、`error.code = "VALIDATION_ERROR"`
- **重要度**: MEDIUM

#### AUTH-005
- **テスト名**: 無効な招待トークンで組織参加しようとした場合は登録に失敗する
- **前提条件**: `invalid_token` が存在しない
- **入力**: `organization.action="join"`, `organization.invite_token="invalid_token"`
- **期待結果**: HTTP 400 または 404、`error.code` が `VALIDATION_ERROR` または `NOT_FOUND`
- **重要度**: HIGH

#### AUTH-006
- **テスト名**: 期限切れ招待トークンで組織参加しようとした場合は登録に失敗する
- **前提条件**: 招待トークンが存在するが `expires_at` が現在時刻より過去
- **入力**: `organization.action="join"`, 期限切れ `invite_token`
- **期待結果**: HTTP 400 または 404、期限切れを示すエラー
- **重要度**: HIGH

#### AUTH-007
- **テスト名**: 使用済み招待トークンで組織参加しようとした場合は登録に失敗する
- **前提条件**: 招待トークンが存在し `used_at` が null でない
- **入力**: `organization.action="join"`, 使用済み `invite_token`
- **期待結果**: HTTP 400 または 404
- **重要度**: HIGH

### 2-2. ログイン・ログアウト

#### AUTH-008
- **テスト名**: 正しい認証情報でログインするとセッション Cookie が発行される
- **前提条件**: `tanaka@example.com` / `Password1!` で登録済みのユーザーが存在する
- **入力**: Auth.js `POST /api/auth/signin` に `email`, `password`
- **期待結果**: HTTP 200、`HttpOnly` セッション Cookie が Set-Cookie ヘッダーに含まれる。`GET /api/auth/session` でユーザー情報が返る
- **重要度**: HIGH

#### AUTH-009
- **テスト名**: 誤ったパスワードでログインするとエラーになる
- **前提条件**: `tanaka@example.com` が登録済み
- **入力**: `email="tanaka@example.com"`, `password="wrongpass"`
- **期待結果**: ログイン失敗を示すレスポンス（Auth.js の挙動に準拠）、セッション Cookie は発行されない
- **重要度**: HIGH

#### AUTH-010
- **テスト名**: 存在しない email でログインするとエラーになる
- **前提条件**: `notexist@example.com` が未登録
- **入力**: `email="notexist@example.com"`, `password="Password1!"`
- **期待結果**: ログイン失敗、セッション Cookie は発行されない
- **重要度**: HIGH

#### AUTH-011
- **テスト名**: ログアウト後はセッション Cookie が無効になる
- **前提条件**: ログイン済みセッションが存在する
- **入力**: `POST /api/auth/signout`
- **期待結果**: Cookie が破棄または期限切れになる。その後の認証必須 API 呼び出しで 401 が返る
- **重要度**: HIGH

### 2-3. 未認証アクセス

#### AUTH-012
- **テスト名**: 未認証の場合、認証必須 API エンドポイントは 401 を返す
- **前提条件**: セッション Cookie なし
- **入力**: `GET /api/v1/organizations/acme-inc`
- **期待結果**: HTTP 401、`error.code = "UNAUTHORIZED"`
- **重要度**: HIGH

#### AUTH-013
- **テスト名**: 未認証の場合、ページ・ブロック系エンドポイントはすべて 401 を返す
- **前提条件**: セッション Cookie なし
- **入力**: `GET /api/v1/organizations/acme-inc/pages`, `POST /api/v1/pages/p_xxx/blocks`, `PATCH /api/v1/blocks/b_xxx` を各々呼び出す
- **期待結果**: すべてのリクエストで HTTP 401
- **重要度**: HIGH

---

## 3. 組織・メンバーテスト

### 3-1. 組織情報

#### ORG-001
- **テスト名**: 組織メンバーが組織情報を取得できる
- **前提条件**: ユーザーが組織 `acme-inc` のメンバー
- **入力**: `GET /api/v1/organizations/acme-inc`
- **期待結果**: HTTP 200、`data.name`, `data.slug` が正しく返る
- **重要度**: HIGH

#### ORG-002
- **テスト名**: 他組織のスラグで組織情報を取得しようとすると 403 または 404 が返る
- **前提条件**: ユーザーは `acme-inc` のメンバーだが `other-org` には所属していない
- **入力**: `GET /api/v1/organizations/other-org`
- **期待結果**: HTTP 403 または 404
- **重要度**: HIGH

#### ORG-003
- **テスト名**: 組織メンバーが組織名を更新できる
- **前提条件**: ユーザーが組織のメンバー
- **入力**: `PATCH /api/v1/organizations/acme-inc` に `name="Acme Corporation"`
- **期待結果**: HTTP 200、`data.name = "Acme Corporation"`、DB に反映されている
- **重要度**: MEDIUM

### 3-2. メンバー一覧・権限

#### ORG-004
- **テスト名**: 組織メンバーがメンバー一覧を取得できる
- **前提条件**: 組織に田中・山田の2名が所属
- **入力**: `GET /api/v1/organizations/acme-inc/members`
- **期待結果**: HTTP 200、`data` に2名のユーザー情報（`id`, `name`, `email`）が含まれる
- **重要度**: MEDIUM

#### ORG-005
- **テスト名**: フラット権限: 任意のメンバーが別のメンバーを除名する API は存在しない（仕様確認）
- **前提条件**: 組織に複数メンバーが存在する
- **入力**: 他メンバーを対象とした DELETE メンバー系エンドポイントへのリクエスト（`DELETE /api/v1/organizations/acme-inc/members/:other-user-id`）
- **期待結果**: HTTP 404（エンドポイントが存在しない）または HTTP 403（権限なし）。404 が正しい実装（エンドポイント自体を作らない）
- **重要度**: HIGH

### 3-3. 組織脱退

#### ORG-006
- **テスト名**: メンバーが自分自身のみ組織から脱退できる
- **前提条件**: ユーザー（`u_tanaka`）が組織のメンバー
- **入力**: `DELETE /api/v1/organizations/acme-inc/members/me`（`u_tanaka` のセッションで実行）
- **期待結果**: HTTP 204、DB から `u_tanaka` の組織所属レコードが削除される
- **重要度**: HIGH

#### ORG-007
- **テスト名**: 脱退後も自分が作成したページ・アノテーション・コメントは残存する
- **前提条件**: `u_tanaka` がページ・アノテーション・コメントを作成済み
- **入力**: `DELETE /api/v1/organizations/acme-inc/members/me`
- **期待結果**: 脱退後、Page の `created_by`, Annotation の `created_by`, Comment の `created_by` が `u_tanaka` のままで残存している
- **重要度**: HIGH

#### ORG-008
- **テスト名**: 脱退後は認証必須 API にアクセスできない
- **前提条件**: `u_tanaka` が脱退済み
- **入力**: `u_tanaka` のセッションで `GET /api/v1/organizations/acme-inc`
- **期待結果**: HTTP 403 または 401（組織への所属がないため）
- **重要度**: MEDIUM

#### ORG-009
- **テスト名**: 組織内の最終メンバーが脱退しても組織レコードは残存する
- **前提条件**: 組織 `acme-inc` のメンバーが `u_tanaka` のみ（1名）
- **入力**: `DELETE /api/v1/organizations/acme-inc/members/me`（`u_tanaka` のセッション）
- **期待結果**: HTTP 204。`u_tanaka` の `org_id` が null になる。Organization レコード（`acme-inc`）は DB に残存している
- **重要度**: MEDIUM

---

## 4. 招待テスト

#### INV-001
- **テスト名**: 組織メンバーが招待を発行できる
- **前提条件**: 送信者が組織のメンバー、`newmember@example.com` が未参加
- **入力**: `POST /api/v1/organizations/acme-inc/invitations` に `email="newmember@example.com"`
- **期待結果**: HTTP 201、`data.token` が返る、`data.expires_at` が存在する、DB に Invitation レコードが作成される
- **重要度**: HIGH

#### INV-002
- **テスト名**: 有効なトークンで招待情報を取得できる（組織名表示用）
- **前提条件**: 有効（未使用・期限内）な招待トークン `abc123` が存在する
- **入力**: `GET /api/v1/invitations/abc123`
- **期待結果**: HTTP 200、`data.organization.name`, `data.email` が正しく返る
- **重要度**: HIGH

#### INV-003
- **テスト名**: 存在しないトークンで招待情報を取得しようとすると 404 が返る
- **前提条件**: `no_such_token` が DB に存在しない
- **入力**: `GET /api/v1/invitations/no_such_token`
- **期待結果**: HTTP 404、`error.code = "NOT_FOUND"`
- **重要度**: HIGH

#### INV-004
- **テスト名**: 期限切れトークンで招待情報を取得しようとすると 404 が返る
- **前提条件**: `expires_at` が現在時刻より過去の招待トークン `expired_token` が存在する
- **入力**: `GET /api/v1/invitations/expired_token`
- **期待結果**: HTTP 404
- **重要度**: HIGH

#### INV-005
- **テスト名**: ログイン済みユーザーが有効なトークンで招待を受け入れると組織に参加できる
- **前提条件**: `u_yamada` がログイン済み、有効な招待トークン `abc123` が存在し `yamada@example.com` 宛
- **入力**: `POST /api/v1/invitations/abc123/accept`（`u_yamada` のセッションで実行）
- **期待結果**: HTTP 200、`data.organization.slug` が返る。DB で `u_yamada` が組織に所属している。招待レコードの `used_at` が更新される
- **重要度**: HIGH

#### INV-006
- **テスト名**: 招待受け入れ後は同じトークンを再利用できない
- **前提条件**: トークン `abc123` が既に使用済み（`used_at` が null でない）
- **入力**: `POST /api/v1/invitations/abc123/accept`
- **期待結果**: HTTP 404 または 400
- **重要度**: HIGH

#### INV-007
- **テスト名**: 既に組織に所属しているユーザーが招待を受け入れようとした場合のふるまい
- **前提条件**: `u_tanaka` が既に組織のメンバー、有効な招待トークンが存在する
- **入力**: `POST /api/v1/invitations/:token/accept`（`u_tanaka` のセッション）
- **期待結果**: HTTP 400 または 200（冪等な参加）。二重登録は発生しない
- **重要度**: MEDIUM

#### INV-008
- **テスト名**: 招待の宛先 email と異なるユーザーが受け入れを試みると拒否される
- **前提条件**: 招待トークン `abc123` が `yamada@example.com` 宛。ログインユーザーは `u_tanaka`（`tanaka@example.com`）
- **入力**: `u_tanaka` のセッションで `POST /api/v1/invitations/abc123/accept`
- **期待結果**: HTTP 403、`error.code = "FORBIDDEN"`。招待の `used_at` は更新されない
- **重要度**: HIGH

---

## 5. ページ CRUD テスト

#### PAGE-001
- **テスト名**: ページを新規作成すると url_slug がサーバーで自動生成される
- **前提条件**: ユーザーが組織のメンバー
- **入力**: `POST /api/v1/organizations/acme-inc/pages` に `title="ログイン機能 仕様"`, `folder_id=null`
- **期待結果**: HTTP 201、`data.url_slug` が存在し空でない。`data.version = 1`。DB にページが作成されている
- **重要度**: HIGH

#### PAGE-002
- **テスト名**: url_slug はタイトルのURLセーフ変換 + ランダムサフィックスで生成される
- **前提条件**: なし
- **入力**: `title="ログイン機能 仕様"` でページを2回作成する
- **期待結果**: 2回生成された `url_slug` が互いに異なること（ランダムサフィックスにより一意性が担保される）
- **重要度**: MEDIUM

#### PAGE-003
- **テスト名**: フォルダを指定してページを作成できる
- **前提条件**: フォルダ `f_aaa` が存在する
- **入力**: `POST /api/v1/organizations/acme-inc/pages` に `folder_id="f_aaa"`
- **期待結果**: HTTP 201、`data.folder_id = "f_aaa"`
- **重要度**: MEDIUM

#### PAGE-004
- **テスト名**: ページ一覧を取得できる
- **前提条件**: 組織に3件のページが存在する
- **入力**: `GET /api/v1/organizations/acme-inc/pages`
- **期待結果**: HTTP 200、`data` に3件のページが含まれる。各ページに `id`, `title`, `url_slug`, `created_by` が含まれる
- **重要度**: HIGH

#### PAGE-005
- **テスト名**: recent=true の場合、最新10件以内のページが更新日時降順で返る
- **前提条件**: 組織に15件のページが存在する
- **入力**: `GET /api/v1/organizations/acme-inc/pages?recent=true`
- **期待結果**: HTTP 200、`data` の件数が 10 以下。`updated_at` 降順になっている
- **重要度**: MEDIUM

#### PAGE-006
- **テスト名**: ページ詳細をブロック・ノード・エッジ込みで取得できる
- **前提条件**: ページに heading ブロックと diagram ブロック（ノード・エッジあり）が存在する
- **入力**: `GET /api/v1/organizations/acme-inc/pages/login-spec-a1b2c3`
- **期待結果**: HTTP 200、`data.blocks` に各ブロックが含まれる。diagram ブロックの `nodes`, `edges` が正しく含まれる
- **重要度**: HIGH

#### PAGE-007
- **テスト名**: ページタイトルを更新できる（楽観的ロック: バージョン一致）
- **前提条件**: ページの現在 `version = 3`
- **入力**: `PATCH /api/v1/organizations/acme-inc/pages/login-spec-a1b2c3` に `title="新タイトル"`, `version=3`
- **期待結果**: HTTP 200、`data.title = "新タイトル"`, `data.version = 4`
- **重要度**: HIGH

#### PAGE-008
- **テスト名**: バージョン不一致の場合はページ更新が 409 で失敗する
- **前提条件**: ページの現在 `version = 3`
- **入力**: `PATCH` に `version=2`（古いバージョン）
- **期待結果**: HTTP 409、`error.code = "CONFLICT"`, レスポンスに `error.current` として最新ページ情報が含まれる
- **重要度**: HIGH

#### PAGE-009
- **テスト名**: ページを削除すると配下のブロック・アノテーション・コメントも削除される
- **前提条件**: ページにブロック・アノテーション・コメントが存在する
- **入力**: `DELETE /api/v1/organizations/acme-inc/pages/login-spec-a1b2c3`
- **期待結果**: HTTP 204。DB からページ・ブロック・アノテーション・コメントが削除される（CASCADE 確認）
- **重要度**: HIGH

#### PAGE-010
- **テスト名**: 他組織のページにはアクセスできない
- **前提条件**: `u_tanaka` は `acme-inc` のメンバーだが、`other-org` には所属しない。`other-org` にページ `other-page` が存在する
- **入力**: `GET /api/v1/organizations/other-org/pages/other-page`（`u_tanaka` のセッション）
- **期待結果**: HTTP 403 または 404
- **重要度**: HIGH

---

## 6. ブロックエディタテスト

#### BLK-001
- **テスト名**: テキストブロックを末尾に追加できる
- **前提条件**: ページに1件のブロックが存在する（`order=1.0`）
- **入力**: `POST /api/v1/pages/p_xxx/blocks` に `type="text"`, `after_block_id` を省略（または末尾指定）
- **期待結果**: HTTP 201、`data.type = "text"`, `data.order > 1.0`, `data.version = 1`
- **重要度**: HIGH

#### BLK-002
- **テスト名**: after_block_id を指定してブロックを中間位置に挿入できる
- **前提条件**: ページにブロック A（`order=1.0`）と B（`order=2.0`）が存在する
- **入力**: `POST /api/v1/pages/p_xxx/blocks` に `after_block_id="b_A"`
- **期待結果**: HTTP 201、新ブロックの `order` が `1.0 < order < 2.0` の範囲内（例: `1.5`）
- **重要度**: HIGH

#### BLK-003
- **テスト名**: heading ブロックと diagram ブロックが追加できる
- **前提条件**: ページが存在する
- **入力**: `type="heading"` でブロック追加、次に `type="diagram"` でブロック追加
- **期待結果**: 各々 HTTP 201、`data.type` が指定の値と一致する
- **重要度**: MEDIUM

#### BLK-004
- **テスト名**: テキストブロックの内容を更新できる（楽観的ロック: バージョン一致）
- **前提条件**: ブロックの現在 `version = 2`
- **入力**: `PATCH /api/v1/blocks/b_aaa` に `content="更新後のテキスト"`, `version=2`
- **期待結果**: HTTP 200、`data.content = "更新後のテキスト"`, `data.version = 3`
- **重要度**: HIGH

#### BLK-005
- **テスト名**: バージョン不一致の場合はブロック更新が 409 で失敗する
- **前提条件**: ブロックの現在 `version = 2`
- **入力**: `PATCH` に `version=1`（古いバージョン）
- **期待結果**: HTTP 409、`error.code = "CONFLICT"`, `error.current` に最新ブロック情報が含まれる（`content`, `version`）
- **重要度**: HIGH

#### BLK-006
- **テスト名**: 409 発生時にサーバーが conflict 通知を生成する
- **前提条件**: `u_tanaka` がブロック更新を試みた際に 409 が発生する状況（他ユーザーが先にバージョンを上げた）
- **入力**: `PATCH /api/v1/blocks/b_aaa` に古い `version`
- **期待結果**: HTTP 409 の応答と同時に、DB に `u_tanaka` 宛の `type="conflict"` Notification が作成される
- **重要度**: HIGH

#### BLK-007
- **テスト名**: ブロックの並び替えができる
- **前提条件**: ブロック A（`order=1.0`）、B（`order=2.0`）、C（`order=3.0`）が存在する
- **入力**: `PATCH /api/v1/blocks/b_C/order` に `after_block_id="b_A"`
- **期待結果**: HTTP 200、`data.order` が `1.0 < order < 2.0` の範囲内。`data.rebalanced = false`
- **重要度**: HIGH

#### BLK-008
- **テスト名**: 先頭に移動するとき after_block_id: null を指定できる
- **前提条件**: ブロック A（`order=1.0`）、B（`order=2.0`）が存在する
- **入力**: `PATCH /api/v1/blocks/b_B/order` に `after_block_id=null`
- **期待結果**: HTTP 200、`data.order < 1.0`
- **重要度**: MEDIUM

#### BLK-009
- **テスト名**: float 精度が尽きた場合にリバランスが発生する
- **前提条件**: ブロックの `order` 値が IEEE 754 float の精度限界に達している状態（テスト用に強制的に境界値を設定する）
- **入力**: `PATCH /api/v1/blocks/:block-id/order` でリバランスが必要な位置への移動
- **期待結果**: HTTP 200、`data.rebalanced = true`, `data.all_orders` に全ブロックの新しい整数オーダー値が含まれる
- **重要度**: MEDIUM

#### BLK-010
- **テスト名**: ブロックを削除できる
- **前提条件**: ブロック `b_aaa` が存在する
- **入力**: `DELETE /api/v1/blocks/b_aaa`
- **期待結果**: HTTP 204、DB からブロックが削除される
- **重要度**: HIGH

#### BLK-011
- **テスト名**: diagram ブロックを削除すると DiagramNode / DiagramEdge / Annotation も CASCADE 削除される
- **前提条件**: diagram ブロックにノード・エッジ・アノテーションが存在する
- **入力**: `DELETE /api/v1/blocks/b_diagram`
- **期待結果**: HTTP 204、DB からブロック・ノード・エッジ・アノテーションがすべて削除される
- **重要度**: HIGH

---

## 7. 図ブロックテスト

### 7-1. ノード CRUD

#### DIAG-001
- **テスト名**: Screen ノードを追加できる
- **前提条件**: diagram ブロックの現在 `version = 2`
- **入力**: `POST /api/v1/blocks/b_diagram/nodes` に `type="Screen"`, `label="ログイン画面"`, `position_x=200.0`, `position_y=150.0`, `block_version=2`
- **期待結果**: HTTP 201、`data.type = "Screen"`, `data.id` が存在する, `data.block_version = 3`（インクリメントされている）
- **重要度**: HIGH

#### DIAG-002
- **テスト名**: 全ノード種別を追加できる（Action / Branch / Start / End / External）
- **前提条件**: diagram ブロックが存在する
- **入力**: `type` に `"Action"`, `"Branch"`, `"Start"`, `"End"`, `"External"` をそれぞれ指定して POST
- **期待結果**: 各々 HTTP 201、`data.type` が指定の値と一致する
- **重要度**: HIGH

#### DIAG-003
- **テスト名**: block_version 不一致でノード追加が 409 で失敗する
- **前提条件**: diagram ブロックの現在 `version = 3`
- **入力**: `POST /api/v1/blocks/b_diagram/nodes` に `block_version=2`（古いバージョン）
- **期待結果**: HTTP 409、`error.code = "CONFLICT"`
- **重要度**: HIGH

#### DIAG-004
- **テスト名**: ノードの位置とラベルを更新できる
- **前提条件**: ノード `n_aaa` が存在し、親ブロックの `version = 3`
- **入力**: `PATCH /api/v1/nodes/n_aaa` に `label="更新画面"`, `position_x=300.0`, `position_y=200.0`, `block_version=3`
- **期待結果**: HTTP 200、`data.label = "更新画面"`, `data.position_x = 300.0`, `data.block_version = 4`
- **重要度**: HIGH

#### DIAG-005
- **テスト名**: block_version 不一致でノード更新が 409 で失敗する
- **前提条件**: 親ブロックの現在 `version = 3`
- **入力**: `PATCH /api/v1/nodes/n_aaa` に `block_version=2`
- **期待結果**: HTTP 409、`error.code = "CONFLICT"`
- **重要度**: HIGH

#### DIAG-006
- **テスト名**: ノードを削除できる
- **前提条件**: ノード `n_aaa` が存在し、親ブロックの `version = 3`
- **入力**: `DELETE /api/v1/nodes/n_aaa?block_version=3`
- **期待結果**: HTTP 204、DB からノードが削除される。`Block.version` が 4 にインクリメントされる
- **重要度**: HIGH

#### DIAG-007
- **テスト名**: ノード削除時に接続するエッジも CASCADE 削除される
- **前提条件**: ノード `n_aaa` にエッジ（`n_aaa` が source）が接続されている
- **入力**: `DELETE /api/v1/nodes/n_aaa?block_version=3`
- **期待結果**: HTTP 204、接続していたエッジも DB から削除される
- **重要度**: HIGH

#### DIAG-008
- **テスト名**: block_version 不一致でノード削除が 409 で失敗する
- **前提条件**: 親ブロックの現在 `version = 3`
- **入力**: `DELETE /api/v1/nodes/n_aaa?block_version=2`
- **期待結果**: HTTP 409、`error.code = "CONFLICT"`
- **重要度**: HIGH

### 7-2. エッジ CRUD

#### DIAG-009
- **テスト名**: エッジを追加できる
- **前提条件**: ノード `n_aaa`（Start）と `n_bbb`（Screen）が存在し、親ブロックの `version = 3`
- **入力**: `POST /api/v1/blocks/b_diagram/edges` に `source_node_id="n_aaa"`, `target_node_id="n_bbb"`, `label=null`, `block_version=3`
- **期待結果**: HTTP 201、`data.source_node_id = "n_aaa"`, `data.target_node_id = "n_bbb"`, `data.block_version = 4`
- **重要度**: HIGH

#### DIAG-010
- **テスト名**: エッジのラベルを更新できる
- **前提条件**: エッジ `e_aaa` が存在し、親ブロックの `version = 4`
- **入力**: `PATCH /api/v1/edges/e_aaa` に `label="認証失敗"`, `block_version=4`
- **期待結果**: HTTP 200、`data.label = "認証失敗"`, `data.block_version = 5`
- **重要度**: MEDIUM

#### DIAG-011
- **テスト名**: エッジを削除できる
- **前提条件**: エッジ `e_aaa` が存在し、親ブロックの `version = 5`
- **入力**: `DELETE /api/v1/edges/e_aaa?block_version=5`
- **期待結果**: HTTP 204、DB からエッジが削除される。`Block.version` が 6 にインクリメントされる
- **重要度**: HIGH

#### DIAG-012
- **テスト名**: block_version 不一致でエッジ追加が 409 で失敗する
- **前提条件**: 親ブロックの現在 `version = 4`
- **入力**: `POST /api/v1/blocks/b_diagram/edges` に `block_version=3`
- **期待結果**: HTTP 409、`error.code = "CONFLICT"`
- **重要度**: HIGH

#### DIAG-013
- **テスト名**: 同一ブロックに存在しないノードを接続先に指定するとエラーになる
- **前提条件**: ノード `n_other` が別の diagram ブロックに属している
- **入力**: `POST /api/v1/blocks/b_diagram/edges` に `source_node_id="n_aaa"`, `target_node_id="n_other"`
- **期待結果**: HTTP 400 または 404（外部キー違反または不正な参照）
- **重要度**: MEDIUM

### 7-3. ノード種別変更

#### DIAG-014
- **テスト名**: ノードの type（種別）を変更できる
- **前提条件**: ノード `n_aaa` が `type="Screen"` で存在し、親ブロックの `version = 3`
- **入力**: `PATCH /api/v1/nodes/n_aaa` に `type="Action"`, `block_version=3`
- **期待結果**: HTTP 200、`data.type = "Action"`、`data.block_version = 4`。DB の `diagram_nodes` テーブルで `type` が `Action` に更新されている
- **重要度**: HIGH

#### DIAG-015
- **テスト名**: ノード種別変更後もそのノードに紐づくアノテーションは残存する
- **前提条件**: ノード `n_aaa`（`type="Screen"`）にアノテーション `a_xxx` が紐づいている
- **入力**: `PATCH /api/v1/nodes/n_aaa` に `type="Branch"`, `block_version=3`
- **期待結果**: HTTP 200。アノテーション `a_xxx` の `node_id = "n_aaa"` は変わらず残存している
- **重要度**: HIGH

#### DIAG-016
- **テスト名**: ノード種別変更後もそのノードに接続するエッジは残存する
- **前提条件**: ノード `n_aaa`（`type="Screen"`）を source とするエッジ `e_aaa` が存在する
- **入力**: `PATCH /api/v1/nodes/n_aaa` に `type="Action"`, `block_version=3`
- **期待結果**: HTTP 200。エッジ `e_aaa` の `source_node_id = "n_aaa"` は変わらず残存している
- **重要度**: MEDIUM

### 7-4. 自己ループ・重複エッジ

#### DIAG-017
- **テスト名**: 自己ループエッジ（source_node_id と target_node_id が同一）を作成できる
- **前提条件**: ノード `n_aaa` が存在し、親ブロックの `version = 3`
- **入力**: `POST /api/v1/blocks/b_diagram/edges` に `source_node_id="n_aaa"`, `target_node_id="n_aaa"`, `block_version=3`
- **期待結果**: HTTP 201。`data.source_node_id = "n_aaa"`, `data.target_node_id = "n_aaa"`
- **重要度**: MEDIUM

#### DIAG-018
- **テスト名**: 同一 source/target ペアへの重複エッジ（ラベルが異なる）を作成できる
- **前提条件**: ノード `n_aaa` → `n_bbb` のエッジ `e_aaa`（`label="成功"`）が存在し、親ブロックの `version = 4`
- **入力**: `POST /api/v1/blocks/b_diagram/edges` に `source_node_id="n_aaa"`, `target_node_id="n_bbb"`, `label="失敗"`, `block_version=4`
- **期待結果**: HTTP 201。同一ペアへの2本目のエッジが作成され、DB に2件のエッジが存在する
- **重要度**: MEDIUM

---

## 8. 楽観的ロックテスト

#### OPT-001
- **テスト名**: Page.version の競合が正確に検出される
- **前提条件**: ページの現在 `version = 5`
- **入力**: `PATCH /api/v1/.../pages/:page-slug` に `version=4`（1つ古い）
- **期待結果**: HTTP 409、`error.code = "CONFLICT"`, `error.current.version = 5`
- **重要度**: HIGH

#### OPT-002
- **テスト名**: Page の 409 レスポンスに最新のページデータ（current）が含まれる
- **前提条件**: ページ競合が発生する状態
- **入力**: 古い `version` で PATCH
- **期待結果**: HTTP 409 レスポンスの `error.current` に `id`, `title`, `version`, `updated_at` が含まれる
- **重要度**: HIGH

#### OPT-003
- **テスト名**: Block.version の競合が正確に検出される
- **前提条件**: ブロックの現在 `version = 3`
- **入力**: `PATCH /api/v1/blocks/:block-id` に `version=2`
- **期待結果**: HTTP 409、`error.code = "CONFLICT"`, `error.current.version = 3`
- **重要度**: HIGH

#### OPT-004
- **テスト名**: Block の 409 レスポンスに最新のブロックデータ（current）が含まれる
- **前提条件**: ブロック競合が発生する状態
- **入力**: 古い `version` で PATCH
- **期待結果**: HTTP 409 レスポンスの `error.current` に `id`, `type`, `content`, `version`, `updated_at` が含まれる
- **重要度**: HIGH

#### OPT-005
- **テスト名**: 競合解決: 自分の変更を採用する場合は最新 version で強制上書きできる
- **前提条件**: ブロックの現在 `version = 3`（別ユーザーが更新済み）
- **入力**: 第1リクエスト: `version=2` で 409 を受け取る。第2リクエスト: `version=3`（最新）で再度 PATCH
- **期待結果**: 第2リクエストが HTTP 200、`data.version = 4`（上書き成功）
- **重要度**: HIGH

#### OPT-006
- **テスト名**: 図ノード追加（POST /nodes）の block_version 競合が検出される
- **前提条件**: 親ブロックの現在 `version = 5`
- **入力**: `POST /api/v1/blocks/:block-id/nodes` に `block_version=4`
- **期待結果**: HTTP 409
- **重要度**: HIGH

#### OPT-007
- **テスト名**: 図エッジ削除（DELETE /edges）の block_version 競合が検出される
- **前提条件**: 親ブロックの現在 `version = 5`
- **入力**: `DELETE /api/v1/edges/:edge-id?block_version=4`
- **期待結果**: HTTP 409
- **重要度**: HIGH

#### OPT-008
- **テスト名**: 同一ブロックへの同時更新で片方が 409 になる（競合シミュレーション）
- **前提条件**: ブロックの `version = 1`、2つのセッション（`u_tanaka`, `u_yamada`）が同じ `version=1` を取得している
- **入力**: `u_tanaka` が `version=1` で PATCH（成功し `version=2` になる）、その後 `u_yamada` が `version=1` で PATCH
- **期待結果**: `u_tanaka` のリクエストは 200、`u_yamada` のリクエストは 409。`u_yamada` へ conflict 通知が生成される
- **重要度**: HIGH

#### OPT-009
- **テスト名**: Page.version と Block.version は独立して管理される
- **前提条件**: ページ `version=3`、ブロックA `version=1`、ブロックB `version=2`
- **入力**: ブロックA の内容を更新する（`PATCH /api/v1/blocks/b_A` に `version=1`）
- **期待結果**: HTTP 200、ブロックA の `version` が 2 になる。ページの `version` は変更されない（3 のまま）。ブロックB の `version` も変更されない（2 のまま）
- **重要度**: HIGH

---

## 9. アノテーション・コメントテスト

### 9-1. アノテーション作成

#### ANN-001
- **テスト名**: 図ブロックのノードにアノテーション（ピン）を設置できる
- **前提条件**: diagram ブロック `b_diagram` にノード `n_aaa` が存在する
- **入力**: `POST /api/v1/blocks/b_diagram/annotations` に `node_id="n_aaa"`, `comment="この遷移は正しいですか？"`
- **期待結果**: HTTP 201、`data.node_id = "n_aaa"`, `data.block_offset = null`, `data.resolved_at = null`, `data.comments` に初回コメントが含まれる
- **重要度**: HIGH

#### ANN-002
- **テスト名**: テキストブロックの文字オフセット位置にアノテーションを設置できる
- **前提条件**: テキストブロック `b_text` が存在する
- **入力**: `POST /api/v1/blocks/b_text/annotations` に `block_offset=42`, `comment="この記述が曖昧です"`
- **期待結果**: HTTP 201、`data.node_id = null`, `data.block_offset = 42`, `data.comments` に初回コメントが含まれる
- **重要度**: HIGH

#### ANN-003
- **テスト名**: アノテーション作成時に node_id と block_offset の両方を省略した場合はエラーになる
- **前提条件**: なし
- **入力**: `POST /api/v1/blocks/b_text/annotations` に `node_id` も `block_offset` も指定なし
- **期待結果**: HTTP 400、`error.code = "VALIDATION_ERROR"`
- **重要度**: MEDIUM

### 9-2. アノテーション一覧取得

#### ANN-004
- **テスト名**: ページ全体のアノテーション一覧をコメントスレッド込みで取得できる
- **前提条件**: ページに未解決アノテーション2件・解決済みアノテーション1件が存在する
- **入力**: `GET /api/v1/organizations/acme-inc/pages/login-spec-a1b2c3/annotations`（クエリパラメータなし）
- **期待結果**: HTTP 200、`data` に3件のアノテーションが含まれる。各アノテーションの `comments` 配列が含まれる
- **重要度**: HIGH

#### ANN-005
- **テスト名**: resolved=false で未解決アノテーションのみ取得できる
- **前提条件**: 未解決2件・解決済み1件が存在する
- **入力**: `GET .../annotations?resolved=false`
- **期待結果**: HTTP 200、`data` に2件のみ含まれる（`resolved_at = null` のもの）
- **重要度**: HIGH

#### ANN-006
- **テスト名**: resolved=true で解決済みアノテーションのみ取得できる
- **前提条件**: 未解決2件・解決済み1件が存在する
- **入力**: `GET .../annotations?resolved=true`
- **期待結果**: HTTP 200、`data` に1件のみ含まれる（`resolved_at` が null でないもの）
- **重要度**: HIGH

### 9-3. アノテーションの Resolved

#### ANN-007
- **テスト名**: アノテーションを Resolved（解決済み）に変更できる
- **前提条件**: アノテーション `a_xxx` の `resolved_at = null`
- **入力**: `PATCH /api/v1/annotations/a_xxx` に `resolved=true`
- **期待結果**: HTTP 200、`data.resolved_at` が現在時刻（null でない）になる
- **重要度**: HIGH

#### ANN-008
- **テスト名**: Resolved アノテーションを未解決に戻せる
- **前提条件**: アノテーション `a_xxx` の `resolved_at` が null でない
- **入力**: `PATCH /api/v1/annotations/a_xxx` に `resolved=false`
- **期待結果**: HTTP 200、`data.resolved_at = null`
- **重要度**: MEDIUM

#### ANN-009
- **テスト名**: Resolved になったアノテーションはデフォルト非表示（resolved=false フィルタで除外される）
- **前提条件**: アノテーション `a_xxx` を Resolved に変更済み
- **入力**: `GET .../annotations?resolved=false`
- **期待結果**: レスポンスの `data` に `a_xxx` が含まれない
- **重要度**: HIGH

### 9-4. アノテーション削除

#### ANN-010
- **テスト名**: アノテーションを削除すると配下の Comment も CASCADE 削除される
- **前提条件**: アノテーション `a_xxx` にコメント3件が存在する
- **入力**: `DELETE /api/v1/annotations/a_xxx`
- **期待結果**: HTTP 204、DB からアノテーションおよびコメント3件が削除される
- **重要度**: HIGH

### 9-5. コメント操作

#### ANN-011
- **テスト名**: アノテーションに返信コメントを追加できる
- **前提条件**: アノテーション `a_xxx` が存在する
- **入力**: `POST /api/v1/annotations/a_xxx/comments` に `body="返信コメントです"`
- **期待結果**: HTTP 201、`data.body = "返信コメントです"`, `data.annotation_id = "a_xxx"`
- **重要度**: HIGH

#### ANN-012
- **テスト名**: 返信コメント追加時にアノテーション作成者へ annotation_reply 通知が生成される
- **前提条件**: `u_tanaka` がアノテーションを作成済み。`u_yamada` が返信する
- **入力**: `u_yamada` のセッションで `POST /api/v1/annotations/a_xxx/comments`
- **期待結果**: DB に `u_tanaka` 宛の `type="annotation_reply"`, `comment_id` が設定された Notification が作成される
- **重要度**: HIGH

#### ANN-013
- **テスト名**: 返信コメント追加時に自分自身への annotation_reply 通知は生成されない
- **前提条件**: `u_tanaka` がアノテーションを作成済み
- **入力**: `u_tanaka` のセッションで自分のアノテーションに `POST .../comments`
- **期待結果**: `u_tanaka` 宛の `annotation_reply` 通知は生成されない
- **重要度**: MEDIUM

#### ANN-014
- **テスト名**: メンション形式のコメントを投稿するとメンション対象ユーザーに mention 通知が生成される
- **前提条件**: `u_yamada`（`user_id="u_yyy"`）が組織メンバー
- **入力**: `POST .../comments` に `body="@[山田花子](u_yyy) 確認をお願いします"`
- **期待結果**: DB に `u_yamada` 宛の `type="mention"`, `comment_id` が設定された Notification が作成される
- **重要度**: HIGH

#### ANN-015
- **テスト名**: 1つのコメントに複数のメンションが含まれる場合、各メンション対象へ通知が生成される
- **前提条件**: `u_yamada` と `u_suzuki` が組織メンバー
- **入力**: `body="@[山田花子](u_yyy) @[鈴木一郎](u_zzz) 両者確認をお願いします"`
- **期待結果**: `u_yamada` と `u_suzuki` それぞれに `mention` 通知が生成される（計2件）
- **重要度**: MEDIUM

#### ANN-016
- **テスト名**: 組織外のユーザー ID をメンションしても mention 通知は生成されない
- **前提条件**: `u_outsider` が組織メンバーでない
- **入力**: `body="@[外部ユーザー](u_outsider) 確認をお願いします"`
- **期待結果**: `u_outsider` 宛の通知は生成されない
- **重要度**: MEDIUM

#### ANN-017
- **テスト名**: 自分のコメントを編集できる
- **前提条件**: `u_tanaka` がコメント `c_aaa` を作成済み
- **入力**: `u_tanaka` のセッションで `PATCH /api/v1/comments/c_aaa` に `body="修正後のコメント"`
- **期待結果**: HTTP 200、DB のコメント本文が更新される
- **重要度**: MEDIUM

#### ANN-018
- **テスト名**: 他人のコメントは編集できない
- **前提条件**: `u_tanaka` がコメント `c_aaa` を作成済み
- **入力**: `u_yamada` のセッションで `PATCH /api/v1/comments/c_aaa`
- **期待結果**: HTTP 403
- **重要度**: HIGH

#### ANN-019
- **テスト名**: コメント編集でメンションを追加しても mention 通知は再生成されない
- **前提条件**: 既存コメントにメンションが含まれていない
- **入力**: `PATCH /api/v1/comments/c_aaa` に `body="@[山田花子](u_yyy) 追記"`（メンションを新規追加）
- **期待結果**: `u_yamada` 宛の `mention` 通知は生成されない（再通知なしのルール）
- **重要度**: MEDIUM

#### ANN-020
- **テスト名**: 自分のコメントを削除できる
- **前提条件**: `u_tanaka` がコメント `c_aaa` を作成済み
- **入力**: `u_tanaka` のセッションで `DELETE /api/v1/comments/c_aaa`
- **期待結果**: HTTP 204、DB からコメントが削除される
- **重要度**: MEDIUM

#### ANN-021
- **テスト名**: 他人のコメントは削除できない
- **前提条件**: `u_tanaka` がコメント `c_aaa` を作成済み
- **入力**: `u_yamada` のセッションで `DELETE /api/v1/comments/c_aaa`
- **期待結果**: HTTP 403
- **重要度**: HIGH

---

## 10. 通知テスト

### 10-1. 通知一覧取得

#### NOTIF-001
- **テスト名**: 自分宛の通知一覧を取得できる（最新50件、unread_count 付き）
- **前提条件**: `u_tanaka` 宛に通知が3件（うち未読2件）存在する
- **入力**: `GET /api/v1/notifications`（`u_tanaka` のセッション）
- **期待結果**: HTTP 200、`data` に最大50件の通知が含まれる。`unread_count = 2`。各通知に `meta`（actor, page情報）が付加されている
- **重要度**: HIGH

#### NOTIF-002
- **テスト名**: 他ユーザーの通知は取得できない（自分宛のみ）
- **前提条件**: `u_yamada` 宛に通知が存在する
- **入力**: `GET /api/v1/notifications`（`u_tanaka` のセッション）
- **期待結果**: HTTP 200、`data` に `u_yamada` 宛の通知が含まれない
- **重要度**: HIGH

#### NOTIF-003
- **テスト名**: 通知が50件を超える場合、最新50件のみ返る
- **前提条件**: `u_tanaka` 宛に60件の通知が存在する
- **入力**: `GET /api/v1/notifications`
- **期待結果**: HTTP 200、`data` の件数が50件
- **重要度**: MEDIUM

### 10-2. 通知の発火タイミング

#### NOTIF-004
- **テスト名**: annotation_reply 通知: 返信コメント投稿でアノテーション作成者へ通知が生成される
- **前提条件**: `u_tanaka` がアノテーション（`a_xxx`）を作成済み。`u_yamada` が返信者
- **入力**: `u_yamada` のセッションで `POST /api/v1/annotations/a_xxx/comments`
- **期待結果**: `u_tanaka` 宛に `type="annotation_reply"`, `comment_id` が設定された通知が DB に作成される
- **重要度**: HIGH

#### NOTIF-005
- **テスト名**: mention 通知: コメント本文にメンション形式が含まれるとメンション対象へ通知が生成される
- **前提条件**: `u_yamada` が組織メンバー
- **入力**: `POST .../comments` に `body="@[山田花子](u_yyy) 確認お願いします"`
- **期待結果**: `u_yamada` 宛に `type="mention"`, `comment_id` が設定された通知が DB に作成される
- **重要度**: HIGH

#### NOTIF-006
- **テスト名**: conflict 通知: ブロック更新で 409 が発生するとリクエスト送信者へ通知が生成される
- **前提条件**: ブロックの現在 `version = 3`
- **入力**: `u_tanaka` のセッションで `PATCH /api/v1/blocks/:block-id` に `version=2`（409 が発生する）
- **期待結果**: `u_tanaka` 宛に `type="conflict"`, `page_id` が設定された通知が DB に作成される
- **重要度**: HIGH

#### NOTIF-007
- **テスト名**: conflict 通知: 図ノード操作で 409 が発生してもリクエスト送信者へ通知が生成される
- **前提条件**: 親ブロックの現在 `version = 5`
- **入力**: `u_tanaka` のセッションで `PATCH /api/v1/nodes/:node-id` に `block_version=4`（409 が発生する）
- **期待結果**: `u_tanaka` 宛に `type="conflict"` 通知が DB に作成される
- **重要度**: HIGH

### 10-3. 既読処理

#### NOTIF-008
- **テスト名**: 指定した通知を既読にできる
- **前提条件**: 通知 `notif_aaa` の `read_at = null`（未読）
- **入力**: `PATCH /api/v1/notifications/notif_aaa/read`
- **期待結果**: HTTP 200、`data.read_at` が現在時刻（null でない）。DB の `read_at` が更新されている
- **重要度**: HIGH

#### NOTIF-009
- **テスト名**: 他ユーザーの通知を既読にしようとすると 403 または 404 が返る
- **前提条件**: `notif_bbb` が `u_yamada` 宛
- **入力**: `u_tanaka` のセッションで `PATCH /api/v1/notifications/notif_bbb/read`
- **期待結果**: HTTP 403 または 404
- **重要度**: HIGH

#### NOTIF-010
- **テスト名**: 全通知を既読にできる
- **前提条件**: `u_tanaka` 宛に未読通知が3件存在する
- **入力**: `POST /api/v1/notifications/read-all`（`u_tanaka` のセッション）
- **期待結果**: HTTP 200、`data.updated_count = 3`。DB の全通知の `read_at` が更新される
- **重要度**: HIGH

#### NOTIF-011
- **テスト名**: 全既読操作は自分の通知のみに適用される（他ユーザーの通知は変更されない）
- **前提条件**: `u_tanaka` 宛に未読2件、`u_yamada` 宛に未読2件が存在する
- **入力**: `u_tanaka` のセッションで `POST /api/v1/notifications/read-all`
- **期待結果**: `u_tanaka` の通知2件が既読になる。`u_yamada` の通知2件は `read_at = null` のまま
- **重要度**: HIGH

### 10-4. Socket.io リアルタイムプッシュ

#### NOTIF-012
- **テスト名**: annotation_reply 通知生成時に Socket.io で対象ユーザーへ notification:new イベントが emit される
- **前提条件**: `u_tanaka` が Socket.io で `user:u_tanaka` ルームに join している
- **入力**: `u_yamada` が `u_tanaka` のアノテーションにコメントを投稿する
- **期待結果**: `u_tanaka` クライアントが `notification:new` イベントを受信する。ペイロードに `type="annotation_reply"`, `meta.actor`, `meta.page` が含まれる
- **重要度**: HIGH

#### NOTIF-013
- **テスト名**: mention 通知生成時に Socket.io で対象ユーザーへ notification:new イベントが emit される
- **前提条件**: `u_yamada` が Socket.io で `user:u_yamada` ルームに join している
- **入力**: 任意のユーザーがコメントに `@[山田花子](u_yyy)` を含むメンションを投稿する
- **期待結果**: `u_yamada` クライアントが `notification:new` イベントを受信する。ペイロードに `type="mention"` が含まれる
- **重要度**: HIGH

#### NOTIF-014
- **テスト名**: conflict 通知生成時に Socket.io でリクエスト送信者へ notification:new イベントが emit される
- **前提条件**: `u_tanaka` が Socket.io に接続している
- **入力**: `u_tanaka` の 409 発生リクエスト
- **期待結果**: `u_tanaka` クライアントが `notification:new` イベントを受信する。ペイロードに `type="conflict"` が含まれる
- **重要度**: HIGH

#### NOTIF-015
- **テスト名**: 未認証の Socket.io 接続は切断される
- **前提条件**: なし
- **入力**: セッション Cookie なしで Socket.io に接続を試みる
- **期待結果**: 接続が拒否または切断される
- **重要度**: HIGH

---

## 11. フォルダテスト

#### FOLDER-001
- **テスト名**: トップレベルフォルダを作成できる
- **前提条件**: ユーザーが組織のメンバー
- **入力**: `POST /api/v1/organizations/acme-inc/folders` に `name="機能仕様"`, `parent_folder_id=null`
- **期待結果**: HTTP 201、`data.name = "機能仕様"`, `data.parent_folder_id = null`
- **重要度**: HIGH

#### FOLDER-002
- **テスト名**: サブフォルダ（ネスト）を作成できる
- **前提条件**: フォルダ `f_parent` が存在する
- **入力**: `POST /api/v1/organizations/acme-inc/folders` に `parent_folder_id="f_parent"`
- **期待結果**: HTTP 201、`data.parent_folder_id = "f_parent"`
- **重要度**: MEDIUM

#### FOLDER-003
- **テスト名**: フォルダ一覧をツリー構造で取得できる
- **前提条件**: 親フォルダ1件、子フォルダ1件が存在する
- **入力**: `GET /api/v1/organizations/acme-inc/folders`
- **期待結果**: HTTP 200、`data` に親フォルダが含まれ、`children` に子フォルダが含まれる
- **重要度**: MEDIUM

#### FOLDER-004
- **テスト名**: フォルダ名を更新できる
- **前提条件**: フォルダ `f_aaa` が存在する
- **入力**: `PATCH /api/v1/organizations/acme-inc/folders/f_aaa` に `name="リネーム後"`
- **期待結果**: HTTP 200、`data.name = "リネーム後"`
- **重要度**: MEDIUM

#### FOLDER-005
- **テスト名**: フォルダを削除すると配下のページは孤立ページとして残存する（folder_id が null になる）
- **前提条件**: フォルダ `f_aaa` の配下にページ `p_bbb` が存在する（`folder_id="f_aaa"`）
- **入力**: `DELETE /api/v1/organizations/acme-inc/folders/f_aaa`
- **期待結果**: HTTP 204、フォルダ `f_aaa` が DB から削除される。ページ `p_bbb` は残存し `folder_id = null` になっている
- **重要度**: HIGH

#### FOLDER-006
- **テスト名**: フォルダを削除するとサブフォルダも再帰的に削除される
- **前提条件**: 親フォルダ `f_parent` の配下にサブフォルダ `f_child` が存在する
- **入力**: `DELETE /api/v1/organizations/acme-inc/folders/f_parent`
- **期待結果**: HTTP 204、`f_parent` と `f_child` の両方が DB から削除される
- **重要度**: MEDIUM

#### FOLDER-007
- **テスト名**: サイドバー API でフォルダツリーとページ一覧を一括取得できる
- **前提条件**: フォルダと各種フォルダに属するページが存在する。`folder_id = null` の孤立ページも存在する
- **入力**: `GET /api/v1/organizations/acme-inc/sidebar`
- **期待結果**: HTTP 200、`data.folders` にツリー構造のフォルダが、`data.pages` に全ページ（孤立ページ含む）が含まれる。各ページに `folder_id`（null または フォルダID）が含まれる
- **重要度**: MEDIUM

---

## 12. E2E テスト概要

E2E テストは Playwright を使用し、以下の代表的なユーザーフローを検証する。各シナリオは実際のブラウザ操作を再現し、フロントエンドからバックエンドまでの統合動作を確認する。

### E2E-001: 新規ユーザーのオンボーディングフロー
**シナリオ**: ユーザーが新規登録し、組織を作成して、最初のページを作成する

1. `/signup` にアクセスする
2. Step1: 名前・Email・パスワードを入力し「次へ」をクリックする
3. Step2: 「新しい組織を作成する」を選択し、組織名を入力して「登録する」をクリックする
4. ダッシュボード `/[org-slug]` にリダイレクトされることを確認する
5. Empty State の「最初のページを作成する」ボタンをクリックする
6. ページエディタ `/[org-slug]/[page-slug]` に遷移することを確認する
7. ページタイトルを入力し、テキストブロックを追加してコンテンツを入力する
8. 保存状態インジケーターが「保存済み」になることを確認する

**重要度**: HIGH

### E2E-002: 招待経由の組織参加フロー
**シナリオ**: 既存メンバーが招待を送り、新規ユーザーが招待リンクから組織に参加する

1. 既存ユーザーが組織設定 `/[org-slug]/settings` で招待フォームにメールアドレスを入力し「招待を送る」をクリックする
2. 招待トークン URL `/invite/[token]` にアクセスする（未登録ユーザーとして）
3. 「アカウント作成して参加」ボタンをクリックする
4. `/signup` にリダイレクトされることを確認する（招待トークンが URL パラメータに保持されている）
5. ユーザー情報を入力して登録完了する
6. 自動的に組織に参加し、ダッシュボード `/[org-slug]` にリダイレクトされることを確認する

**重要度**: HIGH

### E2E-003: ページ編集と図ブロック作図フロー
**シナリオ**: ユーザーが図ブロックを挿入し、ノードとエッジを作成する

1. ページエディタでブロック追加メニュー（`/` コマンド）を開く
2. 「図ブロック」を選択して挿入する
3. ノードパレットから「Screen」を選択し、キャンバス上にドロップする
4. さらに「Start」ノードを追加する
5. Start ノードのエッジをドラッグして Screen ノードに接続する
6. Screen ノードのラベルを「ログイン画面」に変更する
7. ページをリロードし、ノード・エッジが保存されていることを確認する

**重要度**: HIGH

### E2E-004: アノテーション作成・返信・Resolved フロー
**シナリオ**: ユーザーがアノテーションを立て、返信して、Resolved にする

1. テキストブロック内のテキストを選択し、ピン追加ボタンをクリックする
2. 右パネルのアノテーションスレッドが自動展開・フォーカスされることを確認する
3. 初回コメント「この記述は仕様確定ですか？」を入力して送信する
4. 別のユーザーとしてログインし、同じページにアクセスする
5. アノテーションパネルで返信コメントを入力して送信する
6. 元のユーザーに `annotation_reply` 通知が届いていることを通知ドロップダウンで確認する
7. 「Resolved」ボタンをクリックしてアノテーションを解決済みにする
8. アノテーションがデフォルト非表示になることを確認する（トグルで表示可能）

**重要度**: HIGH

### E2E-005: 楽観的ロック競合解決フロー
**シナリオ**: 2ユーザーが同じブロックを同時編集し、後から保存したユーザーが競合ダイアログを操作する

1. `u_tanaka` と `u_yamada` が同じページエディタを開く
2. `u_tanaka` が特定のテキストブロックを「田中の変更」に編集して保存する
3. `u_yamada` が同じブロック（`u_tanaka` の保存前に読み込んだ version を保持）を「山田の変更」に編集して保存する
4. `u_yamada` の保存時に競合が検出され、競合解決ダイアログが表示されることを確認する
5. ダイアログに「あなたの変更（山田の変更）」と「最新の内容（田中の変更）」が diff 表示されることを確認する
6. 「あなたの変更を採用」をクリックする
7. `u_yamada` の変更（「山田の変更」）がページに反映されることを確認する

**重要度**: HIGH

---

## 付録: テストケース番号一覧

| 番号 | カテゴリ | テスト名（概要） |
|------|---------|----------------|
| AUTH-001 | 認証 | 新規ユーザー登録と組織作成 |
| AUTH-002 | 認証 | 招待トークンでの組録参加 |
| AUTH-003 | 認証 | email 重複エラー |
| AUTH-004 | 認証 | パスワード空文字エラー |
| AUTH-005 | 認証 | 無効招待トークンエラー |
| AUTH-006 | 認証 | 期限切れ招待トークンエラー |
| AUTH-007 | 認証 | 使用済み招待トークンエラー |
| AUTH-008 | 認証 | 正常ログイン |
| AUTH-009 | 認証 | 誤パスワードエラー |
| AUTH-010 | 認証 | 存在しない email エラー |
| AUTH-011 | 認証 | ログアウト |
| AUTH-012 | 認証 | 未認証アクセス 401 |
| AUTH-013 | 認証 | 未認証アクセス 401（複数エンドポイント） |
| ORG-001 | 組織 | 組織情報取得 |
| ORG-002 | 組織 | 他組織アクセス禁止 |
| ORG-003 | 組織 | 組織名更新 |
| ORG-004 | 組織 | メンバー一覧取得 |
| ORG-005 | 組織 | 除名エンドポイント不在（フラット権限） |
| ORG-006 | 組織 | 自分のみ脱退可能 |
| ORG-007 | 組織 | 脱退後のデータ残存 |
| ORG-008 | 組織 | 脱退後のアクセス禁止 |
| ORG-009 | 組織 | 最終メンバー脱退後も組織レコード残存 |
| INV-001 | 招待 | 招待発行 |
| INV-002 | 招待 | 有効トークンで招待情報取得 |
| INV-003 | 招待 | 存在しないトークン 404 |
| INV-004 | 招待 | 期限切れトークン 404 |
| INV-005 | 招待 | 招待受け入れ（組織参加） |
| INV-006 | 招待 | 使用済みトークン再利用禁止 |
| INV-007 | 招待 | 既存メンバーの招待受け入れ |
| INV-008 | 招待 | 宛先と異なるメールのユーザーが受け入れ → 403 |
| PAGE-001 | ページ | 新規作成・url_slug 自動生成 |
| PAGE-002 | ページ | url_slug の一意性 |
| PAGE-003 | ページ | フォルダ指定作成 |
| PAGE-004 | ページ | 一覧取得 |
| PAGE-005 | ページ | recent=true で最新10件 |
| PAGE-006 | ページ | 詳細取得（ブロック・ノード・エッジ込み） |
| PAGE-007 | ページ | タイトル更新（バージョン一致） |
| PAGE-008 | ページ | タイトル更新（バージョン不一致 409） |
| PAGE-009 | ページ | 削除（CASCADE） |
| PAGE-010 | ページ | 他組織ページアクセス禁止 |
| BLK-001 | ブロック | テキストブロック追加（末尾） |
| BLK-002 | ブロック | 中間位置挿入 |
| BLK-003 | ブロック | heading / diagram ブロック追加 |
| BLK-004 | ブロック | 内容更新（バージョン一致） |
| BLK-005 | ブロック | 内容更新（バージョン不一致 409） |
| BLK-006 | ブロック | 409 発生時の conflict 通知生成 |
| BLK-007 | ブロック | 並び替え |
| BLK-008 | ブロック | 先頭移動（after_block_id=null） |
| BLK-009 | ブロック | リバランス発生 |
| BLK-010 | ブロック | ブロック削除 |
| BLK-011 | ブロック | diagram ブロック削除（CASCADE） |
| DIAG-001 | 図ブロック | Screen ノード追加 |
| DIAG-002 | 図ブロック | 全ノード種別追加 |
| DIAG-003 | 図ブロック | ノード追加 409 |
| DIAG-004 | 図ブロック | ノード更新 |
| DIAG-005 | 図ブロック | ノード更新 409 |
| DIAG-006 | 図ブロック | ノード削除 |
| DIAG-007 | 図ブロック | ノード削除（接続エッジ CASCADE） |
| DIAG-008 | 図ブロック | ノード削除 409 |
| DIAG-009 | 図ブロック | エッジ追加 |
| DIAG-010 | 図ブロック | エッジ更新 |
| DIAG-011 | 図ブロック | エッジ削除 |
| DIAG-012 | 図ブロック | エッジ追加 409 |
| DIAG-013 | 図ブロック | 別ブロックのノード参照エラー |
| DIAG-014 | 図ブロック | ノード type 変更 |
| DIAG-015 | 図ブロック | type 変更後もアノテーション残存 |
| DIAG-016 | 図ブロック | type 変更後もエッジ残存 |
| DIAG-017 | 図ブロック | 自己ループエッジ作成（許可） |
| DIAG-018 | 図ブロック | 重複エッジ作成（許可） |
| OPT-001 | 楽観的ロック | Page.version 競合検出 |
| OPT-002 | 楽観的ロック | Page 409 の current フィールド |
| OPT-003 | 楽観的ロック | Block.version 競合検出 |
| OPT-004 | 楽観的ロック | Block 409 の current フィールド |
| OPT-005 | 楽観的ロック | 自分の変更を採用（強制上書き） |
| OPT-006 | 楽観的ロック | ノード追加の 409 |
| OPT-007 | 楽観的ロック | エッジ削除の 409 |
| OPT-008 | 楽観的ロック | 同時更新シミュレーション |
| OPT-009 | 楽観的ロック | Page.version と Block.version の独立性 |
| ANN-001 | アノテーション | 図ノードへのピン設置 |
| ANN-002 | アノテーション | テキストブロックへのピン設置 |
| ANN-003 | アノテーション | node_id / block_offset 両方省略エラー |
| ANN-004 | アノテーション | 全件取得 |
| ANN-005 | アノテーション | 未解決フィルタ |
| ANN-006 | アノテーション | 解決済みフィルタ |
| ANN-007 | アノテーション | Resolved への変更 |
| ANN-008 | アノテーション | 未解決への戻し |
| ANN-009 | アノテーション | Resolved はデフォルト非表示 |
| ANN-010 | アノテーション | 削除（コメント CASCADE） |
| ANN-011 | アノテーション | 返信コメント追加 |
| ANN-012 | アノテーション | annotation_reply 通知生成 |
| ANN-013 | アノテーション | 自分のアノテーションへの自己返信で通知なし |
| ANN-014 | アノテーション | mention 通知生成 |
| ANN-015 | アノテーション | 複数メンション通知 |
| ANN-016 | アノテーション | 組織外メンションで通知なし |
| ANN-017 | アノテーション | 自分のコメント編集 |
| ANN-018 | アノテーション | 他人のコメント編集禁止 |
| ANN-019 | アノテーション | コメント編集でのメンション再通知なし |
| ANN-020 | アノテーション | 自分のコメント削除 |
| ANN-021 | アノテーション | 他人のコメント削除禁止 |
| NOTIF-001 | 通知 | 通知一覧取得（unread_count 付き） |
| NOTIF-002 | 通知 | 他ユーザー通知は取得不可 |
| NOTIF-003 | 通知 | 最新50件上限 |
| NOTIF-004 | 通知 | annotation_reply 発火 |
| NOTIF-005 | 通知 | mention 発火 |
| NOTIF-006 | 通知 | conflict 発火（ブロック） |
| NOTIF-007 | 通知 | conflict 発火（図ノード） |
| NOTIF-008 | 通知 | 個別既読 |
| NOTIF-009 | 通知 | 他ユーザー通知既読禁止 |
| NOTIF-010 | 通知 | 全既読 |
| NOTIF-011 | 通知 | 全既読の適用範囲（自分のみ） |
| NOTIF-012 | 通知 | Socket.io annotation_reply プッシュ |
| NOTIF-013 | 通知 | Socket.io mention プッシュ |
| NOTIF-014 | 通知 | Socket.io conflict プッシュ |
| NOTIF-015 | 通知 | 未認証 Socket.io 接続拒否 |
| FOLDER-001 | フォルダ | トップレベルフォルダ作成 |
| FOLDER-002 | フォルダ | サブフォルダ作成 |
| FOLDER-003 | フォルダ | フォルダ一覧（ツリー構造） |
| FOLDER-004 | フォルダ | フォルダ名更新 |
| FOLDER-005 | フォルダ | フォルダ削除（ページ孤立・SET NULL） |
| FOLDER-006 | フォルダ | フォルダ削除（サブフォルダ再帰削除） |
| FOLDER-007 | フォルダ | サイドバー一括取得 |
| E2E-001 | E2E | 新規ユーザーオンボーディング |
| E2E-002 | E2E | 招待経由の組織参加 |
| E2E-003 | E2E | 図ブロック作図 |
| E2E-004 | E2E | アノテーション作成・返信・Resolved |
| E2E-005 | E2E | 楽観的ロック競合解決 |
