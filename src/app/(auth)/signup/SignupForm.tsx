'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { signup } from '@/lib/api/auth'
import { AppLogo } from '@/components/ui/AppLogo'

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
    'w-full border-b border-gray-300 bg-transparent py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none disabled:opacity-50 disabled:text-gray-400'
  const labelClass = 'mb-1 block text-xs font-medium text-gray-500'
  const fieldClass = 'mb-5'

  return (
    <div className="rounded-lg bg-white px-8 py-10 shadow-sm">
      <AppLogo />

      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">アカウント作成</h1>
        <p className="mt-1 text-sm text-gray-400">ステップ {step} / 2</p>
      </div>

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
              disabled={isLoading}
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
              disabled={isLoading}
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
              disabled={isLoading}
              className={inputClass}
              placeholder="••••••••（8文字以上）"
              data-testid="password-input"
            />
          </div>

          <div className="mb-8">
            <label htmlFor="password-confirm" className={labelClass}>
              パスワード（確認）
            </label>
            <input
              id="password-confirm"
              type="password"
              autoComplete="new-password"
              value={step1.passwordConfirm}
              onChange={(e) => setStep1((prev) => ({ ...prev, passwordConfirm: e.target.value }))}
              disabled={isLoading}
              className={inputClass}
              placeholder="••••••••"
              data-testid="password-confirm-input"
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
            className="flex w-full items-center justify-center rounded bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            data-testid="next-button"
          >
            次へ
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleStep2Submit} noValidate data-testid="signup-step2-form">
          <div className="mb-5 space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded border border-gray-200 p-3 hover:border-gray-400 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50">
              <input
                type="radio"
                name="org-action"
                value="create"
                checked={orgAction === 'create'}
                onChange={() => setOrgAction('create')}
                className="mt-0.5 accent-gray-900"
                data-testid="org-create-radio"
              />
              <span className="text-sm font-medium text-gray-800">新しい組織を作成する</span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded border border-gray-200 p-3 hover:border-gray-400 has-[:checked]:border-gray-900 has-[:checked]:bg-gray-50">
              <input
                type="radio"
                name="org-action"
                value="join"
                checked={orgAction === 'join'}
                onChange={() => setOrgAction('join')}
                className="mt-0.5 accent-gray-900"
                data-testid="org-join-radio"
              />
              <span className="text-sm font-medium text-gray-800">既存の組織に参加する</span>
            </label>
          </div>

          {orgAction === 'create' && (
            <div className="mb-5">
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
            <div className="mb-5">
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
              className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600"
              data-testid="error-message"
            >
              {error}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center rounded bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
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
              className="flex w-full items-center justify-center rounded border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
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
