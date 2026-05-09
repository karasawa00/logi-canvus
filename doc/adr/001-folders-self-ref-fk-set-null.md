# ADR-001: folders 自己参照FK の削除挙動を SET NULL にする

## ステータス

採用済み（2026-05-09）

## 背景

`folders` テーブルは `parent_folder_id` で自己参照する階層構造を持つ。

API 設計書の `DELETE /organizations/:org-slug/folders/:folder-id` には以下の仕様がある。

> サブフォルダも再帰的に削除される。削除されたフォルダ配下のページはすべて `folder_id = null` になる。

この仕様を実現するアプローチとして、FK の削除挙動を **`ON DELETE CASCADE`** にするか **`ON DELETE SET NULL`** にするかを検討した。

## 決定事項

**`ON DELETE SET NULL` + アプリ層での再帰削除** を採用する。

## 検討した選択肢

### 選択肢 A: `ON DELETE CASCADE`

DB の外部キー制約によって、親フォルダを削除した際にサブフォルダを自動で再帰削除する。

**メリット**
- API 層に削除ロジックを書かずに済む

**デメリット**
- **Prisma + MySQL の制約**: Prisma は MySQL の自己参照リレーションに `onDelete: Cascade` を指定した際、migration 生成時に警告またはエラーを出すことがある既知の問題がある。
- **FK 処理順序の不透明さ**: MySQL の InnoDB が CASCADE を処理する順序（子→孫→...）はアプリ側から制御できず、深い階層でデッドロックや制約違反が起きた場合のデバッグが困難になる。
- **柔軟性の欠如**: 将来「サブフォルダをルートに昇格して親フォルダだけ削除する」等の仕様変更が生じた場合、DB スキーマの変更（migration）が必要になる。

### 選択肢 B: `ON DELETE SET NULL` + アプリ層での再帰削除（採用）

自己参照 FK の削除挙動は `SET NULL` とし、フォルダ削除 API ハンドラでサブフォルダを再帰的に削除する。

**メリット**
- **Prisma + MySQL との相性が良い**: オプショナルリレーションのデフォルト挙動（`SetNull`）と一致し、schema.prisma と migration の両方で追加設定が不要。
- **明示的で可視化・テスト可能**: 削除ロジックがアプリコードに現れるため、ユニットテストが書きやすく、ログや監査にも対応しやすい。
- **トランザクション制御**: Prisma の `$transaction` で子孫フォルダの一括削除と pages の `folder_id = null` 化を原子的に処理できる（pages FK はすでに `ON DELETE SET NULL`）。
- **仕様変更への耐性**: 削除挙動をコード側で変えるだけでよく、DB スキーマの変更が不要。

**デメリット**
- フォルダ削除 API ハンドラに再帰クエリの実装が必要。

## 実装指針

フォルダ削除 API（`DELETE /api/v1/organizations/[org-slug]/folders/[folder-id]/route.ts`）を実装する際は以下のパターンに従う。

```typescript
async function collectDescendantIds(folderId: string, tx: PrismaClient): Promise<string[]> {
  const children = await tx.folder.findMany({
    where: { parentFolderId: folderId },
    select: { id: true },
  })
  const childIds = children.map((c) => c.id)
  const grandChildIds = await Promise.all(childIds.map((id) => collectDescendantIds(id, tx)))
  return [...childIds, ...grandChildIds.flat()]
}

// DELETE ハンドラ内
await prisma.$transaction(async (tx) => {
  const descendantIds = await collectDescendantIds(folderId, tx)
  await tx.folder.deleteMany({
    where: { id: { in: [...descendantIds, folderId] } },
  })
  // pages.folder_id は ON DELETE SET NULL により自動 null 化される
})
```

階層が非常に深くなる場合は MySQL の `WITH RECURSIVE` を `$queryRaw` で実行する方式に切り替えることを検討する。

## 関連ファイル

| ファイル | 内容 |
|---------|------|
| `prisma/schema.prisma` | Folder モデルの自己参照リレーション定義 |
| `prisma/migrations/20260509072058_init/migration.sql` | `folders_parent_folder_id_fkey ON DELETE SET NULL` |
| `doc/er-diagram.md` | ER 図・カスケード削除方針 |
| `doc/api-design.md` | `DELETE /folders/:folder-id` の仕様 |
