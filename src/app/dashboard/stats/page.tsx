'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { BarChart3, PlusCircle, TrendingDown, TrendingUp, Target, Sun, Cloud, CloudRain, Wind, Thermometer } from 'lucide-react'
import { CoursePerformanceChart } from '@/components/DashboardCharts'

// ============================================
// TYPES - STRICT SCHEMA MATCH
// ============================================

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

// Weather icon helper
const getWeatherIcon = (weather: string | null) => {
  if (!weather) return null
  const w = weather.toLowerCase()
  if (w.includes('rain')) return <CloudRain className="w-4 h-4 text-blue-400" />
  if (w.includes('sun') || w.includes('clear')) return <Sun className="w-4 h-4 text-yellow-400" />
  if (w.includes('wind')) return <Wind className="w-4 h-4 text-blue-300" />
  if (w.includes('cloud') || w.includes('overcast')) return <Cloud className="w-4 h-4 text-gray-400" />
  return <Cloud className="w-4 h-4 text-gray-400" />
}

interface PerformanceStats {
  averageScore: number | null
  bestScore: number | null
  worstScore: number | null
  totalRounds: number
  trend: 'improving' | 'declining' | 'stable' | null
}

// ============================================
// COMPONENT
// ============================================

export default function StatsPage() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [courseData, setCourseData] = useState<{ courseName: string; avgScore: number }[]>([])
  const [stats, setStats] = useState<PerformanceStats>({
    averageScore: null,
    bestScore: null,
    worstScore: null,
    totalRounds: 0,
    trend: null,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        console.error('Supabase Error:', JSON.stringify(authError, null, 2))
        return
      }

      // ============================================
      // FETCH ROUNDS WITH COURSE JOIN
      // Schema: rounds(*, courses(name))
      // ============================================
      const { data: roundsData, error: roundsError } = await supabase
        .from('rounds')
        .select('*, courses(name)')
        .eq('user_id', user.id)
        .order('date_of_round', { ascending: false })
        .limit(20)

      if (roundsError) {
        console.error('Supabase Error:', JSON.stringify(roundsError, null, 2))
        setError(`Failed to load rounds: ${roundsError.message || 'Unknown error'}`)
        return
      }

      if (roundsData && roundsData.length > 0) {
        setRounds(roundsData as Round[])
        calculateStats(roundsData as Round[])
        calculateCoursePerformance(roundsData as Round[])
      }

    } catch (err) {
      console.error('Supabase Error:', JSON.stringify(err, null, 2))
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const calculateStats = (roundsData: Round[]) => {
    const validRounds = roundsData.filter(r => r.total_strokes !== null && r.total_strokes > 0)

    if (validRounds.length === 0) {
      setStats({
        averageScore: null,
        bestScore: null,
        worstScore: null,
        totalRounds: 0,
        trend: null,
      })
      return
    }

    const scores = validRounds.map(r => r.total_strokes!)
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length
    const bestScore = Math.min(...scores)
    const worstScore = Math.max(...scores)

    // Calculate trend (comparing first half vs second half of rounds)
    let trend: 'improving' | 'declining' | 'stable' | null = null
    if (validRounds.length >= 4) {
      const half = Math.floor(validRounds.length / 2)
      const recentScores = scores.slice(0, half)
      const olderScores = scores.slice(half)
      const recentAvg = recentScores.reduce((a, b) => a + b, 0) / recentScores.length
      const olderAvg = olderScores.reduce((a, b) => a + b, 0) / olderScores.length

      if (recentAvg < olderAvg - 2) trend = 'improving'
      else if (recentAvg > olderAvg + 2) trend = 'declining'
      else trend = 'stable'
    }

    setStats({
      averageScore: avgScore,
      bestScore,
      worstScore,
      totalRounds: validRounds.length,
      trend,
    })
  }

  const calculateCoursePerformance = (roundsData: Round[]) => {
    const validRounds = roundsData.filter(
      r => r.total_strokes !== null && r.total_strokes > 0 && r.courses?.name
    )

    // Group rounds by course name
    const courseMap = new Map<string, number[]>()
    validRounds.forEach(r => {
      const courseName = r.courses.name
      const existing = courseMap.get(courseName) || []
      existing.push(r.total_strokes!)
      courseMap.set(courseName, existing)
    })

    // Calculate average for each course
    const coursePerformance = Array.from(courseMap.entries())
      .map(([courseName, scores]) => ({
        courseName,
        avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      }))
      .sort((a, b) => a.avgScore - b.avgScore)

    setCourseData(coursePerformance)
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
          <p className="text-white/60">Loading statistics...</p>
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
          Statistics
        </h1>
        <p className="text-white/60 mt-1">Your performance analysis</p>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="p-4 rounded-xl flex items-start gap-3"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
          }}
        >
          <span className="text-red-200 text-sm">{error}</span>
        </div>
      )}

      {/* Course Performance Chart */}
      {courseData.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: '#C9A227' }}>
            Performance by Venue
          </h2>
          <CoursePerformanceChart data={courseData} />
        </div>
      )}

      {rounds.length === 0 ? (
        /* Empty State */
        <div className="glass-card p-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
          >
            <BarChart3 className="w-8 h-8" style={{ color: '#C9A227' }} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Data Yet</h3>
          <p className="text-white/60 mb-6 max-w-md mx-auto">
            Add some rounds to start seeing your performance statistics.
          </p>
          <Link
            href="/dashboard/add-round"
            className="btn-gold inline-flex items-center gap-2"
          >
            <PlusCircle className="w-5 h-5" />
            Add Your First Round
          </Link>
        </div>
      ) : (
        <>
          {/* Performance Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Average Score */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-white/60 font-medium">Average Score</p>
                <Target className="w-5 h-5" style={{ color: '#C9A227' }} />
              </div>
              <p className="text-3xl font-bold text-white">
                {stats.averageScore !== null ? stats.averageScore.toFixed(1) : '—'}
              </p>
              <p className="text-xs text-white/40 mt-1">
                Based on {stats.totalRounds} rounds
              </p>
            </div>

            {/* Best Score */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-white/60 font-medium">Best Score</p>
                <TrendingDown className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-3xl font-bold text-green-400">
                {stats.bestScore !== null ? stats.bestScore : '—'}
              </p>
              <p className="text-xs text-white/40 mt-1">Personal best</p>
            </div>

            {/* Worst Score */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-white/60 font-medium">Worst Score</p>
                <TrendingUp className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-3xl font-bold text-red-400">
                {stats.worstScore !== null ? stats.worstScore : '—'}
              </p>
              <p className="text-xs text-white/40 mt-1">Room to improve</p>
            </div>

            {/* Trend */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-white/60 font-medium">Trend</p>
                <BarChart3 className="w-5 h-5" style={{ color: '#C9A227' }} />
              </div>
              <p className={`text-3xl font-bold ${
                stats.trend === 'improving' ? 'text-green-400' :
                stats.trend === 'declining' ? 'text-red-400' :
                'text-white'
              }`}>
                {stats.trend === 'improving' ? 'Improving' :
                 stats.trend === 'declining' ? 'Declining' :
                 stats.trend === 'stable' ? 'Stable' : '—'}
              </p>
              <p className="text-xs text-white/40 mt-1">Recent vs older rounds</p>
            </div>
          </div>

          {/* Round History */}
          <div className="glass-card overflow-hidden">
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.3)' }}
            >
              <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
                Round History
              </h2>
              <span className="text-sm text-white/40">{rounds.length} rounds</span>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'rgba(201, 162, 39, 0.15)' }}>
                    <th className="py-3 px-6 text-left text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Date
                    </th>
                    <th className="py-3 px-6 text-left text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Course
                    </th>
                    <th className="py-3 px-6 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Weather
                    </th>
                    <th className="py-3 px-6 text-center text-xs font-semibold uppercase" style={{ color: '#C9A227' }}>
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((round) => (
                    <tr
                      key={round.id}
                      className="hover:bg-white/5 transition-colors"
                      style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.1)' }}
                    >
                      <td className="py-4 px-6 text-sm text-white/70">
                        {new Date(round.date_of_round).toLocaleDateString('en-IE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-4 px-6 text-sm font-medium text-white">
                        {round.courses?.name || 'Unknown Course'}
                      </td>
                      <td className="py-4 px-6">
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
                      <td className="py-4 px-6 text-center">
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
              {rounds.map((round) => (
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
                          year: 'numeric',
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
          </div>
        </>
      )}
    </div>
  )
}
