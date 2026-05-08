'use client'

import { useEffect } from 'react'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex-1 overflow-auto p-8">
      <h2 className="text-xl font-bold text-red-600">エラーが発生しました</h2>
      <p className="mt-2 text-gray-600">{error.message}</p>
      <button
        className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        onClick={reset}
      >
        再試行
      </button>
    </main>
  )
}
