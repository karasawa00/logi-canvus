import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ token: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
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

  return NextResponse.json({
    data: {
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        slug: invitation.organization.slug,
      },
      email: invitation.email,
    },
  })
}
