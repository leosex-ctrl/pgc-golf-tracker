'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  PlusCircle,
  Flag,
  BarChart3,
  Trophy,
  Target,
  Users,
  FileSpreadsheet,
  Crosshair,
  LogOut,
  UserCog,
  History,
  MapPin
} from 'lucide-react'
import { createClient } from '@/lib/supabase'

// ============================================
// NAVIGATION ITEMS
// ============================================

interface NavItem {
  label: string
  href: string
  icon: typeof LayoutDashboard
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Leaderboard',
    href: '/dashboard/leaderboard',
    icon: Trophy,
  },
  {
    label: 'Squads',
    href: '/dashboard/squads',
    icon: Users,
  },
  {
    label: 'Add Round',
    href: '/dashboard/add-round',
    icon: PlusCircle,
  },
  {
    label: 'Round History',
    href: '/dashboard/rounds',
    icon: History,
  },
  {
    label: 'Add Course',
    href: '/dashboard/add-course',
    icon: Flag,
  },
  {
    label: 'Courses',
    href: '/dashboard/courses',
    icon: MapPin,
  },
  {
    label: 'Statistics',
    href: '/dashboard/stats',
    icon: BarChart3,
  },
  {
    label: 'My Statistics',
    href: '/dashboard/statistics',
    icon: Target,
  },
  {
    label: 'Reports',
    href: '/dashboard/reports',
    icon: FileSpreadsheet,
    adminOnly: true,
  },
  {
    label: 'Simulator',
    href: '/dashboard/simulator',
    icon: Crosshair,
    adminOnly: true,
  },
  {
    label: 'User Management',
    href: '/dashboard/admin/users',
    icon: UserCog,
    adminOnly: true,
  },
]

// ============================================
// SIDEBAR COMPONENT
// ============================================

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdminStatus()
  }, [])

  const checkAdminStatus = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        // Debug: Log the raw role value from database
        console.log('[Sidebar] Raw profile data:', profile)
        console.log('[Sidebar] Raw role value:', profile?.role)

        // Normalize role: lowercase and replace spaces with underscores
        const rawRole = profile?.role || ''
        const normalizedRole = rawRole.toLowerCase().replace(/\s+/g, '_')

        console.log('[Sidebar] Normalized role:', normalizedRole)

        const hasAdminAccess = ['admin', 'super_admin'].includes(normalizedRole)
        console.log('[Sidebar] Has admin access:', hasAdminAccess)

        setIsAdmin(hasAdminAccess)
      }
    } catch (err) {
      console.error('Error checking admin status:', err)
    }
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard'
    }
    return pathname.startsWith(href)
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Filter nav items based on admin status
  const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <aside
      className="w-64 h-screen flex flex-col flex-shrink-0"
      style={{
        backgroundColor: '#153c30',
        borderRight: '1px solid #C9A227',
      }}
    >
      {/* Logo / Brand */}
      <div className="p-6" style={{ borderBottom: '1px solid rgba(201, 162, 39, 0.3)' }}>
        <Link href="/dashboard" className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg"
            style={{ backgroundColor: '#C9A227', color: '#153c30' }}
          >
            PGC
          </div>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">Performance</h1>
            <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>Golf Tracker</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {visibleNavItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group"
                  style={{
                    backgroundColor: active ? 'rgba(201, 162, 39, 0.15)' : 'transparent',
                    color: active ? '#C9A227' : 'rgba(255, 255, 255, 0.8)',
                  }}
                >
                  <Icon
                    className="w-5 h-5 transition-colors group-hover:text-[#C9A227]"
                    style={{ color: active ? '#C9A227' : 'rgba(255, 255, 255, 0.6)' }}
                  />
                  <span
                    className="font-medium transition-colors group-hover:text-[#C9A227]"
                  >
                    {item.label}
                  </span>
                  {active && (
                    <div
                      className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: '#C9A227' }}
                    />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer / Logout */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(201, 162, 39, 0.3)' }}>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group"
          style={{ color: 'rgba(255, 255, 255, 0.6)' }}
        >
          <LogOut className="w-5 h-5 transition-colors group-hover:text-[#C9A227]" />
          <span className="font-medium transition-colors group-hover:text-[#C9A227]">
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  )
}
