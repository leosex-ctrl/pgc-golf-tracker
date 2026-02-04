import Link from 'next/link'

export default function AccountVerifiedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0D4D2B' }}>
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div
          className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#C9A227' }}
        >
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-4" style={{ color: '#0D4D2B' }}>
          Account Verified
        </h1>

        <p className="text-gray-600 mb-8 leading-relaxed">
          Your account has been successfully confirmed. You can now log in to the PGC Performance Tracker.
        </p>

        <Link
          href="/login"
          className="inline-block px-8 py-3 rounded-lg font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: '#0D4D2B' }}
        >
          Go to Login
        </Link>

        <p className="mt-6 text-sm text-gray-500">
          Portmarnock Golf Club
        </p>
      </div>
    </div>
  )
}
