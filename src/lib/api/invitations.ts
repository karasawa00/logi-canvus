export interface InvitationInfo {
  organization: { id: string; name: string; slug: string }
  email: string
}

export interface InvitationInfoResponse {
  data: InvitationInfo
}

export interface AcceptInvitationResponse {
  data: {
    organization: { id: string; name: string; slug: string }
  }
}

export interface ApiErrorResponse {
  error: { code: string; message: string }
}

export async function getInvitation(token: string): Promise<InvitationInfoResponse> {
  const res = await fetch(`/api/v1/invitations/${token}`)

  if (!res.ok) {
    const errorData = (await res.json()) as ApiErrorResponse
    throw errorData
  }

  return res.json() as Promise<InvitationInfoResponse>
}

export async function acceptInvitation(token: string): Promise<AcceptInvitationResponse> {
  const res = await fetch(`/api/v1/invitations/${token}/accept`, {
    method: 'POST',
  })

  if (!res.ok) {
    const errorData = (await res.json()) as ApiErrorResponse
    throw errorData
  }

  return res.json() as Promise<AcceptInvitationResponse>
}
