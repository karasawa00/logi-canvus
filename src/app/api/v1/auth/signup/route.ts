import { NextResponse } from 'next/server'

// Signup endpoint - full implementation in future issue
export async function POST() {
  return NextResponse.json(
    { error: { code: 'NOT_IMPLEMENTED', message: 'Signup not yet implemented' } },
    { status: 501 },
  )
}
