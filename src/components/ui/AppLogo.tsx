export function AppLogo() {
  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900">
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M4 6h12M4 10h8M4 14h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-medium tracking-wide text-gray-600">logi-canvus</p>
    </div>
  )
}
