interface SignupOrganizationCreate {
  action: 'create'
  name: string
}

interface SignupOrganizationJoin {
  action: 'join'
  invite_token: string
}

export interface SignupRequest {
  name: string
  email: string
  password: string
  organization: SignupOrganizationCreate | SignupOrganizationJoin
}

export interface SignupResponse {
  data: {
    user: { id: string; name: string; email: string }
    organization: { id: string; name: string; slug: string }
  }
}

export interface SignupErrorResponse {
  error: { code: string; message: string }
}

export async function signup(body: SignupRequest): Promise<SignupResponse> {
  const res = await fetch('/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorData = (await res.json()) as SignupErrorResponse
    throw errorData
  }

  return res.json() as Promise<SignupResponse>
}
