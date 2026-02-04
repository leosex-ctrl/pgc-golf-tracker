import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'OK' : 'MISSING')
  console.error('- SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? 'OK' : 'MISSING')
  process.exit(1)
}

// Create Supabase admin client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Squad members to create
const squadMembers = [
  { name: 'Shane', email: 'shane@pgc-test.com', handicap: 0.1 },
  { name: 'Padraig', email: 'padraig@pgc-test.com', handicap: 0.5 },
  { name: 'Rory', email: 'rory@pgc-test.com', handicap: 4.2 },
  { name: 'Darragh', email: 'darragh@pgc-test.com', handicap: 8.5 },
]

async function seedSquad() {
  console.log('Starting squad seed...\n')

  for (const member of squadMembers) {
    console.log(`Creating user: ${member.name} (${member.email})...`)

    // Create auth user using admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: member.email,
      password: 'TestPassword123!',
      email_confirm: true, // Auto-confirm email
    })

    if (authError) {
      // Check if user already exists
      if (authError.message.includes('already been registered')) {
        console.log(`  User ${member.email} already exists, fetching...`)

        // Get existing user by email
        const { data: existingUsers } = await supabase.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find(u => u.email === member.email)

        if (existingUser) {
          // Update profile for existing user
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: existingUser.id,
              full_name: member.name,
              email_address: member.email,
              handicap_index: member.handicap,
              home_club: 'Portmarnock Golf Club',
              disclaimer_accepted: true,
            })

          if (profileError) {
            console.error(`  Profile update error for ${member.name}:`, profileError.message)
          } else {
            console.log(`  Updated profile for ${member.name} with handicap ${member.handicap}`)
          }
        }
        continue
      }

      console.error(`  Auth error for ${member.name}:`, authError.message)
      continue
    }

    if (!authData.user) {
      console.error(`  No user returned for ${member.name}`)
      continue
    }

    console.log(`  Auth user created: ${authData.user.id}`)

    // Create profile for the new user
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: authData.user.id,
        full_name: member.name,
        email_address: member.email,
        handicap_index: member.handicap,
        home_club: 'Portmarnock Golf Club',
        disclaimer_accepted: true,
      })

    if (profileError) {
      console.error(`  Profile error for ${member.name}:`, profileError.message)
    } else {
      console.log(`  Profile created for ${member.name} with handicap ${member.handicap}`)
    }
  }

  console.log('\nSquad seed complete!')
  console.log('\nTest accounts created:')
  console.log('========================')
  squadMembers.forEach(m => {
    console.log(`${m.name.padEnd(10)} | ${m.email.padEnd(25)} | Handicap: ${m.handicap}`)
  })
  console.log('========================')
  console.log('Password for all accounts: TestPassword123!')
}

seedSquad().catch(console.error)
