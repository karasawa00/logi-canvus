export default function Loading() {
  return (
    <main className="flex-1 overflow-auto p-8">
      <div className="animate-pulse">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="mt-4 h-4 w-48 rounded bg-gray-200" />
      </div>
    </main>
  )
}
