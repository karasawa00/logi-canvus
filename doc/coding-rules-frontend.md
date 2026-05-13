# フロントエンド コーディングルール

## 基本方針

- コメントは「なぜ」が非自明な場合のみ書く。コードが何をするかは書かない
- `any` を使わない
- Props の型は `interface` で定義する（`type` より `interface` を優先）

---

## Next.js App Router

### Server / Client コンポーネントの分離

- デフォルトは Server Component。`"use client"` は必要な最小単位にのみ付与する
- TipTap・React Flow・Zustand・`useSession` は CSR 必須のため、それらを含むコンポーネントは Client Component にする
- SSR シェル（`page.tsx`）は Server Component のままにし、Client Component を `<Suspense>` で包む

```ts
// page.tsx（Server Component）
import { Suspense } from 'react'
import { PageEditor } from './page-editor' // "use client"

export default async function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PageEditor />
    </Suspense>
  )
}
```

### ルーティング

- 画面遷移は `router.push` を使う。`<a href>` は使わない
- 新規ページ作成後は API レスポンスの `url_slug` を受け取ってから `router.push` する

---

## 認証

- クライアントコンポーネントでのセッション取得は `useSession()` を使う
- ログイン・ログアウトは `signIn()` / `signOut()` を使う（直接 API を叩かない）
- サインアップ後は `signIn('credentials', { email, password })` でセッションを開始する

---

## 状態管理

### TanStack Query（サーバー状態）

- API データの取得・更新には TanStack Query を使う（`useState` + `fetch` は使わない）
- キーは `['resource', id]` の配列形式にする
- 楽観的更新（`onMutate`）を使う場合は必ず `onError` でロールバックする

### Zustand（クライアント状態）

- 図データ（DiagramNode / DiagramEdge）の一時状態は Zustand の図専用ストアに持つ
- ストアは `src/stores/` に置き、責務ごとにファイルを分ける
- TipTap の document には `diagramBlockId` のみ保持し、ノード・エッジデータは持たせない

---

## TipTap

- ブロック種別（text / heading / diagram）を TipTap カスタムノードとして実装する
- 図ブロックは TipTap カスタム Extension として作成し、内部に React Flow を埋め込む
- TipTap の `onUpdate` でデバウンスして API に反映する（即時保存しない）

---

## React Flow

- ノード・エッジデータは React Flow の state ではなく Zustand ストア経由で管理する
- ノード変更（位置・ラベル）はデバウンス後に `PATCH /nodes/:id` を呼ぶ
- React Flow のイベント（`onNodeDrag`）と TipTap のブロックドラッグを競合させないよう、イベントの伝播を適切に止める

---

## Tailwind CSS

- クラス名はコンポーネントのルート要素から順番に書く（レイアウト → サイズ → 余白 → 色 → その他）
- 条件付きクラスは `cn()` ユーティリティ（`clsx` + `tailwind-merge`）で結合する
- インラインスタイル（`style={{ }}` ）は React Flow のノード位置など Tailwind で表現できない場合のみ使う

---

## API 呼び出し

- API 呼び出しは `src/lib/api/` に関数としてまとめ、コンポーネントから直接 `fetch` しない
- エラーレスポンス（`{ error: { code, message } }`）は呼び出し元で適切に処理する
- 楽観的ロック競合（`409 CONFLICT`）は競合解決ダイアログを表示してユーザーに選択させる

---

## コンポーネント設計

- 1ファイル1コンポーネントを基本とする
- `export default` はページ（`page.tsx`）のみ。その他は名前付きエクスポートを使う
- コンポーネントのファイル名はパスカルケース（`AnnotationPin.tsx`）
- ユーティリティ関数・hooks はコンポーネントファイルに混ぜず、`src/lib/` や `src/hooks/` に分ける
- ルート固有コンポーネントは `page.tsx` と同階層に置く（co-location）
- 複数ルートで共有するコンポーネントは `src/components/` に置く

---

## アノテーション

- ピンの追加ボタンはテキストブロック（選択時）とノード（ホバー時）に表示する
- ピンをクリックしたら右パネルを自動展開し、該当スレッドにスクロール・フォーカスする
- Resolved ピンはデフォルト非表示（`resolved_at !== null` でフィルタ）

---

## 競合解決 UI

- `409 CONFLICT` 受信時はモーダルを表示し、「自分の変更を採用」「最新の内容を採用」を選択させる
- 「自分の変更を採用」時は最新 `version` を取得してから上書き PATCH を送信する
- 「最新の内容を採用」時はローカル変更を破棄してエディタを最新状態に更新する
