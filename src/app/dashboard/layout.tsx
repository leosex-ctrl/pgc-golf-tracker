'use client'

import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import ApprovalGuard from '@/components/ApprovalGuard'
import MobileHeader from '@/components/MobileHeader'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleMobileNav = () => setSidebarOpen(false)

  return (
    <ApprovalGuard>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Mobile Header - Hidden on desktop */}
        <MobileHeader onMenuClick={() => setSidebarOpen(true)} />

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Sidebar - Hidden on mobile */}
          <div className="hidden md:flex">
            <Sidebar />
          </div>

          {/* Mobile Sidebar - Slide Over */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 md:hidden">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setSidebarOpen(false)}
                aria-hidden="true"
              />

              {/* Sidebar Panel */}
              <div className="relative z-10 h-full w-64">
                <Sidebar onMobileNav={handleMobileNav} />
              </div>
            </div>
          )}

          {/* Main Content Area - Scrollable */}
          <main
            className="flex-1 w-full overflow-y-auto p-4 md:p-8 pt-20 md:pt-8"
            style={{ backgroundColor: '#1B4D3E' }}
          >
            {children}
          </main>
        </div>
      </div>
    </ApprovalGuard>
  )
}
