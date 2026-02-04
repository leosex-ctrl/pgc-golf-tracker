import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createElement } from 'react'
import { render } from '@react-email/render'
import WeeklyDigest, { getWeeklyDigestPlainText } from '@/components/emails/WeeklyDigest'

// ============================================
// TYPES
// ============================================

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
}

interface Round {
  id: string
  user_id: string
  course_id: string
  date_of_round: string
  total_strokes: number | null
}

interface Course {
  id: string
  name: string
}

interface Squad {
  id: string
  name: string
}

interface SquadMember {
  squad_id: string
  user_id: string
}

interface PlayerOfTheWeek {
  name: string
  score: number
  courseName: string
  date: string
}

interface SquadStat {
  squadName: string
  avgScore: number
  roundsPlayed: number
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDateRange() {
  const now = new Date()
  const endDate = new Date(now)
  const startDate = new Date(now)
  startDate.setDate(startDate.getDate() - 7)

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    startDateFormatted: startDate.toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    endDateFormatted: endDate.toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
  }
}

function normalizeRole(role: string): string {
  return (role || '').toLowerCase().replace(/\s+/g, '_')
}

// ============================================
// API ROUTE HANDLER
// ============================================

export async function GET(request: NextRequest) {
  try {
    // ============================================
    // SECURITY CHECK - Verify CRON_SECRET
    // ============================================
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error('[Weekly Digest] CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Check for Bearer token or query param (for Vercel Cron)
    const providedSecret = authHeader?.replace('Bearer ', '') ||
      request.nextUrl.searchParams.get('secret')

    if (providedSecret !== cronSecret) {
      console.error('[Weekly Digest] Invalid or missing CRON_SECRET')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // ============================================
    // INITIALIZE CLIENTS
    // ============================================
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Weekly Digest] Missing Supabase credentials')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      console.error('[Weekly Digest] Missing Resend API key')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Use service role key for server-side access
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    // ============================================
    // FETCH DATA
    // ============================================
    const { startDate, endDate, startDateFormatted, endDateFormatted } = getDateRange()

    console.log(`[Weekly Digest] Fetching data for ${startDate} to ${endDate}`)

    // Fetch all required data in parallel
    const [roundsRes, profilesRes, coursesRes, squadsRes, membersRes] = await Promise.all([
      supabase
        .from('rounds')
        .select('id, user_id, course_id, date_of_round, total_strokes')
        .gte('date_of_round', startDate)
        .lte('date_of_round', endDate)
        .not('total_strokes', 'is', null)
        .order('total_strokes', { ascending: true }),
      supabase.from('profiles').select('id, full_name, email, role'),
      supabase.from('courses').select('id, name'),
      supabase.from('squads').select('id, name'),
      supabase.from('squad_members').select('squad_id, user_id'),
    ])

    if (roundsRes.error) {
      console.error('[Weekly Digest] Error fetching rounds:', roundsRes.error)
    }
    if (profilesRes.error) {
      console.error('[Weekly Digest] Error fetching profiles:', profilesRes.error)
    }
    if (coursesRes.error) {
      console.error('[Weekly Digest] Error fetching courses:', coursesRes.error)
    }
    if (squadsRes.error) {
      console.error('[Weekly Digest] Error fetching squads:', squadsRes.error)
    }
    if (membersRes.error) {
      console.error('[Weekly Digest] Error fetching members:', membersRes.error)
    }

    const rounds = (roundsRes.data || []) as Round[]
    const profiles = (profilesRes.data || []) as Profile[]
    const courses = (coursesRes.data || []) as Course[]
    const squads = (squadsRes.data || []) as Squad[]
    const squadMembers = (membersRes.data || []) as SquadMember[]

    // Create lookup maps
    const profileMap = new Map(profiles.map((p) => [p.id, p]))
    const courseMap = new Map(courses.map((c) => [c.id, c]))

    // ============================================
    // CALCULATE PLAYER OF THE WEEK
    // ============================================
    let playerOfTheWeek: PlayerOfTheWeek | null = null

    if (rounds.length > 0) {
      // Rounds are already sorted by total_strokes ascending
      const bestRound = rounds[0]
      const player = profileMap.get(bestRound.user_id)
      const course = courseMap.get(bestRound.course_id)

      if (player && bestRound.total_strokes) {
        playerOfTheWeek = {
          name: player.full_name || 'Unknown Player',
          score: bestRound.total_strokes,
          courseName: course?.name || 'Unknown Course',
          date: new Date(bestRound.date_of_round).toLocaleDateString('en-IE', {
            day: 'numeric',
            month: 'short',
          }),
        }
      }
    }

    // ============================================
    // CALCULATE SQUAD STATISTICS
    // ============================================
    const squadStats: SquadStat[] = []

    // Create a map of user_id to squad_ids
    const userSquadMap = new Map<string, string[]>()
    squadMembers.forEach((sm) => {
      const existing = userSquadMap.get(sm.user_id) || []
      existing.push(sm.squad_id)
      userSquadMap.set(sm.user_id, existing)
    })

    // Calculate stats per squad
    const squadRoundsMap = new Map<string, number[]>()

    rounds.forEach((round) => {
      if (round.total_strokes) {
        const userSquads = userSquadMap.get(round.user_id) || []
        userSquads.forEach((squadId) => {
          const existing = squadRoundsMap.get(squadId) || []
          existing.push(round.total_strokes!)
          squadRoundsMap.set(squadId, existing)
        })
      }
    })

    squads.forEach((squad) => {
      const scores = squadRoundsMap.get(squad.id)
      if (scores && scores.length > 0) {
        const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length
        squadStats.push({
          squadName: squad.name,
          avgScore,
          roundsPlayed: scores.length,
        })
      }
    })

    // Sort squads by average score (ascending)
    squadStats.sort((a, b) => a.avgScore - b.avgScore)

    // ============================================
    // GET ADMIN RECIPIENTS
    // ============================================
    const adminRecipients = profiles.filter((p) => {
      const normalizedRole = normalizeRole(p.role)
      return ['admin', 'super_admin'].includes(normalizedRole) && p.email
    })

    if (adminRecipients.length === 0) {
      console.log('[Weekly Digest] No admin recipients found')
      return NextResponse.json({
        success: true,
        message: 'No admin recipients found',
        stats: {
          totalRounds: rounds.length,
          squadStats: squadStats.length,
          recipients: 0,
        },
      })
    }

    console.log(`[Weekly Digest] Sending to ${adminRecipients.length} admins`)

    // ============================================
    // PREPARE EMAIL DATA
    // ============================================
    const emailData = {
      playerOfTheWeek,
      squadStats,
      totalRoundsThisWeek: rounds.length,
      weekStartDate: startDateFormatted,
      weekEndDate: endDateFormatted,
    }

    // ============================================
    // SEND EMAILS
    // ============================================
    const emailResults: { email: string; success: boolean; error?: string }[] = []
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@pgc-performance.com'

    // Pre-render the email HTML once (same content for all recipients)
    const emailHtml = await render(createElement(WeeklyDigest, emailData))

    for (const admin of adminRecipients) {
      try {
        const { data, error } = await resend.emails.send({
          from: `PGC Performance <${fromEmail}>`,
          to: admin.email,
          subject: `PGC Weekly Digest - ${startDateFormatted} to ${endDateFormatted}`,
          html: emailHtml,
          text: getWeeklyDigestPlainText(emailData),
        })

        if (error) {
          console.error(`[Weekly Digest] Failed to send to ${admin.email}:`, error)
          emailResults.push({ email: admin.email, success: false, error: error.message })
        } else {
          console.log(`[Weekly Digest] Sent to ${admin.email}, ID: ${data?.id}`)
          emailResults.push({ email: admin.email, success: true })
        }
      } catch (err: any) {
        console.error(`[Weekly Digest] Exception sending to ${admin.email}:`, err)
        emailResults.push({ email: admin.email, success: false, error: err.message })
      }
    }

    // ============================================
    // RETURN RESPONSE
    // ============================================
    const successCount = emailResults.filter((r) => r.success).length
    const failCount = emailResults.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Weekly digest sent to ${successCount} recipients`,
      stats: {
        totalRounds: rounds.length,
        playerOfTheWeek: playerOfTheWeek?.name || null,
        squadStats: squadStats.length,
        recipients: {
          total: adminRecipients.length,
          success: successCount,
          failed: failCount,
        },
      },
      results: emailResults,
    })
  } catch (error: any) {
    console.error('[Weekly Digest] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Also support POST for some cron services
export async function POST(request: NextRequest) {
  return GET(request)
}
