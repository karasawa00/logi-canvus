import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { InviteActions } from './InviteActions'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: true },
  })

  const isInvalid =
    !invitation || invitation.usedAt !== null || invitation.expiresAt < new Date()

  if (isInvalid) {
    return (
      <div className="rounded-lg bg-white p-8 shadow">
        <h1 className="mb-4 text-center text-xl font-bold text-gray-900">招待リンクが無効です</h1>
        <p className="text-center text-sm text-gray-500" data-testid="error-message">
          この招待リンクは無効か期限切れです。招待者に新しいリンクを送ってもらってください。
        </p>
      </div>
    )
  }

  const session = await auth()

  if (session?.user) {
    const userEmail = session.user.email?.toLowerCase() ?? ''

    if (invitation.email !== userEmail) {
      return (
        <div className="rounded-lg bg-white p-8 shadow">
          <h1 className="mb-4 text-center text-xl font-bold text-gray-900">
            招待の受け入れができません
          </h1>
          <p className="text-center text-sm text-gray-500" data-testid="error-message">
            この招待は別のメールアドレス宛てです。招待された本人のアカウントでログインしてください。
          </p>
        </div>
      )
    }

    // Accept the invitation and redirect to the org dashboard.
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

    redirect(`/${invitation.organization.slug}`)
  }

  return (
    <InviteActions token={token} organizationName={invitation.organization.name} />
  )
}
