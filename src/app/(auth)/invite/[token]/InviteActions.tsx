'use client'

import Link from 'next/link'

interface InviteActionsProps {
  token: string
  organizationName: string
}

export function InviteActions({ token, organizationName }: InviteActionsProps) {
  const invitePath = `/invite/${token}`

  return (
    <div className="rounded-lg bg-white p-8 shadow">
      <p className="mb-2 text-center text-sm text-gray-500">招待</p>
      <h1 className="mb-6 text-center text-xl font-bold text-gray-900">
        「{organizationName}」に招待されています
      </h1>

      <div className="flex flex-col gap-3">
        <Link
          href={`/signup?redirect=${encodeURIComponent(invitePath)}`}
          className="block w-full rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          data-testid="signup-button"
        >
          アカウント作成して参加
        </Link>

        <Link
          href={`/login?redirect=${encodeURIComponent(invitePath)}`}
          className="block w-full rounded-md border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          data-testid="login-button"
        >
          ログインして参加
        </Link>
      </div>
    </div>
  )
}
