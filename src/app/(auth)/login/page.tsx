import { LoginForm } from './LoginForm'

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect } = await searchParams
  const redirectTo = redirect ?? '/'

  return <LoginForm redirectTo={redirectTo} />
}
