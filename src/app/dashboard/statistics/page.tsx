'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { BarChart3, PlusCircle, Circle, Flag, Cloud, Sun, Wind, MapPin, TreePine } from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface HoleScore {
  par: number
  strokes: number
}

interface ScoringStats {
  par3Avg: number | null
  par4Avg: number | null
  par5Avg: number | null
  eagles: number
  birdies: number
  pars: number
  bogeys: number
  doubles: number
  totalHoles: number
}

interface ConditionStat {
  label: string
  avgScore: number
  roundCount: number
  color: string
}

interface EnvironmentalStats {
  byCourseType: ConditionStat[]
  byWeather: ConditionStat[]
}

// ============================================
// COMPONENT
// ============================================

export default function StatisticsPage() {
  const [stats, setStats] = useState<ScoringStats | null>(null)
  const [envStats, setEnvStats] = useState<EnvironmentalStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchStatistics()
  }, [])

  const fetchStatistics = async () => {
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        setError('Please log in to view statistics')
        setIsLoading(false)
        return
      }

      // Fetch user's rounds with course type and weather
      const { data: rounds, error: roundsError } = await supabase
        .from('rounds')
        .select('id, total_strokes, weather, courses(type)')
        .eq('user_id', user.id)

      if (roundsError) {
        console.error('Error fetching rounds:', roundsError)
        setError('Failed to load round data')
        setIsLoading(false)
        return
      }

      if (!rounds || rounds.length === 0) {
        setStats(null)
        setEnvStats(null)
        setIsLoading(false)
        return
      }

      // Calculate environmental statistics
      const environmentalStats = calculateEnvironmentalStats(rounds)
      setEnvStats(environmentalStats)

      const roundIds = rounds.map(r => r.id)

      // Fetch all round_scores for user's rounds
      const { data: scores, error: scoresError } = await supabase
        .from('round_scores')
        .select('par, strokes')
        .in('round_id', roundIds)

      if (scoresError) {
        console.error('Error fetching scores:', scoresError)
        setError('Failed to load score data')
        setIsLoading(false)
        return
      }

      if (!scores || scores.length === 0) {
        setStats(null)
        setIsLoading(false)
        return
      }

      // Calculate statistics
      const calculatedStats = calculateScoringStats(scores as HoleScore[])
      setStats(calculatedStats)

    } catch (err) {
      console.error('Statistics error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Course type colors
  const courseTypeColors: Record<string, string> = {
    'Links': '#3B82F6',      // Blue
    'Parkland': '#22C55E',   // Green
    'Heathland': '#A855F7',  // Purple
    'Desert': '#F59E0B',     // Amber
    'Mountain': '#6366F1',   // Indigo
    'Other': '#6B7280',      // Gray
  }

  // Weather colors
  const weatherColors: Record<string, string> = {
    'Sunny': '#F59E0B',      // Amber
    'Cloudy': '#6B7280',     // Gray
    'Windy': '#3B82F6',      // Blue
    'Rainy': '#6366F1',      // Indigo
    'Calm': '#22C55E',       // Green
    'Cold': '#06B6D4',       // Cyan
    'Hot': '#EF4444',        // Red
    'Other': '#9CA3AF',      // Light gray
  }

  const calculateEnvironmentalStats = (rounds: any[]): EnvironmentalStats => {
    // Group by course type
    const courseTypeMap = new Map<string, number[]>()
    // Group by weather
    const weatherMap = new Map<string, number[]>()

    rounds.forEach(round => {
      if (round.total_strokes && round.total_strokes > 0) {
        // Course type
        const courseType = round.courses?.type || 'Other'
        if (!courseTypeMap.has(courseType)) {
          courseTypeMap.set(courseType, [])
        }
        courseTypeMap.get(courseType)!.push(round.total_strokes)

        // Weather
        const weather = round.weather || 'Other'
        if (!weatherMap.has(weather)) {
          weatherMap.set(weather, [])
        }
        weatherMap.get(weather)!.push(round.total_strokes)
      }
    })

    // Calculate averages for course types
    const byCourseType: ConditionStat[] = Array.from(courseTypeMap.entries())
      .map(([label, scores]) => ({
        label,
        avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        roundCount: scores.length,
        color: courseTypeColors[label] || courseTypeColors['Other'],
      }))
      .sort((a, b) => a.avgScore - b.avgScore)

    // Calculate averages for weather
    const byWeather: ConditionStat[] = Array.from(weatherMap.entries())
      .map(([label, scores]) => ({
        label,
        avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        roundCount: scores.length,
        color: weatherColors[label] || weatherColors['Other'],
      }))
      .sort((a, b) => a.avgScore - b.avgScore)

    return { byCourseType, byWeather }
  }

  const calculateScoringStats = (scores: HoleScore[]): ScoringStats => {
    // Filter valid scores
    const validScores = scores.filter(s => s.strokes && s.strokes > 0 && s.par)

    // Group by par
    const par3Scores: number[] = []
    const par4Scores: number[] = []
    const par5Scores: number[] = []

    // Scoring breakdown counters
    let eagles = 0
    let birdies = 0
    let pars = 0
    let bogeys = 0
    let doubles = 0

    validScores.forEach(score => {
      const diff = score.strokes - score.par

      // Group by par type
      if (score.par === 3) par3Scores.push(score.strokes)
      else if (score.par === 4) par4Scores.push(score.strokes)
      else if (score.par === 5) par5Scores.push(score.strokes)

      // Count scoring outcomes
      if (diff <= -2) eagles++
      else if (diff === -1) birdies++
      else if (diff === 0) pars++
      else if (diff === 1) bogeys++
      else doubles++ // +2 or worse
    })

    // Calculate averages
    const calcAvg = (arr: number[]) =>
      arr.length > 0
        ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100
        : null

    return {
      par3Avg: calcAvg(par3Scores),
      par4Avg: calcAvg(par4Scores),
      par5Avg: calcAvg(par5Scores),
      eagles,
      birdies,
      pars,
      bogeys,
      doubles,
      totalHoles: validScores.length,
    }
  }

  // Calculate percentages for the distribution
  const getDistribution = () => {
    if (!stats || stats.totalHoles === 0) return []

    const total = stats.totalHoles
    return [
      {
        label: 'Eagles+',
        count: stats.eagles,
        percent: (stats.eagles / total) * 100,
        color: '#9333EA', // Purple
      },
      {
        label: 'Birdies',
        count: stats.birdies,
        percent: (stats.birdies / total) * 100,
        color: '#22C55E', // Green
      },
      {
        label: 'Pars',
        count: stats.pars,
        percent: (stats.pars / total) * 100,
        color: '#C9A227', // Gold
      },
      {
        label: 'Bogeys',
        count: stats.bogeys,
        percent: (stats.bogeys / total) * 100,
        color: '#F97316', // Orange
      },
      {
        label: 'Double+',
        count: stats.doubles,
        percent: (stats.doubles / total) * 100,
        color: '#EF4444', // Red
      },
    ]
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

  const distribution = getDistribution()

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#C9A227' }}>
            My Statistics
          </h1>
          <p className="text-white/60 mt-1">Detailed scoring analysis</p>
        </div>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
        >
          <BarChart3 className="w-6 h-6" style={{ color: '#C9A227' }} />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="p-4 rounded-xl"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
          }}
        >
          <span className="text-red-200 text-sm">{error}</span>
        </div>
      )}

      {!stats ? (
        /* Empty State */
        <div className="glass-card p-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
          >
            <BarChart3 className="w-8 h-8" style={{ color: '#C9A227' }} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Hole Data Yet</h3>
          <p className="text-white/60 mb-6 max-w-md mx-auto">
            Add rounds with hole-by-hole scores to see your detailed statistics.
          </p>
          <Link
            href="/dashboard/add-round"
            className="btn-gold inline-flex items-center gap-2"
          >
            <PlusCircle className="w-5 h-5" />
            Add a Round
          </Link>
        </div>
      ) : (
        <>
          {/* Par Averages - Top Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Par 3 Average */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}
                >
                  <Flag className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-white/60 font-medium">Par 3 Average</p>
                  <p className="text-xs text-white/40">Short holes</p>
                </div>
              </div>
              <p className="text-4xl font-bold text-white">
                {stats.par3Avg !== null ? stats.par3Avg.toFixed(2) : '—'}
              </p>
              {stats.par3Avg !== null && (
                <p className="text-sm mt-2" style={{ color: stats.par3Avg <= 3.2 ? '#22C55E' : stats.par3Avg <= 3.5 ? '#C9A227' : '#F97316' }}>
                  {stats.par3Avg <= 3.0 ? 'Excellent' : stats.par3Avg <= 3.2 ? 'Great' : stats.par3Avg <= 3.5 ? 'Good' : 'Needs work'}
                </p>
              )}
            </div>

            {/* Par 4 Average */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
                >
                  <Flag className="w-5 h-5" style={{ color: '#C9A227' }} />
                </div>
                <div>
                  <p className="text-sm text-white/60 font-medium">Par 4 Average</p>
                  <p className="text-xs text-white/40">Medium holes</p>
                </div>
              </div>
              <p className="text-4xl font-bold text-white">
                {stats.par4Avg !== null ? stats.par4Avg.toFixed(2) : '—'}
              </p>
              {stats.par4Avg !== null && (
                <p className="text-sm mt-2" style={{ color: stats.par4Avg <= 4.2 ? '#22C55E' : stats.par4Avg <= 4.5 ? '#C9A227' : '#F97316' }}>
                  {stats.par4Avg <= 4.0 ? 'Excellent' : stats.par4Avg <= 4.2 ? 'Great' : stats.par4Avg <= 4.5 ? 'Good' : 'Needs work'}
                </p>
              )}
            </div>

            {/* Par 5 Average */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(147, 51, 234, 0.2)' }}
                >
                  <Flag className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-white/60 font-medium">Par 5 Average</p>
                  <p className="text-xs text-white/40">Long holes</p>
                </div>
              </div>
              <p className="text-4xl font-bold text-white">
                {stats.par5Avg !== null ? stats.par5Avg.toFixed(2) : '—'}
              </p>
              {stats.par5Avg !== null && (
                <p className="text-sm mt-2" style={{ color: stats.par5Avg <= 5.2 ? '#22C55E' : stats.par5Avg <= 5.5 ? '#C9A227' : '#F97316' }}>
                  {stats.par5Avg <= 5.0 ? 'Excellent' : stats.par5Avg <= 5.2 ? 'Great' : stats.par5Avg <= 5.5 ? 'Good' : 'Needs work'}
                </p>
              )}
            </div>
          </div>

          {/* Scoring Distribution */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
                  Scoring Distribution
                </h2>
                <p className="text-sm text-white/50">
                  Based on {stats.totalHoles} holes played
                </p>
              </div>
            </div>

            {/* Distribution Bars */}
            <div className="space-y-4">
              {distribution.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Circle
                        className="w-3 h-3"
                        style={{ color: item.color, fill: item.color }}
                      />
                      <span className="text-sm font-medium text-white">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-white/50">{item.count} holes</span>
                      <span
                        className="text-sm font-bold w-14 text-right"
                        style={{ color: item.color }}
                      >
                        {item.percent.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div
                    className="h-3 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(item.percent, 0.5)}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Summary */}
            <div
              className="mt-6 pt-6 grid grid-cols-2 md:grid-cols-5 gap-4"
              style={{ borderTop: '1px solid rgba(201, 162, 39, 0.2)' }}
            >
              {distribution.map((item) => (
                <div key={item.label} className="text-center">
                  <p
                    className="text-2xl font-bold"
                    style={{ color: item.color }}
                  >
                    {item.count}
                  </p>
                  <p className="text-xs text-white/50 uppercase tracking-wide">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Scoring Breakdown Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {distribution.map((item) => (
              <div key={item.label} className="glass-card p-4 text-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: `${item.color}20` }}
                >
                  <Circle
                    className="w-4 h-4"
                    style={{ color: item.color, fill: item.color }}
                  />
                </div>
                <p className="text-2xl font-bold text-white">{item.count}</p>
                <p className="text-xs text-white/50 uppercase tracking-wide mt-1">
                  {item.label}
                </p>
                <p className="text-sm font-medium mt-2" style={{ color: item.color }}>
                  {item.percent.toFixed(1)}%
                </p>
              </div>
            ))}
          </div>

          {/* Performance by Condition */}
          {envStats && (envStats.byCourseType.length > 0 || envStats.byWeather.length > 0) && (
            <div className="glass-card p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
                  Performance by Condition
                </h2>
                <p className="text-sm text-white/50">
                  How conditions affect your scoring
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* By Course Type */}
                {envStats.byCourseType.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}
                      >
                        <TreePine className="w-4 h-4 text-green-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-white">By Course Type</h3>
                    </div>
                    <div className="space-y-3">
                      {envStats.byCourseType.map((item) => {
                        // Calculate bar width relative to max score
                        const maxScore = Math.max(...envStats.byCourseType.map(i => i.avgScore))
                        const minScore = Math.min(...envStats.byCourseType.map(i => i.avgScore))
                        const range = maxScore - minScore || 1
                        const barPercent = ((item.avgScore - minScore) / range) * 60 + 40

                        return (
                          <div key={item.label}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3 h-3" style={{ color: item.color }} />
                                <span className="text-sm text-white">{item.label}</span>
                                <span className="text-xs text-white/40">({item.roundCount} rounds)</span>
                              </div>
                              <span
                                className="text-sm font-bold"
                                style={{ color: item.color }}
                              >
                                {item.avgScore}
                              </span>
                            </div>
                            <div
                              className="h-2 rounded-full overflow-hidden"
                              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                            >
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${barPercent}%`,
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Best/Worst Course Type */}
                    {envStats.byCourseType.length > 1 && (
                      <div className="mt-4 pt-4 flex justify-between text-xs" style={{ borderTop: '1px solid rgba(201, 162, 39, 0.2)' }}>
                        <div>
                          <span className="text-white/50">Best: </span>
                          <span className="text-green-400 font-medium">
                            {envStats.byCourseType[0].label} ({envStats.byCourseType[0].avgScore})
                          </span>
                        </div>
                        <div>
                          <span className="text-white/50">Challenge: </span>
                          <span className="text-orange-400 font-medium">
                            {envStats.byCourseType[envStats.byCourseType.length - 1].label}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* By Weather */}
                {envStats.byWeather.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
                      >
                        <Cloud className="w-4 h-4 text-blue-400" />
                      </div>
                      <h3 className="text-sm font-semibold text-white">By Weather</h3>
                    </div>
                    <div className="space-y-3">
                      {envStats.byWeather.map((item) => {
                        // Calculate bar width relative to max score
                        const maxScore = Math.max(...envStats.byWeather.map(i => i.avgScore))
                        const minScore = Math.min(...envStats.byWeather.map(i => i.avgScore))
                        const range = maxScore - minScore || 1
                        const barPercent = ((item.avgScore - minScore) / range) * 60 + 40

                        // Weather icon
                        const WeatherIcon = item.label === 'Sunny' ? Sun :
                                           item.label === 'Windy' ? Wind :
                                           item.label === 'Calm' ? Sun : Cloud

                        return (
                          <div key={item.label}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <WeatherIcon className="w-3 h-3" style={{ color: item.color }} />
                                <span className="text-sm text-white">{item.label}</span>
                                <span className="text-xs text-white/40">({item.roundCount} rounds)</span>
                              </div>
                              <span
                                className="text-sm font-bold"
                                style={{ color: item.color }}
                              >
                                {item.avgScore}
                              </span>
                            </div>
                            <div
                              className="h-2 rounded-full overflow-hidden"
                              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                            >
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${barPercent}%`,
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Best/Worst Weather */}
                    {envStats.byWeather.length > 1 && (
                      <div className="mt-4 pt-4 flex justify-between text-xs" style={{ borderTop: '1px solid rgba(201, 162, 39, 0.2)' }}>
                        <div>
                          <span className="text-white/50">Best: </span>
                          <span className="text-green-400 font-medium">
                            {envStats.byWeather[0].label} ({envStats.byWeather[0].avgScore})
                          </span>
                        </div>
                        <div>
                          <span className="text-white/50">Challenge: </span>
                          <span className="text-orange-400 font-medium">
                            {envStats.byWeather[envStats.byWeather.length - 1].label}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Performance Insight */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#C9A227' }}>
              Performance Insight
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-white/60 text-sm mb-2">Scoring Below Par</p>
                <p className="text-3xl font-bold text-green-400">
                  {((stats.eagles + stats.birdies) / stats.totalHoles * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-white/40 mt-1">
                  {stats.eagles + stats.birdies} holes under par
                </p>
              </div>
              <div>
                <p className="text-white/60 text-sm mb-2">Par or Better</p>
                <p className="text-3xl font-bold" style={{ color: '#C9A227' }}>
                  {((stats.eagles + stats.birdies + stats.pars) / stats.totalHoles * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-white/40 mt-1">
                  {stats.eagles + stats.birdies + stats.pars} holes at par or better
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
