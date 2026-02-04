'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { PlusCircle, BarChart3, Flag, ChevronRight, Sun, Cloud, CloudRain, Wind, Thermometer } from 'lucide-react'
import { ScoreTrendChart } from '@/components/DashboardCharts'
import GoalsSection from '@/components/GoalsSection'

// ============================================
// TYPES - STRICT SCHEMA MATCH
// ============================================

interface UserProfile {
  id: string
  full_name: string
  handicap_index: number | null
  home_club: string | null
}

interface Round {
  id: string
  date_of_round: string
  total_strokes: number | null
  course_id: string
  weather: string | null
  temp_c: number | null
  wind_speed_kph: number | null
  courses: {
    name: string
  }
}

// ============================================
// WEATHER ICON HELPER
// ============================================

const getWeatherIcon = (weather: string | null) => {
  if (!weather) return null
  const w = weather.toLowerCase()
  if (w.includes('rain')) return <CloudRain className="w-4 h-4 text-blue-400" />
  if (w.includes('sun') || w.includes('clear')) return <Sun className="w-4 h-4 text-yellow-400" />
  if (w.includes('wind')) return <Wind className="w-4 h-4 text-blue-300" />
  if (w.includes('cloud') || w.includes('overcast')) return <Cloud className="w-4 h-4 text-gray-400" />
  return <Cloud className="w-4 h-4 text-gray-400" />
}

// ============================================
// COMPONENT
// ============================================

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [totalRounds, setTotalRounds] = useState(0)
  const [recentRounds, setRecentRounds] = useState<Round[]>([])
  const [chartData, setChartData] = useState<{ date: string; score: number }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        console.error('Supabase Error:', JSON.stringify(authError, null, 2))
        router.push('/login')
        return
      }

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, handicap_index, home_club')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Supabase Error:', JSON.stringify(profileError, null, 2))
      } else if (profileData) {
        setProfile(profileData)
      }

      // Count total rounds
      const { count, error: countError } = await supabase
        .from('rounds')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      if (countError) {
        console.error('Supabase Error:', JSON.stringify(countError, null, 2))
      } else if (count !== null) {
        setTotalRounds(count)
      }

      // ============================================
      // FETCH RECENT ROUNDS WITH COURSE JOIN
      // Schema: rounds(*, courses(name))
      // ============================================
      const { data: roundsData, error: roundsError } = await supabase
        .from('rounds')
        .select('*, courses(name)')
        .eq('user_id', user.id)
        .order('date_of_round', { ascending: false })
        .limit(10)

      if (roundsError) {
        console.error('Supabase Error:', JSON.stringify(roundsError, null, 2))
      } else if (roundsData) {
        setRecentRounds(roundsData.slice(0, 5) as Round[])

        // Prepare chart data (oldest to newest for trend visualization)
        const chartRounds = (roundsData as Round[])
          .filter(r => r.total_strokes !== null && r.total_strokes > 0)
          .reverse()
          .map(r => ({
            date: new Date(r.date_of_round).toLocaleDateString('en-IE', {
              day: 'numeric',
              month: 'short',
            }),
            score: r.total_strokes!,
          }))
        setChartData(chartRounds)
      }

    } catch (err) {
      console.error('Supabase Error:', JSON.stringify(err, null, 2))
    } finally {
      setIsLoading(false)
    }
  }

  // ============================================
  // LOADING STATE
  // ============================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div
            className="w-10 h-10 border-4 border-white/20 rounded-full animate-spin mx-auto mb-4"
            style={{ borderTopColor: '#C9A227' }}
          />
          <p className="text-white/60">Loading...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#C9A227' }}>
          Dashboard
        </h1>
        <p className="text-white/60 mt-1">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Golfer'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="glass-card p-6">
          <p className="text-sm text-white/60 uppercase tracking-wide font-medium">Handicap Index</p>
          <p className="text-3xl font-bold mt-2" style={{ color: '#C9A227' }}>
            {profile?.handicap_index?.toFixed(1) || '—'}
          </p>
        </div>

        <div className="glass-card p-6">
          <p className="text-sm text-white/60 uppercase tracking-wide font-medium">Rounds Played</p>
          <p className="text-3xl font-bold text-white mt-2">
            {totalRounds}
          </p>
        </div>

        <div className="glass-card p-6">
          <p className="text-sm text-white/60 uppercase tracking-wide font-medium">Home Club</p>
          <p className="text-lg font-bold text-white mt-2 truncate">
            {profile?.home_club || '—'}
          </p>
        </div>
      </div>

      {/* Score Trend Chart */}
      {chartData.length > 1 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#C9A227' }}>
            Current Form (Last 10 Rounds)
          </h2>
          <ScoreTrendChart data={chartData} />
        </div>
      )}

      {/* My Goals Section */}
      <GoalsSection />

      {/* Recent Rounds */}
      <div className="glass-card overflow-hidden">
        <div
          className="px-4 md:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.3)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
            Recent Rounds
          </h2>
          <Link
            href="/dashboard/add-round"
            className="btn-gold inline-flex items-center gap-2 text-sm py-2 px-4"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Add Round</span>
          </Link>
        </div>

        {recentRounds.length === 0 ? (
          <div className="p-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
            >
              <PlusCircle className="w-8 h-8" style={{ color: '#C9A227' }} />
            </div>
            <p className="text-white/60 mb-4">No rounds recorded yet.</p>
            <Link
              href="/dashboard/add-round"
              className="inline-flex items-center gap-2 font-medium hover:underline"
              style={{ color: '#C9A227' }}
            >
              Add your first round
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)' }}>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Course
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Weather
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentRounds.map((round) => (
                    <tr
                      key={round.id}
                      className="hover:bg-white/5 transition-colors"
                      style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.1)' }}
                    >
                      <td className="px-6 py-4 text-sm text-white/70">
                        {new Date(round.date_of_round).toLocaleDateString('en-IE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        {round.courses?.name || 'Unknown Course'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {getWeatherIcon(round.weather)}
                          <div className="text-center">
                            <span className="text-xs text-white/70">{round.weather || '—'}</span>
                            {(round.temp_c !== null || round.wind_speed_kph !== null) && (
                              <div className="flex items-center justify-center gap-2 text-xs text-white/50">
                                {round.temp_c !== null && (
                                  <span className="flex items-center gap-0.5">
                                    <Thermometer className="w-3 h-3" />
                                    {round.temp_c}°
                                  </span>
                                )}
                                {round.wind_speed_kph !== null && (
                                  <span className="flex items-center gap-0.5">
                                    <Wind className="w-3 h-3" />
                                    {round.wind_speed_kph}kph
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className="inline-flex items-center justify-center w-12 h-8 rounded-lg font-bold text-sm"
                          style={{
                            backgroundColor: 'rgba(201, 162, 39, 0.2)',
                            color: '#C9A227',
                          }}
                        >
                          {round.total_strokes ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y" style={{ borderColor: 'rgba(201, 162, 39, 0.2)' }}>
              {recentRounds.map((round) => (
                <div key={round.id} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-white">
                        {round.courses?.name || 'Unknown Course'}
                      </p>
                      <p className="text-sm text-white/50">
                        {new Date(round.date_of_round).toLocaleDateString('en-IE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                      {/* Weather info for mobile */}
                      {(round.weather || round.temp_c !== null || round.wind_speed_kph !== null) && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                          {getWeatherIcon(round.weather)}
                          <span>{round.weather || ''}</span>
                          {round.temp_c !== null && (
                            <span className="flex items-center gap-0.5">
                              <Thermometer className="w-3 h-3" />
                              {round.temp_c}°
                            </span>
                          )}
                          {round.wind_speed_kph !== null && (
                            <span className="flex items-center gap-0.5">
                              <Wind className="w-3 h-3" />
                              {round.wind_speed_kph}kph
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span
                      className="text-2xl font-bold ml-4"
                      style={{ color: '#C9A227' }}
                    >
                      {round.total_strokes ?? '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {totalRounds > 5 && (
          <div
            className="px-6 py-4 text-center"
            style={{
              borderTop: '1px solid rgba(201, 162, 39, 0.2)',
              backgroundColor: 'rgba(201, 162, 39, 0.1)',
            }}
          >
            <Link
              href="/dashboard/rounds"
              className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
              style={{ color: '#C9A227' }}
            >
              View all {totalRounds} rounds
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Link
          href="/dashboard/add-round"
          className="glass-card-hover p-6 group"
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors"
            style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
          >
            <PlusCircle className="w-5 h-5" style={{ color: '#C9A227' }} />
          </div>
          <h3 className="font-semibold text-white group-hover:text-[#C9A227] transition-colors">
            Add Round
          </h3>
          <p className="text-sm text-white/50 mt-1">Record a new round</p>
        </Link>

        <Link
          href="/dashboard/add-course"
          className="glass-card-hover p-6 group"
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors"
            style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
          >
            <Flag className="w-5 h-5" style={{ color: '#C9A227' }} />
          </div>
          <h3 className="font-semibold text-white group-hover:text-[#C9A227] transition-colors">
            Add Course
          </h3>
          <p className="text-sm text-white/50 mt-1">Set up a new course</p>
        </Link>

        <Link
          href="/dashboard/stats"
          className="glass-card-hover p-6 group"
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-colors"
            style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
          >
            <BarChart3 className="w-5 h-5" style={{ color: '#C9A227' }} />
          </div>
          <h3 className="font-semibold text-white group-hover:text-[#C9A227] transition-colors">
            Statistics
          </h3>
          <p className="text-sm text-white/50 mt-1">View your performance</p>
        </Link>
      </div>
    </div>
  )
}
