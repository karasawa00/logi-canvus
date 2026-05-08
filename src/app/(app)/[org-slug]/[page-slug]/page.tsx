import type { Metadata } from 'next'

interface PageEditorPageProps {
  params: Promise<{ 'org-slug': string; 'page-slug': string }>
}

export async function generateMetadata({ params }: PageEditorPageProps): Promise<Metadata> {
  const { 'page-slug': pageSlug } = await params
  return {
    title: `${pageSlug} - logi-canvus`,
  }
}

export default async function PageEditorPage({ params }: PageEditorPageProps) {
  const { 'org-slug': orgSlug, 'page-slug': pageSlug } = await params

  return (
    <main className="flex-1 overflow-auto p-8">
      <h1 className="text-2xl font-bold">ページエディタ</h1>
      <p className="mt-2 text-gray-500">
        組織: {orgSlug} / ページ: {pageSlug}（実装予定）
      </p>
    </main>
  )
}
