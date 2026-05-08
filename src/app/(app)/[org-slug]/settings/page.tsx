interface SettingsPageProps {
  params: Promise<{ 'org-slug': string }>
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { 'org-slug': orgSlug } = await params

  return (
    <main className="flex-1 overflow-auto p-8">
      <h1 className="text-2xl font-bold">組織設定</h1>
      <p className="mt-2 text-gray-500">組織: {orgSlug}（実装予定）</p>
    </main>
  )
}
