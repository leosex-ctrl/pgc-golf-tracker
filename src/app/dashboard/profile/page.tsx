import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import ProfileForm from '@/components/ProfileForm'

async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore - called from Server Component
          }
        },
      },
    }
  )
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, home_club, handicap_index, gui_number')
    .eq('id', user.id)
    .single()

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">My Profile</h1>
      <ProfileForm
        initialData={{
          full_name: profile?.full_name || '',
          home_club: profile?.home_club || '',
          handicap_index: profile?.handicap_index ?? null,
          gui_number: profile?.gui_number || '',
        }}
      />
    </div>
  )
}
