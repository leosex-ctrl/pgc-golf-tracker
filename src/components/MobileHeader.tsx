'use client'

import { Menu } from 'lucide-react'

interface MobileHeaderProps {
  onMenuClick: () => void
}

export default function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#1B4D3E] z-40 flex items-center px-4 shadow-lg">
      {/* Hamburger Menu - Far Left */}
      <button
        onClick={onMenuClick}
        className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Logo - Centered */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#C9A227] flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="text-white font-semibold">PGC Performance</span>
        </div>
      </div>

      {/* Spacer to balance the layout */}
      <div className="w-10" />
    </header>
  )
}
