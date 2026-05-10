import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Runs inside a transaction to make slug check + org creation atomic.
async function uniqueOrgSlug(tx: Prisma.TransactionClient, base: string): Promise<string> {
  let candidate = base
  let attempt = 2

  while (true) {
    const existing = await tx.organization.findUnique({ where: { slug: candidate } })
    if (!existing) return candidate
    candidate = `${base}-${attempt}`
    attempt++
  }
}

interface SignupBody {
  name: string
  email: string
  password: string
  organization:
    | { action: 'create'; name: string }
    | { action: 'join'; invite_token: string }
}

export async function POST(request: NextRequest) {
  let body: SignupBody

  try {
    body = (await request.json()) as SignupBody
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body.' } },
      { status: 400 },
    )
  }

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
    if (!organization.name || typeof organization.name !== 'string' || organization.name.trim() === '') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'organization.name is required.' } },
        { status: 400 },
      )
    }
  }

  if (organization.action === 'join') {
    if (
      !organization.invite_token ||
      typeof organization.invite_token !== 'string' ||
      organization.invite_token.trim() === ''
    ) {
      return NextResponse.json(
        {
          error: { code: 'VALIDATION_ERROR', message: 'organization.invite_token is required.' },
        },
        { status: 400 },
      )
    }
  }

  const normalizedEmail = email.toLowerCase()

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } })
  if (existingUser) {
    return NextResponse.json(
      { error: { code: 'CONFLICT', message: 'An account with this email already exists.' } },
      { status: 409 },
    )
  }

  if (organization.action === 'create') {
    const orgName = organization.name.trim()
    const passwordHash = await bcrypt.hash(password, 12)

    try {
      const result = await prisma.$transaction(async (tx) => {
        const baseSlug = slugify(orgName) || 'org'
        const slug = await uniqueOrgSlug(tx, baseSlug)

        const org = await tx.organization.create({
          data: { name: orgName, slug },
        })

        const user = await tx.user.create({
          data: {
            name: name.trim(),
            email: normalizedEmail,
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
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json(
          { error: { code: 'CONFLICT', message: 'An account with this email already exists.' } },
          { status: 409 },
        )
      }
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Failed to create account.' } },
        { status: 500 },
      )
    }
  }

  // organization.action === 'join'
  const inviteToken = organization.invite_token.trim()

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

  if (invitation.email !== normalizedEmail) {
    return NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'This invitation was sent to a different email address.',
        },
      },
      { status: 403 },
    )
  }

  // Hash password after invitation validation to avoid wasted computation on invalid tokens.
  const passwordHash = await bcrypt.hash(password, 12)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
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
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'An account with this email already exists.' } },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to create account.' } },
      { status: 500 },
    )
  }
}
