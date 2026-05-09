import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Public routes that don't require authentication
const PUBLIC_PATHS = ['/login', '/signup']
const PUBLIC_PATH_PREFIXES = ['/invite/']

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

function isAuthPath(pathname: string): boolean {
  return pathname === '/login' || pathname === '/signup'
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth

  // Redirect authenticated users away from login/signup to their org dashboard
  if (isAuthenticated && isAuthPath(pathname)) {
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
  // Exclude API routes, Next.js internals, and static assets
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
