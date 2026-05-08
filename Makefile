.PHONY: setup dev build lint type-check test db-up db-down db-migrate db-generate db-studio deploy

# 初回セットアップ（npm install + DB起動 + マイグレーション）
setup:
	npm install
	$(MAKE) db-up
	sleep 5
	$(MAKE) db-migrate

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

# MySQL コンテナ起動
db-up:
	docker compose up -d

# エイリアス: make db:up
db\:up: db-up

# MySQL コンテナ停止
db-down:
	docker compose down

# エイリアス: make db:down
db\:down: db-down

# Prisma マイグレーション実行
db-migrate:
	npx prisma migrate dev

# エイリアス: make db:migrate
db\:migrate: db-migrate

# Prisma クライアント生成
db-generate:
	npx prisma generate

# エイリアス: make db:generate
db\:generate: db-generate

# Prisma Studio 起動
db-studio:
	npx prisma studio

# エイリアス: make db:studio
db\:studio: db-studio

# GCP Cloud Run へデプロイ（詳細は別途追記）
deploy:
	@echo "Deploy to GCP Cloud Run - implementation pending"
