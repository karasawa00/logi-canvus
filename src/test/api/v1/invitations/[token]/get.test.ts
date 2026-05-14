import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/v1/invitations/[token]/route'
import { prisma } from '@/lib/prisma'

async function createOrgAndInviter() {
  const org = await prisma.organization.create({
    data: { name: 'Test Org', slug: `test-org-get-inv-${Date.now()}` },
  })
  const inviter = await prisma.user.create({
    data: {
      name: 'Inviter',
      email: `inviter-get-${Date.now()}@example.com`,
      passwordHash: 'dummy-hash',
      orgId: org.id,
    },
  })
  return { org, inviter }
}

describe('GET /api/v1/invitations/:token', () => {
  beforeEach(async () => {
    await prisma.invitation.deleteMany()
    await prisma.user.deleteMany()
    await prisma.organization.deleteMany()
  })

  afterAll(async () => {
    await prisma.invitation.deleteMany()
    await prisma.user.deleteMany()
    await prisma.organization.deleteMany()
  })

  it('正常系 — 有効なトークンで 200 と組織名・招待先メールを返す', async () => {
    const { org, inviter } = await createOrgAndInviter()
    const token = `valid-get-token-${Date.now()}`

    await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: 'invited@example.com',
        token,
        createdBy: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const req = new Request(`http://localhost/api/v1/invitations/${token}`) as NextRequest
    const res = await GET(req, { params: Promise.resolve({ token }) })

    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.data.organization.id).toBe(org.id)
    expect(json.data.organization.name).toBe('Test Org')
    expect(json.data.organization.slug).toBe(org.slug)
    expect(json.data.email).toBe('invited@example.com')
  })

  it('存在しないトークン — 404 NOT_FOUND を返す', async () => {
    const req = new Request(
      'http://localhost/api/v1/invitations/nonexistent-token',
    ) as NextRequest
    const res = await GET(req, { params: Promise.resolve({ token: 'nonexistent-token' }) })

    expect(res.status).toBe(404)

    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('期限切れトークン — 404 NOT_FOUND を返す', async () => {
    const { org, inviter } = await createOrgAndInviter()
    const token = `expired-get-token-${Date.now()}`

    await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: 'expired@example.com',
        token,
        createdBy: inviter.id,
        expiresAt: new Date(Date.now() - 1000),
      },
    })

    const req = new Request(`http://localhost/api/v1/invitations/${token}`) as NextRequest
    const res = await GET(req, { params: Promise.resolve({ token }) })

    expect(res.status).toBe(404)

    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('使用済みトークン — 404 NOT_FOUND を返す', async () => {
    const { org, inviter } = await createOrgAndInviter()
    const token = `used-get-token-${Date.now()}`

    await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: 'used@example.com',
        token,
        createdBy: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        usedAt: new Date(),
      },
    })

    const req = new Request(`http://localhost/api/v1/invitations/${token}`) as NextRequest
    const res = await GET(req, { params: Promise.resolve({ token }) })

    expect(res.status).toBe(404)

    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })
})
