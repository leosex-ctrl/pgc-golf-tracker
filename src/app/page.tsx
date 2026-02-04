import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0D4D2B' }}>
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center text-white max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            PGC Performance Tracker
          </h1>
          <p className="text-lg md:text-xl mb-2 opacity-90">
            Portmarnock Golf Club
          </p>
          <p className="text-base md:text-lg mb-8 opacity-80">
            Track your performance. Improve your game. Support your team.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-3 rounded-lg font-semibold text-lg transition-all"
              style={{ backgroundColor: '#C9A227', color: '#000000' }}
            >
              Register
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 rounded-lg font-semibold text-lg border-2 border-white text-white hover:bg-white hover:text-green-900 transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-white opacity-60 text-sm">
        <p>Portmarnock Golf Club Performance Tracker</p>
      </footer>
    </div>
  )
}
