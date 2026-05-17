import Link from 'next/link'
import { AppLogo } from '@/components/ui/AppLogo'

interface InviteActionsProps {
  token: string
  organizationName: string
}

export function InviteActions({ token, organizationName }: InviteActionsProps) {
  const invitePath = `/invite/${token}`

  return (
    <div className="rounded-lg bg-white px-8 py-10 shadow-sm">
      <AppLogo />
      <p className="mb-2 text-center text-sm text-gray-500">招待</p>
      <h1 className="mb-6 text-center text-xl font-bold text-gray-900">
        「{organizationName}」に招待されています
      </h1>

      <div className="flex flex-col gap-3">
        <Link
          href={`/signup?redirect=${encodeURIComponent(invitePath)}`}
          className="block w-full rounded bg-gray-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          data-testid="signup-button"
        >
          アカウント作成して参加
        </Link>

        <Link
          href={`/login?redirect=${encodeURIComponent(invitePath)}`}
          className="block w-full rounded border border-gray-300 px-4 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          data-testid="login-button"
        >
          ログインして参加
        </Link>
      </div>
    </div>
  )
}
