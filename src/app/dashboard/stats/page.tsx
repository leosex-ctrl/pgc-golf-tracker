'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  Users,
  TrendingUp,
  Trophy,
  Target,
  Calendar,
  Shield,
  ChevronDown,
  Activity,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts'

// ============================================
// TYPES
// ============================================

interface RoundDetail {
  id: string
  dateOfRound: string
  totalStrokes: number
  handicapDifferential: number | null
  weatherConditions: string | null
  windConditions: string | null
  courseType: string | null
  courseName: string | null
  coursePar: number | null
}

interface PlayerStats {
  userId: string
  fullName: string
  avatarUrl: string | null
  handicapIndex: number | null
  totalRounds: number
  averageScore: number | null
  bestScore: number | null
  lastRoundScore: number | null
  lastRoundDate: string | null
  rounds: RoundDetail[]
}

type TimeframeFilter = 'all' | '3months' | 'ytd'

// ============================================
// CONSTANTS
// ============================================

const PGC_GOLD = '#C9A227'
const PGC_DARK_GREEN = '#0D4D2B'

const CHART_COLORS = [
  '#C9A227', // Gold
  '#22C55E', // Green
  '#3B82F6', // Blue
  '#A855F7', // Purple
  '#F97316', // Orange
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#EF4444', // Red
]

const COURSE_TYPE_COLORS: Record<string, string> = {
  Links: '#3B82F6',
  Parkland: '#22C55E',
  Heathland: '#A855F7',
  Desert: '#F97316',
  Resort: '#EC4899',
  Unknown: '#6B7280',
}

const WEATHER_MAP: Record<string, string> = {
  sunny: 'Sun',
  clear: 'Sun',
  cloudy: 'Cloud',
  overcast: 'Cloud',
  partly_cloudy: 'Cloud',
  rainy: 'Rain',
  rain: 'Rain',
  drizzle: 'Rain',
  windy: 'Wind',
  wind: 'Wind',
  breezy: 'Wind',
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTimeframeStartDate(filter: TimeframeFilter): Date | null {
  const now = new Date()
  switch (filter) {
    case '3months':
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1)
    default:
      return null
  }
}

function filterRoundsByTimeframe(rounds: RoundDetail[], filter: TimeframeFilter): RoundDetail[] {
  const startDate = getTimeframeStartDate(filter)
  if (!startDate) return rounds
  return rounds.filter(r => new Date(r.dateOfRound) >= startDate)
}

function isActivePlayer(rounds: RoundDetail[]): boolean {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  return rounds.some(r => new Date(r.dateOfRound) >= thirtyDaysAgo)
}

function normalizeWeather(weather: string | null): string {
  if (!weather) return 'Unknown'
  const lower = weather.toLowerCase().replace(/\s+/g, '_')
  return WEATHER_MAP[lower] || 'Unknown'
}

// ============================================
// COMPONENT
// ============================================

export default function SquadInsightsPage() {
  const router = useRouter()

  // Auth & Role state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdminOrSuper, setIsAdminOrSuper] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Squad Insights state
  const [squadPlayerStats, setSquadPlayerStats] = useState<PlayerStats[]>([])
  const [isLoadingSquadStats, setIsLoadingSquadStats] = useState(false)
  const [squadError, setSquadError] = useState('')

  // Filter state
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('all')

  useEffect(() => {
    checkAuthAndFetch()
  }, [])

  const checkAuthAndFetch = async () => {
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push('/login')
        return
      }

      setCurrentUserId(user.id)

      // Check if user is Admin or Super Admin
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileData) {
        const normalizedRole = (profileData.role || '').toLowerCase().replace(/\s+/g, '_')
        const hasAccess = ['admin', 'super_admin'].includes(normalizedRole)
        setIsAdminOrSuper(hasAccess)

        if (!hasAccess) {
          router.push('/dashboard/statistics')
          return
        }

        setIsLoading(false)
        fetchSquadInsights(user.id)
      } else {
        router.push('/dashboard/statistics')
      }
    } catch (err) {
      console.error('Auth check error:', err)
      setIsLoading(false)
    }
  }

  const fetchSquadInsights = async (userId: string) => {
    setIsLoadingSquadStats(true)
    setSquadError('')

    try {
      const supabase = createClient()

      // Step 1: Get squads linked to this admin
      const { data: adminSquads, error: adminSquadsError } = await supabase
        .from('admin_squads')
        .select('squad_id')
        .eq('admin_id', userId)

      if (adminSquadsError) {
        console.error('Error fetching admin squads:', adminSquadsError)
        setSquadError('Failed to load squad assignments')
        setIsLoadingSquadStats(false)
        return
      }

      if (!adminSquads || adminSquads.length === 0) {
        setSquadPlayerStats([])
        setIsLoadingSquadStats(false)
        return
      }

      const squadIds = adminSquads.map(as => as.squad_id)

      // Step 2: Get all members from those squads
      const { data: squadMembers, error: membersError } = await supabase
        .from('squad_members')
        .select('user_id')
        .in('squad_id', squadIds)

      if (membersError) {
        console.error('Error fetching squad members:', membersError)
        setSquadError('Failed to load squad members')
        setIsLoadingSquadStats(false)
        return
      }

      if (!squadMembers || squadMembers.length === 0) {
        setSquadPlayerStats([])
        setIsLoadingSquadStats(false)
        return
      }

      const playerIds = [...new Set(squadMembers.map(m => m.user_id))]

      // Step 3: Get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, handicap_index')
        .in('id', playerIds)

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError)
        setSquadError('Failed to load player profiles')
        setIsLoadingSquadStats(false)
        return
      }

      // Step 4: Get rounds with course details
      const { data: rounds, error: roundsError } = await supabase
        .from('rounds')
        .select('*, weather_conditions, courses(name, par, course_type)')
        .in('user_id', playerIds)
        .order('date_of_round', { ascending: false })

      if (roundsError) {
        console.error('Error fetching rounds:', roundsError)
        setSquadError('Failed to load round data')
        setIsLoadingSquadStats(false)
        return
      }

      // Step 5: Build player stats
      const playerStatsMap = new Map<string, PlayerStats>()

      profiles?.forEach(profile => {
        playerStatsMap.set(profile.id, {
          userId: profile.id,
          fullName: profile.full_name || 'Unknown Player',
          avatarUrl: profile.avatar_url,
          handicapIndex: profile.handicap_index,
          totalRounds: 0,
          averageScore: null,
          bestScore: null,
          lastRoundScore: null,
          lastRoundDate: null,
          rounds: [],
        })
      })

      const roundsByPlayer = new Map<string, RoundDetail[]>()

      rounds?.forEach(round => {
        if (round.total_strokes && round.total_strokes > 0) {
          if (!roundsByPlayer.has(round.user_id)) {
            roundsByPlayer.set(round.user_id, [])
          }

          const courseData = round.courses as { name: string; par: number; course_type: string | null } | null

          roundsByPlayer.get(round.user_id)!.push({
            id: round.id,
            dateOfRound: round.date_of_round,
            totalStrokes: round.total_strokes,
            handicapDifferential: round.handicap_differential,
            weatherConditions: round.weather_conditions,
            windConditions: round.wind_conditions || null,
            courseType: courseData?.course_type || null,
            courseName: courseData?.name || null,
            coursePar: courseData?.par || null,
          })
        }
      })

      roundsByPlayer.forEach((playerRounds, playerId) => {
        const stats = playerStatsMap.get(playerId)
        if (stats && playerRounds.length > 0) {
          const scores = playerRounds.map(r => r.totalStrokes)
          stats.totalRounds = playerRounds.length
          stats.averageScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          stats.bestScore = Math.min(...scores)
          stats.lastRoundScore = playerRounds[0].totalStrokes
          stats.lastRoundDate = playerRounds[0].dateOfRound
          stats.rounds = playerRounds
        }
      })

      const playerStatsArray = Array.from(playerStatsMap.values())
        .sort((a, b) => {
          if (a.totalRounds === 0 && b.totalRounds > 0) return 1
          if (a.totalRounds > 0 && b.totalRounds === 0) return -1
          if (a.averageScore === null && b.averageScore === null) return 0
          if (a.averageScore === null) return 1
          if (b.averageScore === null) return -1
          return a.averageScore - b.averageScore
        })

      setSquadPlayerStats(playerStatsArray)

    } catch (err) {
      console.error('Squad insights error:', err)
      setSquadError('An unexpected error occurred')
    } finally {
      setIsLoadingSquadStats(false)
    }
  }

  // ============================================
  // COMPUTED DATA FOR CHARTS
  // ============================================

  const filteredPlayerStats = useMemo(() => {
    return squadPlayerStats.map(player => {
      const filteredRounds = filterRoundsByTimeframe(player.rounds, timeframeFilter)
      const scores = filteredRounds.map(r => r.totalStrokes)
      return {
        ...player,
        rounds: filteredRounds,
        totalRounds: filteredRounds.length,
        averageScore: scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null,
        bestScore: scores.length > 0 ? Math.min(...scores) : null,
      }
    })
  }, [squadPlayerStats, timeframeFilter])

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalPlayers = filteredPlayerStats.length
    const activePlayers = filteredPlayerStats.filter(p => isActivePlayer(p.rounds)).length
    const playersWithRounds = filteredPlayerStats.filter(p => p.averageScore !== null)
    const squadAvgScore = playersWithRounds.length > 0
      ? Math.round((playersWithRounds.reduce((sum, p) => sum + (p.averageScore || 0), 0) / playersWithRounds.length) * 10) / 10
      : null
    const totalRounds = filteredPlayerStats.reduce((sum, p) => sum + p.totalRounds, 0)

    return { totalPlayers, activePlayers, squadAvgScore, totalRounds }
  }, [filteredPlayerStats])

  // Bar chart data: Player avg scores
  const avgScoreChartData = useMemo(() => {
    return filteredPlayerStats
      .filter(p => p.averageScore !== null)
      .slice(0, 10)
      .map(p => ({
        name: p.fullName.split(' ')[0],
        fullName: p.fullName,
        avgScore: p.averageScore,
      }))
      .reverse()
  }, [filteredPlayerStats])

  // Bar chart data: Performance by wind strength
  const windPerformanceData = useMemo(() => {
    const windCategories = ['No Wind', '10kmph', '20kmph', '30kmph', '40kmph']
    const windScores: Record<string, { total: number; count: number }> = {}
    windCategories.forEach(cat => { windScores[cat] = { total: 0, count: 0 } })

    filteredPlayerStats.forEach(player => {
      player.rounds.forEach(round => {
        const wind = round.windConditions
        if (wind && windScores[wind]) {
          windScores[wind].total += round.totalStrokes
          windScores[wind].count += 1
        }
      })
    })

    return windCategories
      .map(wind => ({
        wind,
        avgScore: windScores[wind].count > 0
          ? Math.round((windScores[wind].total / windScores[wind].count) * 10) / 10
          : 0,
        rounds: windScores[wind].count,
      }))
      .filter(d => d.rounds > 0)
  }, [filteredPlayerStats])

  // Stacked bar data: Rounds by course type
  const courseTypeData = useMemo(() => {
    const typeCountsByPlayer: Record<string, Record<string, number>> = {}

    filteredPlayerStats.forEach(player => {
      if (player.rounds.length > 0) {
        const firstName = player.fullName.split(' ')[0]
        typeCountsByPlayer[firstName] = {}

        player.rounds.forEach(round => {
          const type = round.courseType || 'Unknown'
          typeCountsByPlayer[firstName][type] = (typeCountsByPlayer[firstName][type] || 0) + 1
        })
      }
    })

    return Object.entries(typeCountsByPlayer)
      .slice(0, 8)
      .map(([name, types]) => ({
        name,
        ...types,
      }))
  }, [filteredPlayerStats])

  const allCourseTypes = useMemo(() => {
    const types = new Set<string>()
    filteredPlayerStats.forEach(p => {
      p.rounds.forEach(r => {
        types.add(r.courseType || 'Unknown')
      })
    })
    return Array.from(types)
  }, [filteredPlayerStats])

  // Bar chart data: Weather performance
  const weatherBarData = useMemo(() => {
    const weatherScores: Record<string, { total: number; count: number }> = {
      Sun: { total: 0, count: 0 },
      Cloud: { total: 0, count: 0 },
      Rain: { total: 0, count: 0 },
      Wind: { total: 0, count: 0 },
    }

    filteredPlayerStats.forEach(player => {
      player.rounds.forEach(round => {
        const weather = normalizeWeather(round.weatherConditions)
        if (weatherScores[weather]) {
          weatherScores[weather].total += round.totalStrokes
          weatherScores[weather].count += 1
        }
      })
    })

    return Object.entries(weatherScores)
      .map(([weather, data]) => ({
        weather,
        avgScore: data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0,
        rounds: data.count,
      }))
      .filter(d => d.rounds > 0)
  }, [filteredPlayerStats])

  // Leaderboard data
  const leaderboardData = useMemo(() => {
    const byAvgScore = [...filteredPlayerStats]
      .filter(p => p.averageScore !== null)
      .sort((a, b) => (a.averageScore || 999) - (b.averageScore || 999))
      .slice(0, 3)

    const byHandicap = [...filteredPlayerStats]
      .filter(p => p.handicapIndex !== null)
      .sort((a, b) => (a.handicapIndex || 999) - (b.handicapIndex || 999))
      .slice(0, 3)

    return { byAvgScore, byHandicap }
  }, [filteredPlayerStats])

  // ============================================
  // RENDER HELPERS
  // ============================================

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
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
            style={{ borderTopColor: PGC_GOLD }}
          />
          <p className="text-white/60">Checking permissions...</p>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: PGC_GOLD }}>
            Squad Insights
          </h1>
          <p className="text-white/60 mt-1">Performance analytics for your squads</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Admin Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
            style={{ backgroundColor: `${PGC_GOLD}20`, color: PGC_GOLD }}
          >
            <Shield className="w-4 h-4" />
            Admin
          </div>

          {/* Timeframe Filter */}
          <div className="relative">
            <select
              value={timeframeFilter}
              onChange={(e) => setTimeframeFilter(e.target.value as TimeframeFilter)}
              className="appearance-none px-4 py-2 pr-10 rounded-lg text-sm font-medium text-white cursor-pointer focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderColor: PGC_GOLD,
                border: '1px solid rgba(201, 162, 39, 0.3)',
              }}
            >
              <option value="all" style={{ backgroundColor: PGC_DARK_GREEN }}>All Time</option>
              <option value="3months" style={{ backgroundColor: PGC_DARK_GREEN }}>Last 3 Months</option>
              <option value="ytd" style={{ backgroundColor: PGC_DARK_GREEN }}>Year to Date</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {squadError && (
        <div
          className="p-4 rounded-xl"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
          }}
        >
          <span className="text-red-200 text-sm">{squadError}</span>
        </div>
      )}

      {/* Loading State */}
      {isLoadingSquadStats ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div
              className="w-10 h-10 border-4 border-white/20 rounded-full animate-spin mx-auto mb-4"
              style={{ borderTopColor: PGC_GOLD }}
            />
            <p className="text-white/60">Loading squad insights...</p>
          </div>
        </div>
      ) : squadPlayerStats.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
          >
            <Users className="w-8 h-8" style={{ color: PGC_GOLD }} />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Squad Data</h3>
          <p className="text-white/60 mb-4 max-w-md mx-auto">
            You don&apos;t have any squads assigned yet, or the assigned squads have no members.
          </p>
        </div>
      ) : (
        <>
          {/* ============================================ */}
          {/* TOP-LEVEL SUMMARY CARDS */}
          {/* ============================================ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
                >
                  <Users className="w-5 h-5" style={{ color: PGC_GOLD }} />
                </div>
                <span className="text-white/60 text-sm">Total Players</span>
              </div>
              <p className="text-3xl font-bold text-white">{summaryStats.totalPlayers}</p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}
                >
                  <Activity className="w-5 h-5 text-green-400" />
                </div>
                <span className="text-white/60 text-sm">Active (30d)</span>
              </div>
              <p className="text-3xl font-bold text-white">{summaryStats.activePlayers}</p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(147, 51, 234, 0.2)' }}
                >
                  <Target className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-white/60 text-sm">Squad Avg</span>
              </div>
              <p className="text-3xl font-bold text-white">
                {summaryStats.squadAvgScore ?? '—'}
              </p>
            </div>

            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}
                >
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-white/60 text-sm">Total Rounds</span>
              </div>
              <p className="text-3xl font-bold text-white">{summaryStats.totalRounds}</p>
            </div>
          </div>

          {/* ============================================ */}
          {/* PERFORMANCE COMPARISON (MIDDLE ROW) */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Avg Score Bar Chart */}
            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold mb-4" style={{ color: PGC_GOLD }}>
                Avg Score by Player
              </h3>
              {avgScoreChartData.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={avgScoreChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        type="number"
                        domain={['dataMin - 5', 'dataMax + 5']}
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 11 }}
                        width={50}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: PGC_DARK_GREEN,
                          border: `1px solid ${PGC_GOLD}`,
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: PGC_GOLD }}
                        itemStyle={{ color: 'white' }}
                        formatter={(value: number, name: string, props: any) => [
                          value,
                          props.payload.fullName
                        ]}
                      />
                      {summaryStats.squadAvgScore && (
                        <ReferenceLine
                          x={summaryStats.squadAvgScore}
                          stroke={PGC_GOLD}
                          strokeDasharray="5 5"
                          label={{
                            value: 'Squad Avg',
                            fill: PGC_GOLD,
                            fontSize: 10,
                            position: 'top',
                          }}
                        />
                      )}
                      <Bar dataKey="avgScore" radius={[0, 4, 4, 0]}>
                        {avgScoreChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-white/40">
                  No score data available
                </div>
              )}
            </div>

            {/* Performance by Wind Strength */}
            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold mb-4" style={{ color: PGC_GOLD }}>
                Performance by Wind Strength
              </h3>
              {windPerformanceData.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={windPerformanceData}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey="wind"
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                      />
                      <YAxis
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                        domain={[(dataMin: number) => Math.floor(dataMin - 5), (dataMax: number) => Math.ceil(dataMax + 5)]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: PGC_DARK_GREEN,
                          border: `1px solid ${PGC_GOLD}`,
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: PGC_GOLD }}
                        itemStyle={{ color: 'white' }}
                        formatter={(value: number, _name: string, props: any) => [
                          `${value} (${props.payload.rounds} rounds)`,
                          'Avg Score'
                        ]}
                      />
                      <Bar dataKey="avgScore" radius={[4, 4, 0, 0]}>
                        {windPerformanceData.map((_entry, index) => (
                          <Cell
                            key={`wind-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-white/40">
                  No wind data available
                </div>
              )}
            </div>

            {/* Rounds by Course Type Stacked Bar */}
            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold mb-4" style={{ color: PGC_GOLD }}>
                Rounds by Course Type
              </h3>
              {courseTypeData.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={courseTypeData}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey="name"
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                      />
                      <YAxis
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: PGC_DARK_GREEN,
                          border: `1px solid ${PGC_GOLD}`,
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: PGC_GOLD }}
                        itemStyle={{ color: 'white' }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '11px' }}
                        formatter={(value) => (
                          <span style={{ color: 'rgba(255,255,255,0.8)' }}>{value}</span>
                        )}
                      />
                      {allCourseTypes.map((type) => (
                        <Bar
                          key={type}
                          dataKey={type}
                          stackId="a"
                          fill={COURSE_TYPE_COLORS[type] || '#6B7280'}
                          radius={[0, 0, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-white/40">
                  No course data available
                </div>
              )}
            </div>
          </div>

          {/* ============================================ */}
          {/* DEEP INSIGHTS (BOTTOM ROW) */}
          {/* ============================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weather Bar Chart */}
            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold mb-4" style={{ color: PGC_GOLD }}>
                Performance by Weather
              </h3>
              {weatherBarData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={weatherBarData}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey="weather"
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 12 }}
                      />
                      <YAxis
                        stroke="rgba(255,255,255,0.5)"
                        tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
                        domain={[(dataMin: number) => Math.floor(dataMin - 5), (dataMax: number) => Math.ceil(dataMax + 5)]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: PGC_DARK_GREEN,
                          border: `1px solid ${PGC_GOLD}`,
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: PGC_GOLD }}
                        itemStyle={{ color: 'white' }}
                        formatter={(value: number, _name: string, props: any) => [
                          `${value} (${props.payload.rounds} rounds)`,
                          'Avg Score'
                        ]}
                      />
                      <Bar dataKey="avgScore" radius={[4, 4, 0, 0]}>
                        {weatherBarData.map((_entry, index) => {
                          const weatherColors: Record<string, string> = {
                            Sun: '#F59E0B',
                            Cloud: '#94A3B8',
                            Rain: '#3B82F6',
                            Wind: '#22C55E',
                          }
                          return (
                            <Cell
                              key={`weather-${index}`}
                              fill={weatherColors[weatherBarData[index].weather] || PGC_GOLD}
                            />
                          )
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-white/40">
                  No weather data available
                </div>
              )}
            </div>

            {/* Leaderboard Tables */}
            <div className="glass-card p-5">
              <h3 className="text-lg font-semibold mb-4" style={{ color: PGC_GOLD }}>
                Leaderboard
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Best Avg Score */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-medium text-white/80">Best Avg Score</span>
                  </div>
                  <div className="space-y-2">
                    {leaderboardData.byAvgScore.map((player, idx) => (
                      <div
                        key={player.userId}
                        className="flex items-center gap-3 p-2 rounded-lg"
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            backgroundColor: idx === 0 ? PGC_GOLD : idx === 1 ? '#94A3B8' : '#CD7F32',
                            color: PGC_DARK_GREEN,
                          }}
                        >
                          {idx + 1}
                        </div>
                        {player.avatarUrl ? (
                          <img
                            src={player.avatarUrl}
                            alt={player.fullName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ backgroundColor: `${PGC_GOLD}40`, color: PGC_GOLD }}
                          >
                            {getInitials(player.fullName)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{player.fullName}</p>
                        </div>
                        <span className="text-sm font-bold" style={{ color: PGC_GOLD }}>
                          {player.averageScore}
                        </span>
                      </div>
                    ))}
                    {leaderboardData.byAvgScore.length === 0 && (
                      <p className="text-white/40 text-sm">No data</p>
                    )}
                  </div>
                </div>

                {/* Lowest Handicap */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium text-white/80">Lowest Handicap</span>
                  </div>
                  <div className="space-y-2">
                    {leaderboardData.byHandicap.map((player, idx) => (
                      <div
                        key={player.userId}
                        className="flex items-center gap-3 p-2 rounded-lg"
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            backgroundColor: idx === 0 ? PGC_GOLD : idx === 1 ? '#94A3B8' : '#CD7F32',
                            color: PGC_DARK_GREEN,
                          }}
                        >
                          {idx + 1}
                        </div>
                        {player.avatarUrl ? (
                          <img
                            src={player.avatarUrl}
                            alt={player.fullName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ backgroundColor: `${PGC_GOLD}40`, color: PGC_GOLD }}
                          >
                            {getInitials(player.fullName)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{player.fullName}</p>
                        </div>
                        <span className="text-sm font-bold text-green-400">
                          {player.handicapIndex?.toFixed(1)}
                        </span>
                      </div>
                    ))}
                    {leaderboardData.byHandicap.length === 0 && (
                      <p className="text-white/40 text-sm">No data</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
