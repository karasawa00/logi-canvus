import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test.describe('招待受け入れ画面 /invite/[token]', () => {
  const token = `e2e-invite-${Date.now()}`

  test.beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { name: 'E2E Invite Org', slug: `e2e-invite-org-${Date.now()}` },
    })
    const inviter = await prisma.user.create({
      data: {
        name: 'E2E Inviter',
        email: `e2e-inviter-${Date.now()}@example.com`,
        passwordHash: 'dummy-hash',
        orgId: org.id,
      },
    })
    await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: `e2e-invited-${Date.now()}@example.com`,
        token,
        createdBy: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  })

  test.afterAll(async () => {
    await prisma.invitation.deleteMany({ where: { token } })
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-inviter-' } } })
    await prisma.organization.deleteMany({ where: { slug: { startsWith: 'e2e-invite-org-' } } })
    await prisma.$disconnect()
  })

  test('無効なトークン — エラーメッセージが表示される', async ({ page }) => {
    await page.goto('/invite/invalid-token-that-does-not-exist')

    await expect(page.getByTestId('error-message')).toBeVisible()
  })

  test('有効なトークン — 組織名と2つのアクションボタンが表示される', async ({ page }) => {
    await page.goto(`/invite/${token}`)

    await expect(page.getByTestId('signup-button')).toBeVisible()
    await expect(page.getByTestId('login-button')).toBeVisible()
  })

  test('「アカウント作成して参加」ボタン — /signup?redirect=/invite/[token] へ遷移する', async ({
    page,
  }) => {
    await page.goto(`/invite/${token}`)

    await page.getByTestId('signup-button').click()

    await expect(page).toHaveURL(`/signup?redirect=${encodeURIComponent(`/invite/${token}`)}`)
  })
})
