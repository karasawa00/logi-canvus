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
    <div className="rounded-lg bg-white p-8 shadow">
      <h1 className="mb-6 text-center text-2xl font-bold">logi-canvus</h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="you@example.com"
            data-testid="email-input"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            placeholder="••••••••"
            data-testid="password-input"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600"
            data-testid="error-message"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
