'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Users,
  Target,
  Wind,
  CloudRain,
  Sun,
  Check,
  AlertCircle,
  TrendingUp,
  Trophy,
  Zap,
  BarChart3,
  UserCheck,
  Shield,
  ChevronDown,
  MapPin,
  Mountain,
  Waves,
  TreePine,
  Award,
  Sparkles,
  Home,
  Plane,
  Globe
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface Profile {
  id: string
  full_name: string
  handicap_index: number | null
  home_club: string | null
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
  type: string | null
}

interface Round {
  id: string
  user_id: string
  course_id: string
  date_of_round: string
  total_strokes: number | null
  total_par: number | null
  weather: string | null
  is_home: boolean | null
  holes_played: number | null
}

interface PlayerStats {
  id: string
  name: string
  handicap: number | null
  avgScore: number | null
  avgScoreToPar: number | null // Normalized score (strokes vs par per 18 holes)
  avgScoreCalm: number | null
  avgScoreWindy: number | null
  avgScoreRainy: number | null
  avgScoreLinks: number | null
  avgScoreParkland: number | null
  avgScoreHeath: number | null
  avgScoreCliffside: number | null
  avgScoreHome: number | null // Average at home (Portmarnock)
  avgScoreAway: number | null // Average at away venues
  avgScoreToParHome: number | null // Normalized home score
  avgScoreToParAway: number | null // Normalized away score
  last3RoundsAvg: number | null
  totalRounds: number
  homeRounds: number
  awayRounds: number
  avgPar: number | null
  isVenueSpecialist: boolean
  venueDifferential: number | null // How much better than overall avg on selected venue
}

// ============================================
// CONSTANTS - PGC Corporate Theme
// ============================================

const PGC_DARK_GREEN = '#0D4D2B'
const PGC_GOLD = '#C9A227'

type MatchCondition = 'calm' | 'windy' | 'rainy'
type VenueType = 'links' | 'parkland' | 'heath' | 'cliffside'
type HomeAwayFilter = 'all' | 'home' | 'away'
type MatchFormat = '3_home' | '2_home' | '3_away' | '2_away'

const MATCH_FORMAT_CONFIG: Record<MatchFormat, { label: string; players: number; homeAway: HomeAwayFilter; description: string }> = {
  '3_home': { label: '3 Home Matches', players: 3, homeAway: 'home', description: '3 players at Portmarnock' },
  '2_home': { label: '2 Home Matches', players: 2, homeAway: 'home', description: '2 players at Portmarnock' },
  '3_away': { label: '3 Away Matches', players: 3, homeAway: 'away', description: '3 players away' },
  '2_away': { label: '2 Away Matches', players: 2, homeAway: 'away', description: '2 players away' },
}

const CONDITION_CONFIG: Record<MatchCondition, { label: string; icon: typeof Sun; color: string }> = {
  calm: { label: 'Calm', icon: Sun, color: '#22C55E' },
  windy: { label: 'Windy', icon: Wind, color: '#3B82F6' },
  rainy: { label: 'Rainy', icon: CloudRain, color: '#6366F1' },
}

const HOME_AWAY_CONFIG: Record<HomeAwayFilter, { label: string; color: string; description: string }> = {
  all: { label: 'All Rounds', color: '#A855F7', description: 'Include all data' },
  home: { label: 'Home', color: '#22C55E', description: 'Portmarnock only' },
  away: { label: 'Away', color: '#F59E0B', description: 'Away venues' },
}

const VENUE_CONFIG: Record<VenueType, { label: string; icon: typeof MapPin; color: string; description: string }> = {
  links: { label: 'Links', icon: Waves, color: '#0EA5E9', description: 'Coastal, windswept' },
  parkland: { label: 'Parkland', icon: TreePine, color: '#22C55E', description: 'Tree-lined, lush' },
  heath: { label: 'Heath', icon: Mountain, color: '#A855F7', description: 'Open, heather' },
  cliffside: { label: 'Cliffside', icon: MapPin, color: '#F59E0B', description: 'Dramatic terrain' },
}

// Threshold for "significant" improvement (in strokes)
const VENUE_SPECIALIST_THRESHOLD = 2

// ============================================
// COMPONENT
// ============================================

export default function SimulatorPage() {
  const router = useRouter()

  // Auth & Access
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  // Data
  const [squads, setSquads] = useState<Squad[]>([])
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [rounds, setRounds] = useState<Round[]>([])

  // Selection State
  const [selectedSquad, setSelectedSquad] = useState<string>('')
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set())
  const [matchCondition, setMatchCondition] = useState<MatchCondition>('calm')
  const [venueType, setVenueType] = useState<VenueType>('links')
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('3_home')

  // Derived from match format
  const requiredPlayers = MATCH_FORMAT_CONFIG[matchFormat].players
  const homeAwayFilter = MATCH_FORMAT_CONFIG[matchFormat].homeAway

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
      console.log('[Simulator] Raw profile:', profileData)
      console.log('[Simulator] Raw role:', profileData?.role)

      // Normalize role: lowercase and replace spaces with underscores
      const rawRole = profileData?.role || ''
      const normalizedRole = rawRole.toLowerCase().replace(/\s+/g, '_')

      console.log('[Simulator] Normalized role:', normalizedRole)

      const hasAccess = ['admin', 'super_admin'].includes(normalizedRole)

      if (!hasAccess) {
        console.log('[Simulator] Access denied - redirecting to dashboard')
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)

      // Fetch all data in parallel (including courses with type, rounds with is_home and holes_played)
      const [squadsRes, membersRes, profilesRes, coursesRes, roundsRes] = await Promise.all([
        supabase.from('squads').select('id, name').order('name'),
        supabase.from('squad_members').select('squad_id, user_id'),
        supabase.from('profiles').select('id, full_name, handicap_index, home_club'),
        supabase.from('courses').select('id, name, type'),
        supabase.from('rounds').select('id, user_id, course_id, date_of_round, total_strokes, total_par, weather, is_home, holes_played').order('date_of_round', { ascending: false }),
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
      console.error('Simulator error:', JSON.stringify(err, null, 2))
    } finally {
      setIsLoading(false)
    }
  }

  // ============================================
  // COMPUTED DATA
  // ============================================

  // Create course lookup maps
  const courseTypeMap = useMemo(() => {
    const map = new Map<string, string>()
    courses.forEach(c => {
      if (c.type) {
        map.set(c.id, c.type.toLowerCase())
      }
    })
    return map
  }, [courses])

  const courseNameMap = useMemo(() => {
    const map = new Map<string, string>()
    courses.forEach(c => {
      map.set(c.id, c.name)
    })
    return map
  }, [courses])

  // Get members of selected squad
  const squadPlayerIds = useMemo(() => {
    if (!selectedSquad) return []
    return squadMembers
      .filter(m => m.squad_id === selectedSquad)
      .map(m => m.user_id)
  }, [selectedSquad, squadMembers])

  // Helper function to normalize 9-hole rounds to 18-hole equivalent using strokes vs par
  const normalizeScore = (totalStrokes: number, totalPar: number | null, holesPlayed: number | null): number => {
    const holes = holesPlayed || 18
    const par = totalPar || (holes === 9 ? 36 : 72)

    if (holes === 9) {
      // Calculate strokes vs par for 9 holes, then project to 18
      const strokesOverPar = totalStrokes - par
      const projectedPar = 72 // Standard 18-hole par
      return projectedPar + (strokesOverPar * 2)
    }
    return totalStrokes
  }

  // Calculate stats for each player
  const playerStats = useMemo((): PlayerStats[] => {
    return squadPlayerIds.map(playerId => {
      const profile = profiles.find(p => p.id === playerId)
      const allPlayerRounds = rounds.filter(r => r.user_id === playerId && r.total_strokes && r.total_strokes > 0)

      // Determine home/away using startsWith against player's home_club
      const playerHomeClub = profile?.home_club || ''
      const isRoundHome = (r: Round): boolean => {
        if (!playerHomeClub) return false
        const courseName = courseNameMap.get(r.course_id) || ''
        return courseName.startsWith(playerHomeClub)
      }

      // Filter rounds based on home/away selection
      const playerRounds = homeAwayFilter === 'all'
        ? allPlayerRounds
        : homeAwayFilter === 'home'
          ? allPlayerRounds.filter(r => isRoundHome(r))
          : allPlayerRounds.filter(r => !isRoundHome(r))

      // Separate home and away rounds for stats (always calculated regardless of filter)
      const homeRounds = allPlayerRounds.filter(r => isRoundHome(r))
      const awayRounds = allPlayerRounds.filter(r => !isRoundHome(r))

      // Calculate normalized average (using strokes vs par to handle 9-hole rounds)
      const calcNormalizedAvg = (roundsList: Round[]) => {
        if (roundsList.length === 0) return null
        const normalizedScores = roundsList.map(r =>
          normalizeScore(r.total_strokes!, r.total_par, r.holes_played)
        )
        return Math.round((normalizedScores.reduce((sum, s) => sum + s, 0) / normalizedScores.length) * 10) / 10
      }

      // Calculate overall average (normalized)
      const avgScore = calcNormalizedAvg(playerRounds)
      const avgScoreToPar = avgScore !== null ? Math.round((avgScore - 72) * 10) / 10 : null

      // Calculate home/away averages (always from all rounds, not filtered)
      const avgScoreHome = calcNormalizedAvg(homeRounds)
      const avgScoreAway = calcNormalizedAvg(awayRounds)
      const avgScoreToParHome = avgScoreHome !== null ? Math.round((avgScoreHome - 72) * 10) / 10 : null
      const avgScoreToParAway = avgScoreAway !== null ? Math.round((avgScoreAway - 72) * 10) / 10 : null

      // Calculate average par
      const roundsWithPar = playerRounds.filter(r => r.total_par && r.total_par > 0)
      const avgPar = roundsWithPar.length > 0
        ? Math.round((roundsWithPar.reduce((sum, r) => sum + r.total_par!, 0) / roundsWithPar.length) * 10) / 10
        : 72

      // Calculate weather condition-specific averages (normalized)
      const calcConditionAvg = (condition: string) => {
        const conditionRounds = playerRounds.filter(r => {
          const weather = r.weather?.toLowerCase() || ''
          if (condition === 'calm') return weather.includes('calm') || weather.includes('sunny') || weather.includes('clear')
          if (condition === 'windy') return weather.includes('windy') || weather.includes('wind')
          if (condition === 'rainy') return weather.includes('rain') || weather.includes('rainy')
          return false
        })
        return calcNormalizedAvg(conditionRounds)
      }

      // Calculate venue-specific averages (normalized)
      const calcVenueAvg = (venue: string) => {
        const venueRounds = playerRounds.filter(r => {
          const courseType = courseTypeMap.get(r.course_id)?.toLowerCase() || ''
          return courseType.includes(venue)
        })
        return calcNormalizedAvg(venueRounds)
      }

      // Calculate last 3 rounds average (normalized)
      const last3Rounds = playerRounds.slice(0, 3)
      const last3RoundsAvg = calcNormalizedAvg(last3Rounds)

      // Get venue score for selected venue
      const venueScore = calcVenueAvg(venueType)
      const venueDifferential = avgScore !== null && venueScore !== null
        ? Math.round((avgScore - venueScore) * 10) / 10
        : null

      // Determine if player is a venue specialist (significantly better at selected venue)
      const isVenueSpecialist = venueDifferential !== null && venueDifferential >= VENUE_SPECIALIST_THRESHOLD

      return {
        id: playerId,
        name: profile?.full_name || 'Unknown Player',
        handicap: profile?.handicap_index || null,
        avgScore,
        avgScoreToPar,
        avgScoreCalm: calcConditionAvg('calm'),
        avgScoreWindy: calcConditionAvg('windy'),
        avgScoreRainy: calcConditionAvg('rainy'),
        avgScoreLinks: calcVenueAvg('links'),
        avgScoreParkland: calcVenueAvg('parkland'),
        avgScoreHeath: calcVenueAvg('heath'),
        avgScoreCliffside: calcVenueAvg('cliffside'),
        avgScoreHome,
        avgScoreAway,
        avgScoreToParHome,
        avgScoreToParAway,
        last3RoundsAvg,
        totalRounds: playerRounds.length,
        homeRounds: homeRounds.length,
        awayRounds: awayRounds.length,
        avgPar,
        isVenueSpecialist,
        venueDifferential,
      }
    }).sort((a, b) => (a.avgScore ?? 999) - (b.avgScore ?? 999))
  }, [squadPlayerIds, profiles, rounds, courseTypeMap, courseNameMap, venueType, homeAwayFilter])

  // Get selected players' stats
  const selectedPlayerStats = useMemo(() => {
    return playerStats.filter(p => selectedPlayers.has(p.id))
  }, [playerStats, selectedPlayers])

  // ============================================
  // ANALYTICS CALCULATIONS
  // ============================================

  const analytics = useMemo(() => {
    if (selectedPlayerStats.length !== requiredPlayers) {
      return {
        projectedScore: null,
        windSpecialist: null,
        courseSpecialist: null,
        homeGuard: null,
        roadWarrior: null,
        currentForm: null,
        teamStrength: 0,
        avgPar: 72,
        venueComparison: null,
      }
    }

    // Get venue-specific score for a player
    const getVenueScore = (player: PlayerStats, venue: VenueType) => {
      switch (venue) {
        case 'links': return player.avgScoreLinks
        case 'parkland': return player.avgScoreParkland
        case 'heath': return player.avgScoreHeath
        case 'cliffside': return player.avgScoreCliffside
        default: return null
      }
    }

    // Get condition-specific scores
    const getConditionScore = (player: PlayerStats) => {
      switch (matchCondition) {
        case 'calm': return player.avgScoreCalm ?? player.avgScore
        case 'windy': return player.avgScoreWindy ?? player.avgScore
        case 'rainy': return player.avgScoreRainy ?? player.avgScore
        default: return player.avgScore
      }
    }

    // Projected Team Score - prioritize venue-specific average, then condition, then overall
    const getProjectedScore = (player: PlayerStats) => {
      const venueScore = getVenueScore(player, venueType)
      if (venueScore !== null) return venueScore
      return getConditionScore(player)
    }

    const validScores = selectedPlayerStats
      .map(p => getProjectedScore(p))
      .filter((s): s is number => s !== null)

    const projectedScore = validScores.length === requiredPlayers
      ? Math.round(validScores.reduce((sum, s) => sum + s, 0) * 10) / 10
      : null

    // Wind Specialist (lowest average in Windy conditions)
    const playersWithWindyScores = selectedPlayerStats
      .filter(p => p.avgScoreWindy !== null)
      .sort((a, b) => (a.avgScoreWindy ?? 999) - (b.avgScoreWindy ?? 999))
    const windSpecialist = playersWithWindyScores.length > 0 ? playersWithWindyScores[0] : null

    // Home Guard (lowest average at home/Portmarnock)
    const playersWithHomeScores = selectedPlayerStats
      .filter(p => p.avgScoreHome !== null && p.homeRounds > 0)
      .sort((a, b) => (a.avgScoreHome ?? 999) - (b.avgScoreHome ?? 999))
    const homeGuard = playersWithHomeScores.length > 0 ? playersWithHomeScores[0] : null

    // Road Warrior (lowest average at away venues)
    const playersWithAwayScores = selectedPlayerStats
      .filter(p => p.avgScoreAway !== null && p.awayRounds > 0)
      .sort((a, b) => (a.avgScoreAway ?? 999) - (b.avgScoreAway ?? 999))
    const roadWarrior = playersWithAwayScores.length > 0 ? playersWithAwayScores[0] : null

    // Course Specialist (lowest average for selected venue type)
    const playersWithVenueScores = selectedPlayerStats
      .filter(p => getVenueScore(p, venueType) !== null)
      .sort((a, b) => (getVenueScore(a, venueType) ?? 999) - (getVenueScore(b, venueType) ?? 999))
    const courseSpecialist = playersWithVenueScores.length > 0 ? playersWithVenueScores[0] : null

    // Current Form (average of last 3 rounds per player)
    const validLast3 = selectedPlayerStats
      .map(p => p.last3RoundsAvg)
      .filter((s): s is number => s !== null)
    const currentForm = validLast3.length > 0
      ? Math.round((validLast3.reduce((sum, s) => sum + s, 0) / validLast3.length) * 10) / 10
      : null

    // Team Strength Meter
    const avgPar = selectedPlayerStats.reduce((sum, p) => sum + (p.avgPar || 72), 0) / requiredPlayers
    const teamAvgScore = validScores.length === requiredPlayers
      ? validScores.reduce((sum, s) => sum + s, 0) / requiredPlayers
      : null

    let teamStrength = 50
    if (teamAvgScore && avgPar) {
      const strokesOverPar = teamAvgScore - avgPar
      teamStrength = Math.max(0, Math.min(100, 50 - (strokesOverPar * 5)))
    }

    // Venue Comparison - compare selected venue to other venues
    const calcTeamVenueAvg = (venue: VenueType) => {
      const scores = selectedPlayerStats
        .map(p => getVenueScore(p, venue))
        .filter((s): s is number => s !== null)
      return scores.length >= Math.min(2, requiredPlayers) // Need at least 2 players with data
        ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10
        : null
    }

    const venueAverages: Record<VenueType, number | null> = {
      links: calcTeamVenueAvg('links'),
      parkland: calcTeamVenueAvg('parkland'),
      heath: calcTeamVenueAvg('heath'),
      cliffside: calcTeamVenueAvg('cliffside'),
    }

    // Find best comparison venue (different from selected)
    let venueComparison: { betterVenue: VenueType; worseVenue: VenueType; difference: number } | null = null
    const selectedVenueAvg = venueAverages[venueType]

    if (selectedVenueAvg !== null) {
      const otherVenues = (Object.keys(venueAverages) as VenueType[])
        .filter(v => v !== venueType && venueAverages[v] !== null)

      if (otherVenues.length > 0) {
        // Find the venue with the biggest difference
        let maxDiff = 0
        let comparisonVenue: VenueType = otherVenues[0]

        otherVenues.forEach(v => {
          const diff = Math.abs(selectedVenueAvg - venueAverages[v]!)
          if (diff > maxDiff) {
            maxDiff = diff
            comparisonVenue = v
          }
        })

        if (maxDiff > 0) {
          const otherVenueAvg = venueAverages[comparisonVenue]!
          if (selectedVenueAvg < otherVenueAvg) {
            venueComparison = {
              betterVenue: venueType,
              worseVenue: comparisonVenue,
              difference: Math.round((otherVenueAvg - selectedVenueAvg) * 10) / 10,
            }
          } else {
            venueComparison = {
              betterVenue: comparisonVenue,
              worseVenue: venueType,
              difference: Math.round((selectedVenueAvg - otherVenueAvg) * 10) / 10,
            }
          }
        }
      }
    }

    return {
      projectedScore,
      windSpecialist,
      courseSpecialist,
      homeGuard,
      roadWarrior,
      currentForm,
      teamStrength,
      avgPar,
      venueComparison,
    }
  }, [selectedPlayerStats, matchCondition, venueType, requiredPlayers])

  // ============================================
  // HANDLERS
  // ============================================

  const handleSquadChange = (squadId: string) => {
    setSelectedSquad(squadId)
    setSelectedPlayers(new Set())
  }

  const handlePlayerToggle = (playerId: string) => {
    const newSelected = new Set(selectedPlayers)
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId)
    } else if (newSelected.size < requiredPlayers) {
      newSelected.add(playerId)
    }
    setSelectedPlayers(newSelected)
  }

  const selectTopPlayers = () => {
    const top = playerStats.slice(0, requiredPlayers).map(p => p.id)
    setSelectedPlayers(new Set(top))
  }

  const handleMatchFormatChange = (format: MatchFormat) => {
    setMatchFormat(format)
    setSelectedPlayers(new Set()) // Reset selection when format changes
  }

  const clearSelection = () => {
    setSelectedPlayers(new Set())
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
          <p className="text-white/60">Loading Team Simulator...</p>
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
            <Target className="w-6 h-6" style={{ color: PGC_GOLD }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold" style={{ color: PGC_GOLD }}>
                Team Selection Simulator
              </h1>
              <Shield className="w-5 h-5" style={{ color: PGC_GOLD }} />
            </div>
            <p className="text-white/60 mt-1">Build your optimal Senior Cup lineup</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Squad Selection & Players */}
        <div className="lg:col-span-2 space-y-6">
          {/* Squad Selector */}
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: PGC_DARK_GREEN, border: `1px solid ${PGC_GOLD}40` }}
          >
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1">
                <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                  <Users className="w-4 h-4" style={{ color: PGC_GOLD }} />
                  Select Squad
                </label>
                <div className="relative">
                  <select
                    value={selectedSquad}
                    onChange={(e) => handleSquadChange(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-white/10 border text-white appearance-none cursor-pointer focus:outline-none transition-colors"
                    style={{ backgroundColor: '#0a3d22', borderColor: `${PGC_GOLD}40` }}
                  >
                    <option value="" style={{ backgroundColor: '#0a3d22' }}>Choose a squad...</option>
                    {squads.map((squad) => (
                      <option key={squad.id} value={squad.id} style={{ backgroundColor: '#0a3d22' }}>
                        {squad.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50 pointer-events-none" />
                </div>
              </div>

              {selectedSquad && (
                <div className="flex gap-2">
                  <button
                    onClick={selectTopPlayers}
                    className="px-4 py-3 rounded-lg text-sm font-medium transition-all"
                    style={{ backgroundColor: `${PGC_GOLD}20`, color: PGC_GOLD, border: `1px solid ${PGC_GOLD}40` }}
                  >
                    Auto Select Top {requiredPlayers}
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-4 py-3 rounded-lg text-sm font-medium transition-all bg-white/10 text-white/70 hover:bg-white/20"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Selection Counter */}
            {selectedSquad && (
              <div className="mt-4 flex items-center gap-2">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: selectedPlayers.size === requiredPlayers ? `${PGC_GOLD}30` : 'rgba(255,255,255,0.1)',
                    color: selectedPlayers.size === requiredPlayers ? PGC_GOLD : 'white',
                  }}
                >
                  <UserCheck className="w-4 h-4" />
                  {selectedPlayers.size} / {requiredPlayers} players selected
                </div>
                {selectedPlayers.size === requiredPlayers && (
                  <Check className="w-5 h-5 text-green-400" />
                )}
              </div>
            )}
          </div>

          {/* Player Selection Grid */}
          {selectedSquad && (
            <div
              className="rounded-xl p-6"
              style={{ backgroundColor: PGC_DARK_GREEN, border: `1px solid ${PGC_GOLD}40` }}
            >
              <h2 className="text-lg font-semibold mb-4" style={{ color: PGC_GOLD }}>
                Squad Members ({playerStats.length})
              </h2>

              {playerStats.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto mb-3 text-white/30" />
                  <p className="text-white/50">No members in this squad</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {playerStats.map((player) => {
                    const isSelected = selectedPlayers.has(player.id)
                    const isDisabled = !isSelected && selectedPlayers.size >= requiredPlayers
                    const venueScore = player[`avgScore${venueType.charAt(0).toUpperCase() + venueType.slice(1)}` as keyof PlayerStats] as number | null

                    return (
                      <button
                        key={player.id}
                        onClick={() => handlePlayerToggle(player.id)}
                        disabled={isDisabled}
                        className={`relative p-4 rounded-xl text-left transition-all ${
                          isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02]'
                        }`}
                        style={{
                          backgroundColor: isSelected ? `${PGC_GOLD}20` : 'rgba(255,255,255,0.05)',
                          border: `2px solid ${isSelected ? PGC_GOLD : 'transparent'}`,
                          // Gold glow for venue specialists
                          boxShadow: player.isVenueSpecialist && !isDisabled
                            ? `0 0 20px ${PGC_GOLD}40, inset 0 0 20px ${PGC_GOLD}10`
                            : 'none',
                        }}
                      >
                        {/* Venue Specialist Badge */}
                        {player.isVenueSpecialist && (
                          <div
                            className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ backgroundColor: PGC_GOLD, color: PGC_DARK_GREEN }}
                          >
                            <Sparkles className="w-3 h-3" />
                            {VENUE_CONFIG[venueType].label} Pro
                          </div>
                        )}

                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-white">{player.name}</p>
                            <div className="flex items-center gap-3 mt-1 text-sm text-white/50">
                              {player.handicap !== null && (
                                <span>HCP: {player.handicap.toFixed(1)}</span>
                              )}
                              <span>{player.totalRounds} rounds</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className="text-xl font-bold"
                              style={{ color: isSelected ? PGC_GOLD : 'white' }}
                            >
                              {player.avgScore ?? '—'}
                            </p>
                            <p className="text-xs text-white/40">avg score</p>
                          </div>
                        </div>

                        {/* Stats Preview */}
                        {player.totalRounds > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {/* Home/Away Stats */}
                            {player.avgScoreHome !== null && (
                              <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300">
                                🏠 {player.avgScoreHome}
                              </span>
                            )}
                            {player.avgScoreAway !== null && (
                              <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300">
                                ✈️ {player.avgScoreAway}
                              </span>
                            )}
                            {/* Weather Conditions */}
                            {player.avgScoreWindy && (
                              <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                                💨 {player.avgScoreWindy}
                              </span>
                            )}
                            {/* Venue Score - Highlighted if specialist */}
                            {venueScore !== null && (
                              <span
                                className="text-xs px-2 py-1 rounded font-medium"
                                style={{
                                  backgroundColor: player.isVenueSpecialist ? `${PGC_GOLD}30` : `${VENUE_CONFIG[venueType].color}20`,
                                  color: player.isVenueSpecialist ? PGC_GOLD : VENUE_CONFIG[venueType].color,
                                }}
                              >
                                {VENUE_CONFIG[venueType].label}: {venueScore}
                                {player.venueDifferential !== null && player.venueDifferential > 0 && (
                                  <span className="ml-1 text-green-400">(-{player.venueDifferential})</span>
                                )}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Selection indicator */}
                        {isSelected && (
                          <div
                            className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: PGC_GOLD }}
                          >
                            <Check className="w-4 h-4" style={{ color: PGC_DARK_GREEN }} />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Analytics & Starting Lineup */}
        <div className="space-y-6">
          {/* Match Format Selector */}
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: PGC_DARK_GREEN, border: `1px solid ${PGC_GOLD}40` }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: PGC_GOLD }}>
              Match Format
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(MATCH_FORMAT_CONFIG) as [MatchFormat, typeof MATCH_FORMAT_CONFIG['3_home']][]).map(([key, config]) => {
                const isActive = matchFormat === key
                const isHome = config.homeAway === 'home'
                const Icon = isHome ? Home : Plane
                const color = isHome ? '#22C55E' : '#F59E0B'

                return (
                  <button
                    key={key}
                    onClick={() => handleMatchFormatChange(key)}
                    className="p-3 rounded-xl text-center transition-all"
                    style={{
                      backgroundColor: isActive ? `${color}30` : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${isActive ? color : 'transparent'}`,
                    }}
                  >
                    <Icon
                      className="w-5 h-5 mx-auto mb-1"
                      style={{ color: isActive ? color : 'white' }}
                    />
                    <span
                      className="text-xs font-medium block"
                      style={{ color: isActive ? color : 'rgba(255,255,255,0.7)' }}
                    >
                      {config.label}
                    </span>
                    <span className="text-[10px] text-white/40">{config.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Venue Type Toggle */}
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: PGC_DARK_GREEN, border: `1px solid ${PGC_GOLD}40` }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: PGC_GOLD }}>
              Venue Type
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(VENUE_CONFIG) as [VenueType, typeof VENUE_CONFIG['links']][]).map(([key, config]) => {
                const Icon = config.icon
                const isActive = venueType === key

                return (
                  <button
                    key={key}
                    onClick={() => setVenueType(key)}
                    className="p-3 rounded-xl text-center transition-all"
                    style={{
                      backgroundColor: isActive ? `${config.color}30` : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${isActive ? config.color : 'transparent'}`,
                    }}
                  >
                    <Icon
                      className="w-5 h-5 mx-auto mb-1"
                      style={{ color: isActive ? config.color : 'white' }}
                    />
                    <span
                      className="text-xs font-medium block"
                      style={{ color: isActive ? config.color : 'rgba(255,255,255,0.7)' }}
                    >
                      {config.label}
                    </span>
                    <span className="text-[10px] text-white/40">{config.description}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Match Conditions Toggle */}
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: PGC_DARK_GREEN, border: `1px solid ${PGC_GOLD}40` }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: PGC_GOLD }}>
              Weather Forecast
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(CONDITION_CONFIG) as [MatchCondition, typeof CONDITION_CONFIG['calm']][]).map(([key, config]) => {
                const Icon = config.icon
                const isActive = matchCondition === key

                return (
                  <button
                    key={key}
                    onClick={() => setMatchCondition(key)}
                    className="p-3 rounded-xl text-center transition-all"
                    style={{
                      backgroundColor: isActive ? `${config.color}30` : 'rgba(255,255,255,0.05)',
                      border: `2px solid ${isActive ? config.color : 'transparent'}`,
                    }}
                  >
                    <Icon
                      className="w-6 h-6 mx-auto mb-1"
                      style={{ color: isActive ? config.color : 'white' }}
                    />
                    <span
                      className="text-xs font-medium"
                      style={{ color: isActive ? config.color : 'rgba(255,255,255,0.7)' }}
                    >
                      {config.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Team Strength Meter */}
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: PGC_DARK_GREEN, border: `1px solid ${PGC_GOLD}40` }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: PGC_GOLD }}>
                Team Strength Meter
              </h3>
              <span className="text-2xl font-bold" style={{ color: PGC_GOLD }}>
                {selectedPlayers.size === requiredPlayers ? `${Math.round(analytics.teamStrength)}%` : '—'}
              </span>
            </div>
            <div
              className="h-4 rounded-full overflow-hidden"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: selectedPlayers.size === requiredPlayers ? `${analytics.teamStrength}%` : '0%',
                  background: `linear-gradient(90deg, ${PGC_GOLD} 0%, #22C55E 100%)`,
                }}
              />
            </div>
            <p className="text-xs text-white/40 mt-2 text-center">
              Based on team average vs par
            </p>
          </div>

          {/* Aggregate Analytics */}
          <div
            className="rounded-xl p-6 space-y-4"
            style={{ backgroundColor: PGC_DARK_GREEN, border: `1px solid ${PGC_GOLD}40` }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: PGC_GOLD }}>
              Team Analytics
            </h3>

            {selectedPlayers.size !== requiredPlayers ? (
              <div className="text-center py-6">
                <AlertCircle className="w-10 h-10 mx-auto mb-3 text-white/30" />
                <p className="text-white/50 text-sm">Select {requiredPlayers} players to see analytics</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Projected Team Score */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: `${PGC_GOLD}15` }}>
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4" style={{ color: PGC_GOLD }} />
                    <span className="text-xs text-white/60 uppercase">
                      Projected Score ({VENUE_CONFIG[venueType].label} / {CONDITION_CONFIG[matchCondition].label})
                    </span>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: PGC_GOLD }}>
                    {analytics.projectedScore ?? '—'}
                  </p>
                  <p className="text-xs text-white/40 mt-1">Combined {requiredPlayers}-player total</p>
                </div>

                {/* Venue Comparison Insight */}
                {analytics.venueComparison && (
                  <div
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: `${VENUE_CONFIG[analytics.venueComparison.betterVenue].color}15` }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4" style={{ color: VENUE_CONFIG[analytics.venueComparison.betterVenue].color }} />
                      <span className="text-xs text-white/60 uppercase">Venue Insight</span>
                    </div>
                    <p className="text-sm text-white">
                      This squad performs{' '}
                      <span className="font-bold" style={{ color: PGC_GOLD }}>
                        {analytics.venueComparison.difference} strokes better
                      </span>{' '}
                      on{' '}
                      <span className="font-medium" style={{ color: VENUE_CONFIG[analytics.venueComparison.betterVenue].color }}>
                        {VENUE_CONFIG[analytics.venueComparison.betterVenue].label}
                      </span>{' '}
                      vs.{' '}
                      <span className="font-medium text-white/70">
                        {VENUE_CONFIG[analytics.venueComparison.worseVenue].label}
                      </span>
                    </p>
                  </div>
                )}

                {/* Current Form */}
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-white/60 uppercase">Current Form</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {analytics.currentForm ?? '—'}
                  </p>
                  <p className="text-xs text-white/40 mt-1">Avg of last 3 rounds per player</p>
                </div>

                {/* Course Specialist */}
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4" style={{ color: VENUE_CONFIG[venueType].color }} />
                    <span className="text-xs text-white/60 uppercase">{VENUE_CONFIG[venueType].label} Specialist</span>
                  </div>
                  {analytics.courseSpecialist ? (
                    <>
                      <p className="text-lg font-bold text-white">
                        {analytics.courseSpecialist.name}
                      </p>
                      <p className="text-xs text-white/40 mt-1">
                        Avg {analytics.courseSpecialist[`avgScore${venueType.charAt(0).toUpperCase() + venueType.slice(1)}` as keyof PlayerStats]} on {VENUE_CONFIG[venueType].label.toLowerCase()} courses
                      </p>
                    </>
                  ) : (
                    <p className="text-white/50 text-sm">No {VENUE_CONFIG[venueType].label.toLowerCase()} round data</p>
                  )}
                </div>

                {/* Wind Specialist */}
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-white/60 uppercase">Wind Specialist</span>
                  </div>
                  {analytics.windSpecialist ? (
                    <>
                      <p className="text-lg font-bold text-white">
                        {analytics.windSpecialist.name}
                      </p>
                      <p className="text-xs text-white/40 mt-1">
                        Avg {analytics.windSpecialist.avgScoreWindy} in windy conditions
                      </p>
                    </>
                  ) : (
                    <p className="text-white/50 text-sm">No windy round data</p>
                  )}
                </div>

                {/* Home Guard */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Home className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-white/60 uppercase">Home Guard</span>
                  </div>
                  {analytics.homeGuard ? (
                    <>
                      <p className="text-lg font-bold text-white">
                        {analytics.homeGuard.name}
                      </p>
                      <p className="text-xs text-white/40 mt-1">
                        Avg {analytics.homeGuard.avgScoreHome} at Portmarnock ({analytics.homeGuard.homeRounds} rounds)
                      </p>
                    </>
                  ) : (
                    <p className="text-white/50 text-sm">No home round data</p>
                  )}
                </div>

                {/* Road Warrior */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Plane className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-white/60 uppercase">Road Warrior</span>
                  </div>
                  {analytics.roadWarrior ? (
                    <>
                      <p className="text-lg font-bold text-white">
                        {analytics.roadWarrior.name}
                      </p>
                      <p className="text-xs text-white/40 mt-1">
                        Avg {analytics.roadWarrior.avgScoreAway} at away venues ({analytics.roadWarrior.awayRounds} rounds)
                      </p>
                    </>
                  ) : (
                    <p className="text-white/50 text-sm">No away round data</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Starting Lineup Cards */}
          {selectedPlayers.size > 0 && (
            <div
              className="rounded-xl p-6"
              style={{ backgroundColor: PGC_DARK_GREEN, border: `1px solid ${PGC_GOLD}40` }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5" style={{ color: PGC_GOLD }} />
                <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: PGC_GOLD }}>
                  Starting Lineup
                </h3>
              </div>

              <div className="space-y-2">
                {selectedPlayerStats.map((player, index) => {
                  const venueScore = player[`avgScore${venueType.charAt(0).toUpperCase() + venueType.slice(1)}` as keyof PlayerStats] as number | null
                  const conditionScore = matchCondition === 'calm'
                    ? player.avgScoreCalm
                    : matchCondition === 'windy'
                      ? player.avgScoreWindy
                      : player.avgScoreRainy

                  const displayScore = venueScore ?? conditionScore ?? player.avgScore

                  return (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 p-3 rounded-lg relative"
                      style={{
                        backgroundColor: player.isVenueSpecialist ? `${PGC_GOLD}15` : 'rgba(255,255,255,0.05)',
                        border: player.isVenueSpecialist ? `1px solid ${PGC_GOLD}40` : 'none',
                      }}
                    >
                      {/* Position Badge */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ backgroundColor: PGC_GOLD, color: PGC_DARK_GREEN }}
                      >
                        {index + 1}
                      </div>

                      {/* Player Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white truncate">{player.name}</p>
                          {player.isVenueSpecialist && (
                            <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: PGC_GOLD }} />
                          )}
                        </div>
                        <p className="text-xs text-white/40">
                          Form: {player.last3RoundsAvg ?? '—'}
                        </p>
                      </div>

                      {/* Score */}
                      <div className="text-right">
                        <p
                          className="text-lg font-bold"
                          style={{ color: displayScore ? PGC_GOLD : 'rgba(255,255,255,0.5)' }}
                        >
                          {displayScore ?? '—'}
                        </p>
                        <p className="text-xs text-white/30">
                          {venueScore ? VENUE_CONFIG[venueType].label : conditionScore ? CONDITION_CONFIG[matchCondition].label : 'avg'}
                        </p>
                      </div>
                    </div>
                  )
                })}

                {/* Empty slots */}
                {Array.from({ length: Math.max(0, requiredPlayers - selectedPlayers.size) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-3 p-3 rounded-lg border-2 border-dashed"
                    style={{ borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm text-white/30 bg-white/5">
                      {selectedPlayers.size + i + 1}
                    </div>
                    <p className="text-white/30 text-sm">Select a player</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
