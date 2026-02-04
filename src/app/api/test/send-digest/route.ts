import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { createElement } from 'react'
import { render } from '@react-email/render'
import WeeklyDigest, { getWeeklyDigestPlainText } from '@/components/emails/WeeklyDigest'

// ============================================
// TEST ENDPOINT - Send digest to Super Admin
// This should be removed or protected in production
// ============================================

function normalizeRole(role: string): string {
  return (role || '').toLowerCase().replace(/\s+/g, '_')
}

export async function GET(request: NextRequest) {
  try {
    // Only allow in development or with admin auth
    const isDev = process.env.NODE_ENV === 'development'
    const testSecret = request.nextUrl.searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET
    // Allow overriding recipient for testing (Resend test mode only sends to registered email)
    const overrideEmail = request.nextUrl.searchParams.get('to')

    if (!isDev && testSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Initialize clients
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const resendApiKey = process.env.RESEND_API_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({
        error: 'Missing Supabase credentials',
        hint: 'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set'
      }, { status: 500 })
    }

    if (!resendApiKey) {
      return NextResponse.json({
        error: 'Missing Resend API key',
        hint: 'Ensure RESEND_API_KEY is set in .env.local'
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const resend = new Resend(resendApiKey)

    // Find Super Admin
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')

    if (profilesError) {
      return NextResponse.json({
        error: 'Failed to fetch profiles',
        details: profilesError.message
      }, { status: 500 })
    }

    const superAdmin = profiles?.find(p => {
      const normalizedRole = normalizeRole(p.role)
      return normalizedRole === 'super_admin' && p.email
    })

    if (!superAdmin) {
      return NextResponse.json({
        error: 'No Super Admin found',
        profiles: profiles?.map(p => ({ name: p.full_name, role: p.role, email: p.email ? '***' : null }))
      }, { status: 404 })
    }

    // Fetch real data for the last 7 days
    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 7)

    const { data: rounds } = await supabase
      .from('rounds')
      .select('id, user_id, course_id, date_of_round, total_strokes')
      .gte('date_of_round', startDate.toISOString().split('T')[0])
      .lte('date_of_round', now.toISOString().split('T')[0])
      .not('total_strokes', 'is', null)
      .order('total_strokes', { ascending: true })

    const { data: courses } = await supabase.from('courses').select('id, name')
    const { data: squads } = await supabase.from('squads').select('id, name')
    const { data: squadMembers } = await supabase.from('squad_members').select('squad_id, user_id')

    // Create lookup maps
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
    const courseMap = new Map(courses?.map(c => [c.id, c]) || [])

    // Calculate Player of the Week
    let playerOfTheWeek = null
    if (rounds && rounds.length > 0) {
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

    // Calculate Squad Statistics
    const userSquadMap = new Map<string, string[]>()
    squadMembers?.forEach(sm => {
      const existing = userSquadMap.get(sm.user_id) || []
      existing.push(sm.squad_id)
      userSquadMap.set(sm.user_id, existing)
    })

    const squadRoundsMap = new Map<string, number[]>()
    rounds?.forEach(round => {
      if (round.total_strokes) {
        const userSquads = userSquadMap.get(round.user_id) || []
        userSquads.forEach(squadId => {
          const existing = squadRoundsMap.get(squadId) || []
          existing.push(round.total_strokes!)
          squadRoundsMap.set(squadId, existing)
        })
      }
    })

    const squadStats: { squadName: string; avgScore: number; roundsPlayed: number }[] = []
    squads?.forEach(squad => {
      const scores = squadRoundsMap.get(squad.id)
      if (scores && scores.length > 0) {
        squadStats.push({
          squadName: squad.name,
          avgScore: scores.reduce((sum, s) => sum + s, 0) / scores.length,
          roundsPlayed: scores.length,
        })
      }
    })
    squadStats.sort((a, b) => a.avgScore - b.avgScore)

    // Prepare email data
    const emailData = {
      playerOfTheWeek,
      squadStats,
      totalRoundsThisWeek: rounds?.length || 0,
      weekStartDate: startDate.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }),
      weekEndDate: now.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }),
    }

    // Send test email
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    // Use override email if provided (for Resend test mode), otherwise use Super Admin email
    const recipientEmail = overrideEmail || superAdmin.email

    // Render the React component to HTML
    const emailHtml = await render(createElement(WeeklyDigest, emailData))

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: `PGC Performance <${fromEmail}>`,
      to: recipientEmail,
      subject: `[TEST] PGC Weekly Digest - ${emailData.weekStartDate} to ${emailData.weekEndDate}`,
      html: emailHtml,
      text: getWeeklyDigestPlainText(emailData),
    })

    if (emailError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to send email',
        details: emailError.message,
        recipient: recipientEmail,
        data: emailData
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Test digest email sent successfully!`,
      recipient: {
        name: overrideEmail ? 'Test Override' : superAdmin.full_name,
        email: recipientEmail,
        role: overrideEmail ? 'test' : superAdmin.role
      },
      emailId: emailResult?.id,
      data: {
        playerOfTheWeek: playerOfTheWeek?.name || 'No rounds this week',
        totalRounds: rounds?.length || 0,
        squadStats: squadStats.length,
        dateRange: `${emailData.weekStartDate} - ${emailData.weekEndDate}`
      }
    })

  } catch (error: any) {
    console.error('[Test Digest] Error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}
