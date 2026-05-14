'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { acceptInvitation } from '@/lib/api/invitations'
import type { ApiErrorResponse } from '@/lib/api/invitations'

interface InviteAcceptButtonProps {
  token: string
  organizationName: string
  orgSlug: string
}

export function InviteAcceptButton({ token, organizationName, orgSlug }: InviteAcceptButtonProps) {
  const { update } = useSession()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleAccept() {
    setIsLoading(true)
    setError(null)
    try {
      await acceptInvitation(token)
      await update()
      router.push(`/${orgSlug}`)
    } catch (err) {
      const apiError = err as ApiErrorResponse
      if (apiError?.error?.code === 'CONFLICT') {
        setError('既に別の組織に所属しています。現在の組織を脱退してから参加してください。')
      } else {
        setError('エラーが発生しました。もう一度お試しください。')
      }
      setIsLoading(false)
    }
  }

  return (
    <div className="rounded-lg bg-white p-8 shadow">
      <p className="mb-2 text-center text-sm text-gray-500">招待</p>
      <h1 className="mb-6 text-center text-xl font-bold text-gray-900">
        「{organizationName}」に招待されています
      </h1>

      {error && (
        <p className="mb-4 text-center text-sm text-red-600" data-testid="error-message">
          {error}
        </p>
      )}

      <button
        onClick={handleAccept}
        disabled={isLoading}
        className="block w-full rounded-md bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="accept-button"
      >
        {isLoading ? '処理中...' : '組織に参加する'}
      </button>
    </div>
  )
}
