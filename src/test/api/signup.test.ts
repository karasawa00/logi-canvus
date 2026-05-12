import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/v1/auth/signup/route'
import { prisma } from '@/lib/prisma'

// Invitation の createdBy には有効な User.id が必要なため、テスト用の招待者を用意する
async function createInviterAndOrg() {
  const org = await prisma.organization.create({
    data: { name: 'Inviter Org', slug: `inviter-org-${Date.now()}` },
  })
  const inviter = await prisma.user.create({
    data: {
      name: 'Inviter User',
      email: `inviter-${Date.now()}@example.com`,
      passwordHash: 'dummy-hash',
      orgId: org.id,
    },
  })
  return { org, inviter }
}

describe('POST /api/v1/auth/signup', () => {
  beforeEach(async () => {
    // 外部キー制約の順序に従って削除する
    await prisma.invitation.deleteMany()
    await prisma.user.deleteMany()
    await prisma.organization.deleteMany()
  })

  afterAll(async () => {
    await prisma.invitation.deleteMany()
    await prisma.user.deleteMany()
    await prisma.organization.deleteMany()
  })

  // -------------------------
  // 正常系
  // -------------------------

  it('create_org: 正常系 — 201 とユーザー・組織データを返す', async () => {
    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テスト太郎',
        email: 'test@example.com',
        password: 'password123',
        organization: { action: 'create', name: 'Test Org' },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(201)

    const json = await res.json()
    expect(json.data.user.name).toBe('テスト太郎')
    expect(json.data.user.email).toBe('test@example.com')
    expect(json.data.user.id).toBeDefined()
    expect(json.data.organization.name).toBe('Test Org')
    expect(json.data.organization.slug).toBeDefined()
    expect(json.data.organization.id).toBeDefined()
  })

  it('create_org: 正常系 — email が大文字混じりでも小文字に正規化して保存する', async () => {
    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Email正規化ユーザー',
        email: 'Test.User@Example.COM',
        password: 'password123',
        organization: { action: 'create', name: 'Normalization Org' },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(201)

    const json = await res.json()
    expect(json.data.user.email).toBe('test.user@example.com')
  })

  it('join_org: 正常系 — 有効な招待トークンで 201 とユーザー・組織データを返す', async () => {
    const { org, inviter } = await createInviterAndOrg()
    const token = `valid-token-${Date.now()}`

    await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: 'newmember@example.com',
        token,
        createdBy: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7日後
      },
    })

    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '新メンバー',
        email: 'newmember@example.com',
        password: 'password123',
        organization: { action: 'join', invite_token: token },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(201)

    const json = await res.json()
    expect(json.data.user.email).toBe('newmember@example.com')
    expect(json.data.organization.id).toBe(org.id)
    expect(json.data.organization.slug).toBe(org.slug)
  })

  it('join_org: 正常系 — 招待受け入れ後にトークンが使用済みになる', async () => {
    const { org, inviter } = await createInviterAndOrg()
    const token = `consume-token-${Date.now()}`

    await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: 'consume@example.com',
        token,
        createdBy: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'トークン消費ユーザー',
        email: 'consume@example.com',
        password: 'password123',
        organization: { action: 'join', invite_token: token },
      }),
    })

    await POST(req as NextRequest)

    const invitation = await prisma.invitation.findUnique({ where: { token } })
    expect(invitation?.usedAt).not.toBeNull()
  })

  // -------------------------
  // 異常系: email 重複
  // -------------------------

  it('email 重複 — 409 CONFLICT を返す', async () => {
    // 同じ email で先にユーザーを作成しておく
    const org = await prisma.organization.create({
      data: { name: 'Existing Org', slug: `existing-org-${Date.now()}` },
    })
    await prisma.user.create({
      data: {
        name: '既存ユーザー',
        email: 'duplicate@example.com',
        passwordHash: 'dummy-hash',
        orgId: org.id,
      },
    })

    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '重複ユーザー',
        email: 'duplicate@example.com',
        password: 'password123',
        organization: { action: 'create', name: 'Duplicate Org' },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(409)

    const json = await res.json()
    expect(json.error.code).toBe('CONFLICT')
  })

  it('email 重複（大文字 vs 小文字）— 正規化後に一致すると 409 CONFLICT を返す', async () => {
    const org = await prisma.organization.create({
      data: { name: 'Case Org', slug: `case-org-${Date.now()}` },
    })
    await prisma.user.create({
      data: {
        name: '既存ユーザー',
        email: 'casetest@example.com',
        passwordHash: 'dummy-hash',
        orgId: org.id,
      },
    })

    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '重複ユーザー大文字',
        email: 'CASETEST@EXAMPLE.COM',
        password: 'password123',
        organization: { action: 'create', name: 'Case Dup Org' },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(409)

    const json = await res.json()
    expect(json.error.code).toBe('CONFLICT')
  })

  // -------------------------
  // 異常系: join 時のトークン問題
  // -------------------------

  it('join_org: 存在しないトークン — 404 NOT_FOUND を返す', async () => {
    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テストユーザー',
        email: 'notoken@example.com',
        password: 'password123',
        organization: { action: 'join', invite_token: 'nonexistent-token-xyz' },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(404)

    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('join_org: 期限切れトークン — 404 NOT_FOUND を返す', async () => {
    const { org, inviter } = await createInviterAndOrg()
    const token = `expired-token-${Date.now()}`

    await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: 'expired@example.com',
        token,
        createdBy: inviter.id,
        expiresAt: new Date(Date.now() - 1000), // 過去の日時（期限切れ）
      },
    })

    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テストユーザー',
        email: 'expired@example.com',
        password: 'password123',
        organization: { action: 'join', invite_token: token },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(404)

    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('join_org: 使用済みトークン — 404 NOT_FOUND を返す', async () => {
    const { org, inviter } = await createInviterAndOrg()
    const token = `used-token-${Date.now()}`

    await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: 'usedtoken@example.com',
        token,
        createdBy: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        usedAt: new Date(), // 使用済み
      },
    })

    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テストユーザー',
        email: 'usedtoken@example.com',
        password: 'password123',
        organization: { action: 'join', invite_token: token },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(404)

    const json = await res.json()
    expect(json.error.code).toBe('NOT_FOUND')
  })

  it('join_org: リクエストの email が招待の宛先 email と不一致 — 403 FORBIDDEN を返す', async () => {
    const { org, inviter } = await createInviterAndOrg()
    const token = `mismatch-token-${Date.now()}`

    await prisma.invitation.create({
      data: {
        orgId: org.id,
        email: 'invited@example.com', // 招待先 email
        token,
        createdBy: inviter.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テストユーザー',
        email: 'different@example.com', // 招待と異なる email
        password: 'password123',
        organization: { action: 'join', invite_token: token },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(403)

    const json = await res.json()
    expect(json.error.code).toBe('FORBIDDEN')
  })

  // -------------------------
  // 異常系: バリデーション
  // -------------------------

  it('name が空文字 — 400 VALIDATION_ERROR を返す', async () => {
    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        email: 'test@example.com',
        password: 'password123',
        organization: { action: 'create', name: 'Test Org' },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('name が空白のみ — 400 VALIDATION_ERROR を返す', async () => {
    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '   ',
        email: 'test@example.com',
        password: 'password123',
        organization: { action: 'create', name: 'Test Org' },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('email が空文字 — 400 VALIDATION_ERROR を返す', async () => {
    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テストユーザー',
        email: '',
        password: 'password123',
        organization: { action: 'create', name: 'Test Org' },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('email がフォーマット不正（@なし）— 400 VALIDATION_ERROR を返す', async () => {
    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テストユーザー',
        email: 'not-an-email',
        password: 'password123',
        organization: { action: 'create', name: 'Test Org' },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('password が空文字 — 400 VALIDATION_ERROR を返す', async () => {
    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テストユーザー',
        email: 'test@example.com',
        password: '',
        organization: { action: 'create', name: 'Test Org' },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('password が 7 文字（最低 8 文字未満）— 400 VALIDATION_ERROR を返す', async () => {
    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テストユーザー',
        email: 'test@example.com',
        password: '1234567', // 7文字
        organization: { action: 'create', name: 'Test Org' },
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('organization フィールドが欠損 — 400 VALIDATION_ERROR を返す', async () => {
    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'テストユーザー',
        email: 'test@example.com',
        password: 'password123',
      }),
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な JSON ボディ — 400 VALIDATION_ERROR を返す', async () => {
    const req = new Request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'this is not json{{{',
    })

    const res = await POST(req as NextRequest)
    expect(res.status).toBe(400)

    const json = await res.json()
    expect(json.error.code).toBe('VALIDATION_ERROR')
  })
})
