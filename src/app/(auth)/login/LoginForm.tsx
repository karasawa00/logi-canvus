'use client'

import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface LoginFormProps {
  redirectTo: string
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('メールアドレスを入力してください。')
      return
    }
    if (!password) {
      setError('パスワードを入力してください。')
      return
    }

    setIsLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setIsLoading(false)

    if (result?.error) {
      // CredentialsSignin covers both wrong credentials and org-left users,
      // because the authorize() function returns null in both cases.
      setError('メールアドレスまたはパスワードが正しくありません。')
      return
    }

    router.push(redirectTo)
  }

  return (
    <div className="rounded-lg bg-white px-8 py-10 shadow-sm">
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900">
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 6h12M4 10h8M4 14h10"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="text-sm font-medium tracking-wide text-gray-600">logi-canvus</p>
      </div>

      <h1 className="mb-8 text-center text-2xl font-bold tracking-tight text-gray-900">ログイン</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-6">
          <label htmlFor="email" className="mb-1 block text-xs font-medium text-gray-500">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="w-full border-b border-gray-300 bg-transparent py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none disabled:opacity-50 disabled:text-gray-400"
            placeholder="you@example.com"
            data-testid="email-input"
          />
        </div>

        <div className="mb-8">
          <label htmlFor="password" className="mb-1 block text-xs font-medium text-gray-500">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="w-full border-b border-gray-300 bg-transparent py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none disabled:opacity-50 disabled:text-gray-400"
            placeholder="••••••••"
            data-testid="password-input"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600"
            data-testid="error-message"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          data-testid="submit-button"
        >
          {isLoading ? 'ログイン中...' : 'ログイン'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        アカウントをお持ちでない方は{' '}
        <Link href="/signup" className="font-medium text-blue-600 hover:underline">
          アカウント作成
        </Link>
      </p>
    </div>
  )
}
