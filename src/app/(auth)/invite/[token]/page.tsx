interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params

  return (
    <div className="rounded-lg bg-white p-8 shadow">
      <h1 className="mb-6 text-2xl font-bold text-center">招待受け入れ</h1>
      <p className="text-center text-gray-500">
        招待トークン: {token}（実装予定）
      </p>
    </div>
  )
}
