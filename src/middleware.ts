import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup', '/invite']
const PUBLIC_PATH_PREFIXES = ['/invite/']

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isLoginOrSignup(pathname: string): boolean {
  return pathname === '/login' || pathname === '/signup'
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth

  // Redirect authenticated users away from login/signup/root to their org dashboard
  if (isAuthenticated && (isLoginOrSignup(pathname) || pathname === '/')) {
    const orgSlug = req.auth?.user?.orgSlug
    if (orgSlug) {
      return NextResponse.redirect(new URL(`/${orgSlug}`, req.url))
    }
    // If orgSlug is unavailable (e.g. user just left org), let the request through
    return NextResponse.next()
  }

  // Redirect unauthenticated users from protected routes to login
  if (!isAuthenticated && !isPublicPath(pathname)) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
