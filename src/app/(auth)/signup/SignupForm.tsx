'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { signup } from '@/lib/api/auth'

interface Step1Data {
  name: string
  email: string
  password: string
  passwordConfirm: string
}

interface SignupFormProps {
  initialInviteToken: string
}

export function SignupForm({ initialInviteToken }: SignupFormProps) {
  const router = useRouter()

  const [step, setStep] = useState<1 | 2>(1)

  const [step1, setStep1] = useState<Step1Data>({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
  })

  const [orgAction, setOrgAction] = useState<'create' | 'join'>(
    initialInviteToken ? 'join' : 'create',
  )
  const [orgName, setOrgName] = useState('')
  const [inviteToken, setInviteToken] = useState(initialInviteToken)

  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  function handleStep1Submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!step1.name.trim()) {
      setError('名前を入力してください。')
      return
    }
    if (!step1.email.trim()) {
      setError('メールアドレスを入力してください。')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(step1.email)) {
      setError('有効なメールアドレスを入力してください。')
      return
    }
    if (step1.password.length < 8) {
      setError('パスワードは8文字以上で入力してください。')
      return
    }
    if (step1.password !== step1.passwordConfirm) {
      setError('パスワードが一致しません。')
      return
    }

    setStep(2)
  }

  async function handleStep2Submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (orgAction === 'create' && !orgName.trim()) {
      setError('組織名を入力してください。')
      return
    }
    if (orgAction === 'join' && !inviteToken.trim()) {
      setError('招待コードを入力してください。')
      return
    }

    setIsLoading(true)

    try {
      const organization =
        orgAction === 'create'
          ? { action: 'create' as const, name: orgName.trim() }
          : { action: 'join' as const, invite_token: inviteToken.trim() }

      const result = await signup({
        name: step1.name.trim(),
        email: step1.email.trim(),
        password: step1.password,
        organization,
      })

      const signInResult = await signIn('credentials', {
        email: step1.email.trim(),
        password: step1.password,
        redirect: false,
      })

      if (signInResult?.error) {
        setError(
          'アカウントの作成は完了しましたが、ログインに失敗しました。ログイン画面からサインインしてください。',
        )
        setIsLoading(false)
        return
      }

      router.push(`/${result.data.organization.slug}`)
    } catch (err: unknown) {
      setIsLoading(false)

      if (
        err !== null &&
        typeof err === 'object' &&
        'error' in err &&
        err.error !== null &&
        typeof err.error === 'object' &&
        'code' in err.error
      ) {
        const code = (err.error as { code: string }).code
        if (code === 'CONFLICT') {
          setError('このメールアドレスはすでに登録されています。')
          setStep(1)
        } else if (code === 'NOT_FOUND') {
          setError('招待コードが無効か期限切れです。')
        } else if (code === 'FORBIDDEN') {
          setError('この招待は別のメールアドレス宛てです。')
        } else {
          setError('登録に失敗しました。時間をおいて再度お試しください。')
        }
      } else {
        setError('登録に失敗しました。時間をおいて再度お試しください。')
      }
    }
  }

  const inputClass =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500'
  const labelClass = 'mb-1 block text-sm font-medium text-gray-700'
  const fieldClass = 'mb-4'

  return (
    <div className="rounded-lg bg-white p-8 shadow">
      <h1 className="mb-1 text-center text-2xl font-bold">アカウント作成</h1>
      <p className="mb-6 text-center text-sm text-gray-400">ステップ {step} / 2</p>

      {step === 1 && (
        <form onSubmit={handleStep1Submit} noValidate data-testid="signup-step1-form">
          <div className={fieldClass}>
            <label htmlFor="name" className={labelClass}>
              名前
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              autoFocus
              value={step1.name}
              onChange={(e) => setStep1((prev) => ({ ...prev, name: e.target.value }))}
              className={inputClass}
              placeholder="田中太郎"
              data-testid="name-input"
            />
          </div>

          <div className={fieldClass}>
            <label htmlFor="email" className={labelClass}>
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={step1.email}
              onChange={(e) => setStep1((prev) => ({ ...prev, email: e.target.value }))}
              className={inputClass}
              placeholder="you@example.com"
              data-testid="email-input"
            />
          </div>

          <div className={fieldClass}>
            <label htmlFor="password" className={labelClass}>
              パスワード
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={step1.password}
              onChange={(e) => setStep1((prev) => ({ ...prev, password: e.target.value }))}
              className={inputClass}
              placeholder="••••••••（8文字以上）"
              data-testid="password-input"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password-confirm" className={labelClass}>
              パスワード（確認）
            </label>
            <input
              id="password-confirm"
              type="password"
              autoComplete="new-password"
              value={step1.passwordConfirm}
              onChange={(e) => setStep1((prev) => ({ ...prev, passwordConfirm: e.target.value }))}
              className={inputClass}
              placeholder="••••••••"
              data-testid="password-confirm-input"
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
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            data-testid="next-button"
          >
            次へ
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleStep2Submit} noValidate data-testid="signup-step2-form">
          <div className="mb-4 space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 hover:border-blue-400 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
              <input
                type="radio"
                name="org-action"
                value="create"
                checked={orgAction === 'create'}
                onChange={() => setOrgAction('create')}
                className="mt-0.5"
                data-testid="org-create-radio"
              />
              <span className="text-sm font-medium text-gray-800">新しい組織を作成する</span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 hover:border-blue-400 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
              <input
                type="radio"
                name="org-action"
                value="join"
                checked={orgAction === 'join'}
                onChange={() => setOrgAction('join')}
                className="mt-0.5"
                data-testid="org-join-radio"
              />
              <span className="text-sm font-medium text-gray-800">既存の組織に参加する</span>
            </label>
          </div>

          {orgAction === 'create' && (
            <div className="mb-4">
              <label htmlFor="org-name" className={labelClass}>
                組織名
              </label>
              <input
                id="org-name"
                type="text"
                autoComplete="organization"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                disabled={isLoading}
                className={inputClass}
                placeholder="Acme Inc"
                data-testid="org-name-input"
              />
            </div>
          )}

          {orgAction === 'join' && (
            <div className="mb-4">
              <label htmlFor="invite-token" className={labelClass}>
                招待コード
              </label>
              <input
                id="invite-token"
                type="text"
                autoComplete="off"
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                disabled={isLoading}
                className={inputClass}
                placeholder="招待URLに含まれるコードを入力"
                data-testid="invite-token-input"
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600"
              data-testid="error-message"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="submit-button"
            >
              {isLoading ? '登録中...' : '登録する'}
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => {
                setError(null)
                setStep(1)
              }}
              className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="back-button"
            >
              戻る
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-gray-500">
        すでにアカウントをお持ちの方は{' '}
        <Link href="/login" className="font-medium text-blue-600 hover:underline">
          ログイン
        </Link>
      </p>
    </div>
  )
}
