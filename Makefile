.PHONY: setup dev build lint type-check test db\:up db\:down db\:migrate db\:generate db\:studio deploy

# 初回セットアップ（npm install + DB起動 + マイグレーション）
setup:
	npm install
	$(MAKE) db:up
	$(MAKE) db:migrate

# 開発サーバー起動
dev:
	npm run dev

# プロダクションビルド
build:
	npm run build

# ESLint 実行
lint:
	npm run lint

# TypeScript 型チェック
type-check:
	npm run type-check

# Vitest 実行
test:
	npm run test

# MySQL コンテナ起動（healthy になるまで待機）
db\:up:
	docker compose up -d --wait

# MySQL コンテナ停止
db\:down:
	docker compose down

# Prisma マイグレーション実行
db\:migrate:
	npx prisma migrate dev

# Prisma クライアント生成
db\:generate:
	npx prisma generate

# Prisma Studio 起動
db\:studio:
	npx prisma studio

# GCP Cloud Run へデプロイ（詳細は別途追記）
deploy:
	@echo "Deploy to GCP Cloud Run - implementation pending"
