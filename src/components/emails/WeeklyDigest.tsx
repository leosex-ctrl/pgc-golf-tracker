import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from '@react-email/components'

// ============================================
// TYPES
// ============================================

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

interface WeeklyDigestProps {
  playerOfTheWeek: PlayerOfTheWeek | null
  squadStats: SquadStat[]
  totalRoundsThisWeek: number
  weekStartDate: string
  weekEndDate: string
}

// ============================================
// STYLES
// ============================================

const PGC_DARK_GREEN = '#0D4D2B'
const PGC_GOLD = '#C9A227'

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
}

const header = {
  backgroundColor: PGC_DARK_GREEN,
  padding: '32px 40px',
  textAlign: 'center' as const,
}

const headerLogo = {
  backgroundColor: PGC_GOLD,
  color: PGC_DARK_GREEN,
  width: '60px',
  height: '60px',
  borderRadius: '12px',
  display: 'inline-block',
  lineHeight: '60px',
  fontSize: '24px',
  fontWeight: 'bold' as const,
  marginBottom: '16px',
}

const headerTitle = {
  color: PGC_GOLD,
  fontSize: '28px',
  fontWeight: 'bold' as const,
  margin: '0',
  padding: '0',
}

const headerSubtitle = {
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '14px',
  margin: '8px 0 0 0',
}

const content = {
  padding: '32px 40px',
}

const sectionTitle = {
  color: PGC_DARK_GREEN,
  fontSize: '18px',
  fontWeight: 'bold' as const,
  margin: '0 0 16px 0',
  borderBottom: `2px solid ${PGC_GOLD}`,
  paddingBottom: '8px',
}

const playerOfWeekBox = {
  backgroundColor: `${PGC_GOLD}15`,
  borderRadius: '12px',
  padding: '24px',
  textAlign: 'center' as const,
  border: `1px solid ${PGC_GOLD}40`,
}

const playerOfWeekLabel = {
  color: PGC_GOLD,
  fontSize: '12px',
  fontWeight: 'bold' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '1px',
  margin: '0 0 8px 0',
}

const playerOfWeekName = {
  color: PGC_DARK_GREEN,
  fontSize: '24px',
  fontWeight: 'bold' as const,
  margin: '0 0 8px 0',
}

const playerOfWeekScore = {
  color: PGC_GOLD,
  fontSize: '36px',
  fontWeight: 'bold' as const,
  margin: '0 0 8px 0',
}

const playerOfWeekDetails = {
  color: '#666',
  fontSize: '14px',
  margin: '0',
}

const table = {
  width: '100%',
  borderCollapse: 'collapse' as const,
}

const tableHeader = {
  backgroundColor: PGC_DARK_GREEN,
  color: 'white',
  padding: '12px 16px',
  textAlign: 'left' as const,
  fontSize: '12px',
  fontWeight: 'bold' as const,
  textTransform: 'uppercase' as const,
}

const tableHeaderRight = {
  ...tableHeader,
  textAlign: 'right' as const,
}

const tableCell = {
  padding: '12px 16px',
  borderBottom: '1px solid #eee',
  fontSize: '14px',
  color: '#333',
}

const tableCellRight = {
  ...tableCell,
  textAlign: 'right' as const,
}

const tableCellBold = {
  ...tableCell,
  fontWeight: 'bold' as const,
  color: PGC_DARK_GREEN,
}

const activityBox = {
  backgroundColor: '#f8f9fa',
  borderRadius: '12px',
  padding: '24px',
  textAlign: 'center' as const,
}

const activityNumber = {
  color: PGC_DARK_GREEN,
  fontSize: '48px',
  fontWeight: 'bold' as const,
  margin: '0',
}

const activityLabel = {
  color: '#666',
  fontSize: '14px',
  margin: '8px 0 0 0',
}

const footer = {
  padding: '24px 40px',
  backgroundColor: '#f8f9fa',
  textAlign: 'center' as const,
}

const footerText = {
  color: '#999',
  fontSize: '12px',
  margin: '0',
}

const noDataText = {
  color: '#999',
  fontSize: '14px',
  textAlign: 'center' as const,
  padding: '24px',
}

const divider = {
  borderColor: '#eee',
  margin: '32px 0',
}

// ============================================
// COMPONENT
// ============================================

export default function WeeklyDigest({
  playerOfTheWeek,
  squadStats,
  totalRoundsThisWeek,
  weekStartDate,
  weekEndDate,
}: WeeklyDigestProps) {
  return (
    <Html>
      <Head />
      <Preview>PGC Performance Update - Weekly Digest ({weekStartDate} - {weekEndDate})</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <div style={headerLogo}>PGC</div>
            <Heading style={headerTitle}>PGC Performance Update</Heading>
            <Text style={headerSubtitle}>
              Weekly Digest: {weekStartDate} - {weekEndDate}
            </Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            {/* Player of the Week */}
            <Heading as="h2" style={sectionTitle}>
              Player of the Week
            </Heading>
            {playerOfTheWeek ? (
              <div style={playerOfWeekBox}>
                <Text style={playerOfWeekLabel}>Lowest Gross Score</Text>
                <Text style={playerOfWeekName}>{playerOfTheWeek.name}</Text>
                <Text style={playerOfWeekScore}>{playerOfTheWeek.score}</Text>
                <Text style={playerOfWeekDetails}>
                  {playerOfTheWeek.courseName} &bull; {playerOfTheWeek.date}
                </Text>
              </div>
            ) : (
              <Text style={noDataText}>No rounds recorded this week</Text>
            )}

            <Hr style={divider} />

            {/* Squad Statistics */}
            <Heading as="h2" style={sectionTitle}>
              Squad Statistics
            </Heading>
            {squadStats.length > 0 ? (
              <table style={table}>
                <thead>
                  <tr>
                    <th style={tableHeader}>Squad</th>
                    <th style={tableHeaderRight}>Avg Score</th>
                    <th style={tableHeaderRight}>Rounds</th>
                  </tr>
                </thead>
                <tbody>
                  {squadStats.map((stat, index) => (
                    <tr key={index}>
                      <td style={tableCellBold}>{stat.squadName}</td>
                      <td style={tableCellRight}>{stat.avgScore.toFixed(1)}</td>
                      <td style={tableCellRight}>{stat.roundsPlayed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Text style={noDataText}>No squad activity this week</Text>
            )}

            <Hr style={divider} />

            {/* Activity Summary */}
            <Heading as="h2" style={sectionTitle}>
              Weekly Activity
            </Heading>
            <div style={activityBox}>
              <Text style={activityNumber}>{totalRoundsThisWeek}</Text>
              <Text style={activityLabel}>
                {totalRoundsThisWeek === 1 ? 'Round' : 'Rounds'} played this week
              </Text>
            </div>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Portmarnock Golf Club Performance Tracker
            </Text>
            <Text style={footerText}>
              This is an automated weekly digest. Do not reply to this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ============================================
// PLAIN TEXT VERSION (for email clients that don't support HTML)
// ============================================

export function getWeeklyDigestPlainText({
  playerOfTheWeek,
  squadStats,
  totalRoundsThisWeek,
  weekStartDate,
  weekEndDate,
}: WeeklyDigestProps): string {
  let text = `PGC PERFORMANCE UPDATE\n`
  text += `Weekly Digest: ${weekStartDate} - ${weekEndDate}\n`
  text += `${'='.repeat(50)}\n\n`

  text += `PLAYER OF THE WEEK\n`
  text += `${'-'.repeat(20)}\n`
  if (playerOfTheWeek) {
    text += `${playerOfTheWeek.name}\n`
    text += `Score: ${playerOfTheWeek.score}\n`
    text += `${playerOfTheWeek.courseName} - ${playerOfTheWeek.date}\n\n`
  } else {
    text += `No rounds recorded this week\n\n`
  }

  text += `SQUAD STATISTICS\n`
  text += `${'-'.repeat(20)}\n`
  if (squadStats.length > 0) {
    squadStats.forEach((stat) => {
      text += `${stat.squadName}: Avg ${stat.avgScore.toFixed(1)} (${stat.roundsPlayed} rounds)\n`
    })
    text += `\n`
  } else {
    text += `No squad activity this week\n\n`
  }

  text += `WEEKLY ACTIVITY\n`
  text += `${'-'.repeat(20)}\n`
  text += `${totalRoundsThisWeek} ${totalRoundsThisWeek === 1 ? 'round' : 'rounds'} played this week\n\n`

  text += `${'='.repeat(50)}\n`
  text += `Portmarnock Golf Club Performance Tracker\n`
  text += `This is an automated weekly digest.\n`

  return text
}
