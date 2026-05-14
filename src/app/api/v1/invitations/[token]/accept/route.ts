import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ token: string }>
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await auth()

  if (!session?.user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
      { status: 401 },
    )
  }

  if (!session.user.email) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
      { status: 401 },
    )
  }

  if (session.user.orgId !== null && session.user.orgId !== undefined) {
    return NextResponse.json(
      { error: { code: 'CONFLICT', message: 'User already belongs to an organization.' } },
      { status: 409 },
    )
  }

  const { token } = await params

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  })

  if (!invitation || invitation.usedAt !== null || invitation.expiresAt < new Date()) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Invitation token is invalid or expired.' } },
      { status: 404 },
    )
  }

  const userEmail = session.user.email.toLowerCase()
  if (invitation.email !== userEmail) {
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

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: { orgId: invitation.orgId },
      })
      // updateMany with usedAt: null prevents double-acceptance under concurrent requests
      const updated = await tx.invitation.updateMany({
        where: { id: invitation.id, usedAt: null },
        data: { usedAt: new Date() },
      })
      if (updated.count === 0) {
        throw new Error('ALREADY_ACCEPTED')
      }
    })
  } catch (e) {
    if (e instanceof Error && e.message === 'ALREADY_ACCEPTED') {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: 'Invitation has already been accepted.' } },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Unexpected error.' } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: {
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        slug: invitation.organization.slug,
      },
    },
  })
}
