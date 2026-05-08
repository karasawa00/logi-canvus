---
name: test-spec.md 作成記録
description: logi-canvus のテスト仕様書（doc/test-spec.md）の作成経緯とカバー範囲
type: project
---

テスト仕様書を `/Users/karasawa/Desktop/dev/logi-canvus/logi-canvus/doc/test-spec.md` に作成した（2026-05-07）。

**Why:** プロジェクト開始時点でテスト仕様書が存在しなかったため、doc/api-design.md・spec.md・er-diagram.md・screen-design.md・tech-stack.md を横断して要件をまとめた。

**How to apply:** テストを実装する際はこの仕様書の番号（AUTH-001 等）を参照してテストを命名・追跡すること。仕様変更があれば test-spec.md も合わせて更新すること。

## カバー範囲（テストケース数）

| セクション | 件数 |
|-----------|------|
| 認証（AUTH） | 13件 |
| 組織・メンバー（ORG） | 8件 |
| 招待（INV） | 7件 |
| ページ CRUD（PAGE） | 10件 |
| ブロック（BLK） | 11件 |
| 図ブロック（DIAG） | 13件 |
| 楽観的ロック（OPT） | 9件 |
| アノテーション・コメント（ANN） | 21件 |
| 通知（NOTIF） | 15件 |
| フォルダ（FOLDER） | 7件 |
| E2E | 5件 |
| **合計** | **119件** |

## 重要な判断事項

- Mermaid・CRDT・メール通知・OAuth はスコープ外として明示した
- 楽観的ロックの Page.version と Block.version の独立性（OPT-009）を独立したテストケースとして明示した
- 409 発生時の conflict 通知副作用（BLK-006, NOTIF-006, NOTIF-007）を通知テストと図ブロックテストの両方でカバーした
- フラット権限の検証として「除名エンドポイント不在」（ORG-005）を入れた
- コメント編集でのメンション再通知なし（ANN-019）を仕様通り明記した
