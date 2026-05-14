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

  const { token } = await params

  const invitation = await prisma.invitation.findUnique({
    where: { token },
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

  const userEmail = session.user.email?.toLowerCase() ?? ''
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

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.user.id },
      data: { orgId: invitation.orgId },
    })

    await tx.invitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    })
  })

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
