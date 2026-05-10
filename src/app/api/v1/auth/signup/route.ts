import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Helper: generate a URL-safe slug from an organization name.
// Example: "Acme Inc" → "acme-inc"
// ---------------------------------------------------------------------------
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric chars except hyphens/spaces
    .replace(/\s+/g, '-') // collapse whitespace to hyphens
    .replace(/-+/g, '-') // collapse repeated hyphens
    .replace(/^-|-$/g, '') // trim leading/trailing hyphens
}

// ---------------------------------------------------------------------------
// Helper: ensure the slug is unique within the organizations table.
// If "acme-inc" is taken, try "acme-inc-2", "acme-inc-3", etc.
// ---------------------------------------------------------------------------
async function uniqueOrgSlug(base: string): Promise<string> {
  let candidate = base
  let attempt = 2

  while (true) {
    const existing = await prisma.organization.findUnique({ where: { slug: candidate } })
    if (!existing) return candidate
    candidate = `${base}-${attempt}`
    attempt++
  }
}

// ---------------------------------------------------------------------------
// Request body shape (matches doc/api-design.md §2-1)
// ---------------------------------------------------------------------------
interface SignupBody {
  name: string
  email: string
  password: string
  organization:
    | { action: 'create'; name: string }
    | { action: 'join'; invite_token: string }
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/signup
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  let body: SignupBody

  // 1. Parse JSON body
  try {
    body = (await request.json()) as SignupBody
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body.' } },
      { status: 400 },
    )
  }

  // 2. Validate required top-level fields
  const { name, email, password, organization } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'name is required.' } },
      { status: 400 },
    )
  }

  if (!email || typeof email !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'email is required.' } },
      { status: 400 },
    )
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'email is not valid.' } },
      { status: 400 },
    )
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'password is required and must be at least 8 characters.',
        },
      },
      { status: 400 },
    )
  }

  if (!organization || !organization.action) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'organization.action is required ("create" or "join").',
        },
      },
      { status: 400 },
    )
  }

  if (organization.action !== 'create' && organization.action !== 'join') {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'organization.action must be "create" or "join".',
        },
      },
      { status: 400 },
    )
  }

  if (organization.action === 'create') {
    const orgName = (organization as { action: 'create'; name: string }).name
    if (!orgName || typeof orgName !== 'string' || orgName.trim() === '') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'organization.name is required.' } },
        { status: 400 },
      )
    }
  }

  if (organization.action === 'join') {
    const token = (organization as { action: 'join'; invite_token: string }).invite_token
    if (!token || typeof token !== 'string' || token.trim() === '') {
      return NextResponse.json(
        {
          error: { code: 'VALIDATION_ERROR', message: 'organization.invite_token is required.' },
        },
        { status: 400 },
      )
    }
  }

  // 3. Check for duplicate email
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return NextResponse.json(
      { error: { code: 'CONFLICT', message: 'An account with this email already exists.' } },
      { status: 409 },
    )
  }

  // 4. Hash the password
  const passwordHash = await bcrypt.hash(password, 12)

  // 5. Branch on organization action
  if (organization.action === 'create') {
    const orgName = (organization as { action: 'create'; name: string }).name.trim()

    try {
      const baseSlug = slugify(orgName) || 'org'
      const slug = await uniqueOrgSlug(baseSlug)

      // Create org + user in a single transaction
      const result = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: orgName, slug },
        })

        const user = await tx.user.create({
          data: {
            name: name.trim(),
            email,
            passwordHash,
            orgId: org.id,
          },
        })

        return { org, user }
      })

      return NextResponse.json(
        {
          data: {
            user: { id: result.user.id, name: result.user.name, email: result.user.email },
            organization: { id: result.org.id, name: result.org.name, slug: result.org.slug },
          },
        },
        { status: 201 },
      )
    } catch {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to create account.' } },
        { status: 500 },
      )
    }
  }

  // organization.action === 'join'
  const inviteToken = (organization as { action: 'join'; invite_token: string }).invite_token.trim()

  // 6. Validate the invitation token
  const invitation = await prisma.invitation.findUnique({
    where: { token: inviteToken },
    include: { organization: true },
  })

  if (!invitation) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Invitation token is invalid.' } },
      { status: 404 },
    )
  }

  if (invitation.usedAt !== null) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Invitation token has already been used.' } },
      { status: 404 },
    )
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Invitation token has expired.' } },
      { status: 404 },
    )
  }

  // 7. Create user and mark invitation used in one transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email,
          passwordHash,
          orgId: invitation.orgId,
        },
      })

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      })

      return { user, org: invitation.organization }
    })

    return NextResponse.json(
      {
        data: {
          user: { id: result.user.id, name: result.user.name, email: result.user.email },
          organization: {
            id: result.org.id,
            name: result.org.name,
            slug: result.org.slug,
          },
        },
      },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create account.' } },
      { status: 500 },
    )
  }
}
