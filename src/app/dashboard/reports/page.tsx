'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  FileSpreadsheet,
  Download,
  Filter,
  Users,
  Calendar,
  Cloud,
  Sun,
  CloudRain,
  Wind,
  Thermometer,
  TrendingUp,
  X,
  ChevronDown,
  Shield
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface Profile {
  id: string
  full_name: string
  role: string | null
}

interface Squad {
  id: string
  name: string
}

interface SquadMember {
  squad_id: string
  user_id: string
}

interface Course {
  id: string
  name: string
}

interface Round {
  id: string
  user_id: string
  course_id: string
  date_of_round: string
  total_strokes: number | null
  total_par: number | null
  weather: string | null
  temp_c: number | null
  wind_speed_kph: number | null
}

interface ReportRow {
  id: string
  playerName: string
  courseName: string
  date: string
  rawDate: string
  score: number | null
  par: number | null
  weather: string | null
  tempC: number | null
  windSpeedKph: number | null
}

// ============================================
// CONSTANTS - PGC Corporate Theme
// ============================================

const PGC_DARK_GREEN = '#0D4D2B'
const PGC_GOLD = '#C9A227'

const WEATHER_OPTIONS = [
  { value: '', label: 'All Conditions' },
  { value: 'Sunny', label: 'Sunny' },
  { value: 'Cloudy', label: 'Cloudy' },
  { value: 'Rainy', label: 'Rainy' },
  { value: 'Windy', label: 'Windy' },
  { value: 'Calm', label: 'Calm' },
  { value: 'Cold', label: 'Cold' },
]

// Max 60 days back as per PRD
const DATE_RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 Days' },
  { value: '14', label: 'Last 14 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '60', label: 'Last 60 Days' },
  { value: 'custom', label: 'Custom Range' },
]

// ============================================
// HELPER FUNCTIONS
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

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Get max date (today) and min date (60 days ago) for date pickers
const getDateLimits = () => {
  const today = new Date()
  const maxDate = today.toISOString().split('T')[0]
  const minDate = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return { maxDate, minDate }
}

// ============================================
// CSV EXPORT FUNCTION (PRD Section 10.2)
// ============================================

/**
 * handleExportCSV - Exports filtered rounds data to CSV
 *
 * Data Transformation:
 * - Maps currently filtered rounds into flat array of objects
 * - Headers: Player Name, Date, Course, Score, Par, Weather, Wind (kph), Temp (C)
 *
 * Filename Format: PGC-Report-[SquadName]-[CurrentDate].csv
 */
const exportToCSV = (data: ReportRow[], squadName: string) => {
  // PRD-specified headers
  const headers = [
    'Player Name',
    'Date',
    'Course',
    'Score',
    'Par',
    'Weather',
    'Wind (kph)',
    'Temp (C)'
  ]

  // Transform data to flat CSV rows
  const csvContent = [
    headers.join(','),
    ...data.map(row => [
      `"${row.playerName}"`,
      `"${row.date}"`,
      `"${row.courseName}"`,
      row.score ?? '',
      row.par ?? '',
      `"${row.weather || ''}"`,
      row.windSpeedKph ?? '',
      row.tempC ?? '',
    ].join(','))
  ].join('\n')

  // PRD Filename Format: PGC-Report-[SquadName]-[CurrentDate].csv
  const currentDate = new Date().toISOString().split('T')[0]
  const cleanSquadName = squadName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
  const filename = `PGC-Report-${cleanSquadName}-${currentDate}.csv`

  // Generate and download CSV blob
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

// ============================================
// COMPONENT
// ============================================

export default function ReportsPage() {
  const router = useRouter()

  // Auth & Access
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  // Data
  const [squads, setSquads] = useState<Squad[]>([])
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [rounds, setRounds] = useState<Round[]>([])

  // Filters
  const [selectedSquad, setSelectedSquad] = useState<string>('')
  const [dateRange, setDateRange] = useState<string>('30')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [selectedWeather, setSelectedWeather] = useState<string>('')

  const { maxDate, minDate } = getDateLimits()

  useEffect(() => {
    checkAccessAndFetchData()
  }, [])

  const checkAccessAndFetchData = async () => {
    try {
      const supabase = createClient()

      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push('/login')
        return
      }

      // Check if user is Admin or Super Admin
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.error('Profile error:', JSON.stringify(profileError, null, 2))
        router.push('/dashboard')
        return
      }

      // Debug: Log the raw role value
      console.log('[Reports] Raw profile:', profileData)
      console.log('[Reports] Raw role:', profileData?.role)

      // Normalize role: lowercase and replace spaces with underscores
      const rawRole = profileData?.role || ''
      const normalizedRole = rawRole.toLowerCase().replace(/\s+/g, '_')

      console.log('[Reports] Normalized role:', normalizedRole)

      const hasAccess = ['admin', 'super_admin'].includes(normalizedRole)

      // Redirect non-admins to dashboard
      if (!hasAccess) {
        console.log('[Reports] Access denied - redirecting to dashboard')
        router.push('/dashboard')
        return
      }

      // Fetch all data in parallel
      const [squadsRes, membersRes, profilesRes, coursesRes, roundsRes] = await Promise.all([
        supabase.from('squads').select('id, name').order('name'),
        supabase.from('squad_members').select('squad_id, user_id'),
        supabase.from('profiles').select('id, full_name, role'),
        supabase.from('courses').select('id, name'),
        supabase.from('rounds').select('id, user_id, course_id, date_of_round, total_strokes, total_par, weather, temp_c, wind_speed_kph').order('date_of_round', { ascending: false }),
      ])

      if (squadsRes.error) console.error('Squads error:', JSON.stringify(squadsRes.error, null, 2))
      if (membersRes.error) console.error('Members error:', JSON.stringify(membersRes.error, null, 2))
      if (profilesRes.error) console.error('Profiles error:', JSON.stringify(profilesRes.error, null, 2))
      if (coursesRes.error) console.error('Courses error:', JSON.stringify(coursesRes.error, null, 2))
      if (roundsRes.error) console.error('Rounds error:', JSON.stringify(roundsRes.error, null, 2))

      setSquads(squadsRes.data || [])
      setSquadMembers(membersRes.data || [])
      setProfiles(profilesRes.data || [])
      setCourses(coursesRes.data || [])
      setRounds(roundsRes.data || [])

    } catch (err) {
      console.error('Reports error:', JSON.stringify(err, null, 2))
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // ============================================
  // FILTERED DATA
  // ============================================

  const filteredData = useMemo(() => {
    let filtered = [...rounds]

    // Filter by squad
    if (selectedSquad) {
      const squadUserIds = squadMembers
        .filter(m => m.squad_id === selectedSquad)
        .map(m => m.user_id)
      filtered = filtered.filter(r => squadUserIds.includes(r.user_id))
    }

    // Filter by date range (max 60 days)
    const now = new Date()
    let startDate: Date

    if (dateRange === 'custom') {
      if (customStartDate) {
        startDate = new Date(customStartDate)
        filtered = filtered.filter(r => new Date(r.date_of_round) >= startDate)
      }
      if (customEndDate) {
        const endDate = new Date(customEndDate)
        endDate.setHours(23, 59, 59, 999)
        filtered = filtered.filter(r => new Date(r.date_of_round) <= endDate)
      }
    } else {
      const days = parseInt(dateRange)
      startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      filtered = filtered.filter(r => new Date(r.date_of_round) >= startDate)
    }

    // Filter by weather
    if (selectedWeather) {
      filtered = filtered.filter(r => r.weather === selectedWeather)
    }

    // Map to report rows
    const reportRows: ReportRow[] = filtered.map(round => {
      const player = profiles.find(p => p.id === round.user_id)
      const course = courses.find(c => c.id === round.course_id)

      return {
        id: round.id,
        playerName: player?.full_name || 'Unknown Player',
        courseName: course?.name || 'Unknown Course',
        date: formatDate(round.date_of_round),
        rawDate: round.date_of_round,
        score: round.total_strokes,
        par: round.total_par,
        weather: round.weather,
        tempC: round.temp_c,
        windSpeedKph: round.wind_speed_kph,
      }
    })

    return reportRows
  }, [rounds, profiles, courses, squadMembers, selectedSquad, dateRange, customStartDate, customEndDate, selectedWeather])

  // ============================================
  // INSIGHTS
  // ============================================

  const insights = useMemo(() => {
    const validScores = filteredData.filter(r => r.score !== null && r.score > 0)

    if (validScores.length === 0) {
      return {
        totalRounds: 0,
        avgScore: null,
        bestScore: null,
        worstScore: null,
        uniquePlayers: 0,
        avgTemp: null,
        avgWind: null,
      }
    }

    const scores = validScores.map(r => r.score!)
    const temps = validScores.filter(r => r.tempC !== null).map(r => r.tempC!)
    const winds = validScores.filter(r => r.windSpeedKph !== null).map(r => r.windSpeedKph!)
    const uniquePlayers = new Set(filteredData.map(r => r.playerName)).size

    return {
      totalRounds: filteredData.length,
      avgScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      bestScore: Math.min(...scores),
      worstScore: Math.max(...scores),
      uniquePlayers,
      avgTemp: temps.length > 0 ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : null,
      avgWind: winds.length > 0 ? Math.round((winds.reduce((a, b) => a + b, 0) / winds.length) * 10) / 10 : null,
    }
  }, [filteredData])

  // ============================================
  // HANDLERS
  // ============================================

  const handleExportCSV = () => {
    const squadName = selectedSquad
      ? squads.find(s => s.id === selectedSquad)?.name || 'AllPlayers'
      : 'AllPlayers'
    exportToCSV(filteredData, squadName)
  }

  const clearFilters = () => {
    setSelectedSquad('')
    setDateRange('30')
    setCustomStartDate('')
    setCustomEndDate('')
    setSelectedWeather('')
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
          <p className="text-white/60">Loading Admin Reporting Hub...</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${PGC_GOLD}33` }}
          >
            <FileSpreadsheet className="w-6 h-6" style={{ color: PGC_GOLD }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold" style={{ color: PGC_GOLD }}>
                Admin Reporting Hub
              </h1>
              <Shield className="w-5 h-5" style={{ color: PGC_GOLD }} />
            </div>
            <p className="text-white/60 mt-1">Generate custom performance reports</p>
          </div>
        </div>
        {/* Download CSV Button - Gold border, Dark Green text (PRD 10.2) */}
        <button
          onClick={handleExportCSV}
          disabled={filteredData.length === 0}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg"
          style={{
            backgroundColor: 'transparent',
            border: `2px solid ${PGC_GOLD}`,
            color: PGC_DARK_GREEN,
            background: PGC_GOLD,
          }}
        >
          <Download className="w-5 h-5" />
          <span>Download CSV</span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="p-4 rounded-xl flex items-center justify-between"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
          }}
        >
          <span className="text-red-200 text-sm">{error}</span>
          <button onClick={() => setError('')} className="text-red-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Horizontal Filter Bar */}
      <div
        className="rounded-xl p-4 md:p-6"
        style={{
          backgroundColor: PGC_DARK_GREEN,
          border: `1px solid ${PGC_GOLD}40`,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          {/* Squad Filter */}
          <div className="flex-1">
            <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
              <Users className="w-4 h-4" style={{ color: PGC_GOLD }} />
              Squad
            </label>
            <div className="relative">
              <select
                value={selectedSquad}
                onChange={(e) => setSelectedSquad(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white appearance-none cursor-pointer focus:outline-none transition-colors"
                style={{ backgroundColor: '#0a3d22', borderColor: `${PGC_GOLD}40` }}
              >
                <option value="" style={{ backgroundColor: '#0a3d22' }}>All Players</option>
                {squads.map((squad) => (
                  <option key={squad.id} value={squad.id} style={{ backgroundColor: '#0a3d22' }}>
                    {squad.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 pointer-events-none" />
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex-1">
            <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
              <Calendar className="w-4 h-4" style={{ color: PGC_GOLD }} />
              Date Range <span className="text-white/40 text-xs">(max 60 days)</span>
            </label>
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white appearance-none cursor-pointer focus:outline-none transition-colors"
                style={{ backgroundColor: '#0a3d22', borderColor: `${PGC_GOLD}40` }}
              >
                {DATE_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} style={{ backgroundColor: '#0a3d22' }}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 pointer-events-none" />
            </div>
          </div>

          {/* Weather Filter */}
          <div className="flex-1">
            <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
              <Cloud className="w-4 h-4" style={{ color: PGC_GOLD }} />
              Weather
            </label>
            <div className="relative">
              <select
                value={selectedWeather}
                onChange={(e) => setSelectedWeather(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white appearance-none cursor-pointer focus:outline-none transition-colors"
                style={{ backgroundColor: '#0a3d22', borderColor: `${PGC_GOLD}40` }}
              >
                {WEATHER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} style={{ backgroundColor: '#0a3d22' }}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 pointer-events-none" />
            </div>
          </div>

          {/* Clear Filters Button */}
          <div className="flex-shrink-0">
            <button
              onClick={clearFilters}
              className="w-full md:w-auto px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              style={{
                backgroundColor: `${PGC_GOLD}20`,
                color: PGC_GOLD,
                border: `1px solid ${PGC_GOLD}40`,
              }}
            >
              <Filter className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {dateRange === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4" style={{ borderTop: `1px solid ${PGC_GOLD}30` }}>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                min={minDate}
                max={maxDate}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border text-white focus:outline-none"
                style={{ backgroundColor: '#0a3d22', borderColor: `${PGC_GOLD}40` }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={minDate}
                max={maxDate}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border text-white focus:outline-none"
                style={{ backgroundColor: '#0a3d22', borderColor: `${PGC_GOLD}40` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Selection Insights Summary */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: PGC_DARK_GREEN,
          border: `1px solid ${PGC_GOLD}40`,
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5" style={{ color: PGC_GOLD }} />
          <h2 className="text-lg font-semibold" style={{ color: PGC_GOLD }}>
            Selection Insights
          </h2>
          <span className="ml-auto text-sm text-white/50">
            {filteredData.length} round{filteredData.length !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Average Score - Primary Highlight */}
          <div
            className="p-4 rounded-xl text-center"
            style={{ backgroundColor: `${PGC_GOLD}25`, border: `2px solid ${PGC_GOLD}` }}
          >
            <p className="text-3xl font-bold" style={{ color: PGC_GOLD }}>
              {insights.avgScore ?? '—'}
            </p>
            <p className="text-xs text-white/60 uppercase tracking-wide mt-1">Avg Score</p>
          </div>

          {/* Best Score */}
          <div className="p-4 rounded-xl text-center bg-white/5">
            <p className="text-2xl font-bold text-green-400">
              {insights.bestScore ?? '—'}
            </p>
            <p className="text-xs text-white/50 uppercase tracking-wide mt-1">Best</p>
          </div>

          {/* Worst Score */}
          <div className="p-4 rounded-xl text-center bg-white/5">
            <p className="text-2xl font-bold text-red-400">
              {insights.worstScore ?? '—'}
            </p>
            <p className="text-xs text-white/50 uppercase tracking-wide mt-1">Worst</p>
          </div>

          {/* Avg Wind */}
          <div className="p-4 rounded-xl text-center bg-white/5">
            <div className="flex items-center justify-center gap-1">
              <Wind className="w-4 h-4 text-blue-400" />
              <p className="text-2xl font-bold text-white">
                {insights.avgWind !== null ? insights.avgWind : '—'}
              </p>
            </div>
            <p className="text-xs text-white/50 uppercase tracking-wide mt-1">Avg Wind (kph)</p>
          </div>

          {/* Avg Temperature */}
          <div className="p-4 rounded-xl text-center bg-white/5">
            <div className="flex items-center justify-center gap-1">
              <Thermometer className="w-4 h-4 text-orange-400" />
              <p className="text-2xl font-bold text-white">
                {insights.avgTemp !== null ? `${insights.avgTemp}°` : '—'}
              </p>
            </div>
            <p className="text-xs text-white/50 uppercase tracking-wide mt-1">Avg Temp (°C)</p>
          </div>
        </div>

        {/* Players Count */}
        <div className="mt-4 pt-4 flex items-center justify-center gap-6" style={{ borderTop: `1px solid ${PGC_GOLD}30` }}>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Users className="w-4 h-4" />
            <span>{insights.uniquePlayers} player{insights.uniquePlayers !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <FileSpreadsheet className="w-4 h-4" />
            <span>{insights.totalRounds} round{insights.totalRounds !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: PGC_DARK_GREEN,
          border: `1px solid ${PGC_GOLD}40`,
        }}
      >
        <div
          className="px-4 md:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${PGC_GOLD}40` }}
        >
          <h2 className="text-lg font-semibold" style={{ color: PGC_GOLD }}>
            Report Preview
          </h2>
          {filteredData.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="text-sm flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-all hover:shadow-md"
              style={{
                backgroundColor: PGC_GOLD,
                color: PGC_DARK_GREEN,
                border: `1px solid ${PGC_GOLD}`,
              }}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
        </div>

        {filteredData.length === 0 ? (
          <div className="p-8 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: `${PGC_GOLD}20` }}
            >
              <FileSpreadsheet className="w-8 h-8" style={{ color: PGC_GOLD }} />
            </div>
            <p className="text-white/60 mb-2">No rounds match your filters</p>
            <p className="text-sm text-white/40">Try adjusting your filter criteria</p>
          </div>
        ) : (
          <>
            {/* Desktop Table - Column order: Player Name | Date | Course | Score | Par | Weather | Wind (kph) | Temp (C) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: `${PGC_GOLD}20` }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Player Name
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Course
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Score
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Par
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Weather
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Wind (kph)
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase" style={{ color: PGC_GOLD }}>
                      Temp (C)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-white/5 transition-colors"
                      style={{ borderBottom: `1px solid ${PGC_GOLD}15` }}
                    >
                      <td className="px-4 py-4 text-sm font-medium text-white">
                        {row.playerName}
                      </td>
                      <td className="px-4 py-4 text-sm text-center text-white/70">
                        {row.date}
                      </td>
                      <td className="px-4 py-4 text-sm text-white/70">
                        {row.courseName}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className="inline-flex items-center justify-center w-12 h-8 rounded-lg font-bold text-sm"
                          style={{
                            backgroundColor: `${PGC_GOLD}30`,
                            color: PGC_GOLD,
                          }}
                        >
                          {row.score ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center text-sm text-white/70">
                        {row.par ?? '—'}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getWeatherIcon(row.weather)}
                          <span className="text-xs text-white/70">{row.weather || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {row.windSpeedKph !== null ? (
                          <span className="flex items-center justify-center gap-1 text-sm text-white/70">
                            <Wind className="w-3 h-3 text-blue-400" />
                            {row.windSpeedKph}
                          </span>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {row.tempC !== null ? (
                          <span className="flex items-center justify-center gap-1 text-sm text-white/70">
                            <Thermometer className="w-3 h-3 text-orange-400" />
                            {row.tempC}°
                          </span>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y" style={{ borderColor: `${PGC_GOLD}20` }}>
              {filteredData.map((row) => (
                <div key={row.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-white">{row.playerName}</p>
                      <p className="text-sm text-white/50">{row.courseName}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className="text-xl font-bold px-3 py-1 rounded-lg inline-block"
                        style={{ backgroundColor: `${PGC_GOLD}25`, color: PGC_GOLD }}
                      >
                        {row.score ?? '—'}
                      </span>
                      {row.par && (
                        <p className="text-xs text-white/40 mt-1">Par {row.par}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/50">
                    <div className="flex items-center gap-2">
                      <span>{row.date}</span>
                      {row.weather && (
                        <span className="flex items-center gap-1">
                          {getWeatherIcon(row.weather)}
                          {row.weather}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {row.windSpeedKph !== null && (
                        <span className="flex items-center gap-0.5">
                          <Wind className="w-3 h-3 text-blue-400" />
                          {row.windSpeedKph}
                        </span>
                      )}
                      {row.tempC !== null && (
                        <span className="flex items-center gap-0.5">
                          <Thermometer className="w-3 h-3 text-orange-400" />
                          {row.tempC}°
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Results Count Footer */}
        {filteredData.length > 0 && (
          <div
            className="px-6 py-3 text-sm text-white/50 text-center"
            style={{ borderTop: `1px solid ${PGC_GOLD}20`, backgroundColor: `${PGC_GOLD}10` }}
          >
            Showing {filteredData.length} round{filteredData.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
