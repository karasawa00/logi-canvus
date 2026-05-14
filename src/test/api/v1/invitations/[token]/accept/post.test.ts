import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/v1/invitations/[token]/accept/route'
import { prisma } from '@/lib/prisma'

// auth() はセッション依存のため、テスト用にモックする
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/lib/auth'

const mockAuth = auth as ReturnType<typeof vi.fn>

async function createOrgAndInviter() {
  const org = await prisma.organization.create({
    data: { name: 'Accept Test Org', slug: `accept-org-${Date.now()}` },
  })
  const inviter = await prisma.user.create({
    data: {
      name: 'Inviter',
      email: `inviter-accept-${Date.now()}@example.com`,
      passwordHash: 'dummy-hash',
      orgId: org.id,
    },
  })
  return { org, inviter }
}

describe('POST /api/v1/invitations/:token/accept', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await prisma.invitation.deleteMany()
    await prisma.user.deleteMany()
    await prisma.organization.deleteMany()
  })

  afterAll(async () => {
    await prisma.invitation.deleteMany()
    await prisma.user.deleteMany()
    await prisma.organization.deleteMany()
  })

  it('正常系 — 有効なトークンで 200 と組織情報を返し、ユーザーが組織に追加される', async () => {
    const { org, inviter } = await createOrgAndInviter()
    const token = `accept-valid-${Date.now()}`
    const invitedEmail = `accept-member-${Date.now()}@example.com`

    await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: invitedEmail,
        token,
        createdBy: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    // 招待先メールと同じ email のユーザー（別組織に未参加状態）を作成
    const memberOrg = await prisma.organization.create({
      data: { name: 'Member Org', slug: `member-org-${Date.now()}` },
    })
    const member = await prisma.user.create({
      data: {
        name: 'New Member',
        email: invitedEmail,
        passwordHash: 'dummy-hash',
        orgId: memberOrg.id,
      },
    })

    mockAuth.mockResolvedValue({
      user: { id: member.id, email: invitedEmail },
    })

    const req = new Request(
      `http://localhost/api/v1/invitations/${token}/accept`,
      { method: 'POST' },
    ) as NextRequest
    const res = await POST(req, { params: Promise.resolve({ token }) })

    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.data.organization.id).toBe(org.id)
    expect(json.data.organization.slug).toBe(org.slug)

    const updatedUser = await prisma.user.findUnique({ where: { id: member.id } })
    expect(updatedUser?.orgId).toBe(org.id)

    const updatedInvitation = await prisma.invitation.findUnique({ where: { token } })
    expect(updatedInvitation?.usedAt).not.toBeNull()
  })

  it('未認証 — 401 UNAUTHORIZED を返す', async () => {
    mockAuth.mockResolvedValue(null)

    const req = new Request(
      'http://localhost/api/v1/invitations/some-token/accept',
      { method: 'POST' },
    ) as NextRequest
    const res = await POST(req, { params: Promise.resolve({ token: 'some-token' }) })

    expect(res.status).toBe(401)

    const json = await res.json()
    expect(json.error.code).toBe('UNAUTHORIZED')
  })

  it('存在しないトークン — 404 NOT_FOUND を返す', async () => {
    const { org } = await createOrgAndInviter()
    const user = await prisma.user.create({
      data: {
        name: 'User',
        email: `user-notoken-${Date.now()}@example.com`,
        passwordHash: 'dummy-hash',
        orgId: org.id,
      },
    })

    mockAuth.mockResolvedValue({
      user: { id: user.id, email: user.email },
    })

    const req = new Request(
      'http://localhost/api/v1/invitations/nonexistent-token/accept',
      { method: 'POST' },
    ) as NextRequest
    const res = await POST(req, { params: Promise.resolve({ token: 'nonexistent-token' }) })

    expect(res.status).toBe(404)

    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('ログイン中ユーザーの email が招待の宛先 email と不一致 — 403 FORBIDDEN を返す', async () => {
    const { org, inviter } = await createOrgAndInviter()
    const token = `forbidden-token-${Date.now()}`

    await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: 'invited@example.com',
        token,
        createdBy: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const differentUser = await prisma.user.create({
      data: {
        name: 'Different User',
        email: `different-${Date.now()}@example.com`,
        passwordHash: 'dummy-hash',
        orgId: org.id,
      },
    })

    mockAuth.mockResolvedValue({
      user: { id: differentUser.id, email: differentUser.email },
    })

    const req = new Request(
      `http://localhost/api/v1/invitations/${token}/accept`,
      { method: 'POST' },
    ) as NextRequest
    const res = await POST(req, { params: Promise.resolve({ token }) })

    expect(res.status).toBe(403)

    const json = await res.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('使用済みトークン — 404 NOT_FOUND を返す', async () => {
    const { org, inviter } = await createOrgAndInviter()
    const token = `used-accept-token-${Date.now()}`
    const invitedEmail = `used-accept-${Date.now()}@example.com`

    await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: invitedEmail,
        token,
        createdBy: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        usedAt: new Date(),
      },
    })

    const user = await prisma.user.create({
      data: {
        name: 'User',
        email: invitedEmail,
        passwordHash: 'dummy-hash',
        orgId: org.id,
      },
    })

    mockAuth.mockResolvedValue({
      user: { id: user.id, email: invitedEmail },
    })

    const req = new Request(
      `http://localhost/api/v1/invitations/${token}/accept`,
      { method: 'POST' },
    ) as NextRequest
    const res = await POST(req, { params: Promise.resolve({ token }) })

    expect(res.status).toBe(404)

    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })
})
