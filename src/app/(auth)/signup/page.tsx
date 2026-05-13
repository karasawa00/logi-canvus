import { Suspense } from 'react'
import { SignupForm } from './SignupForm'

interface SignupPageProps {
  searchParams: Promise<{ redirect?: string }>
}

function extractInviteToken(redirect: string | undefined): string {
  if (!redirect) return ''
  const match = /^\/invite\/([^/?#]+)/.exec(redirect)
  return match ? match[1] : ''
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { redirect } = await searchParams
  const initialInviteToken = extractInviteToken(redirect)

  return (
    <Suspense
      fallback={
        <div className="rounded-lg bg-white p-8 shadow text-center text-gray-400">
          読み込み中...
        </div>
      }
    >
      <SignupForm initialInviteToken={initialInviteToken} />
    </Suspense>
  )
}
