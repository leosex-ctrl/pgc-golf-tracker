import Sidebar from '@/components/Sidebar'
import ApprovalGuard from '@/components/ApprovalGuard'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ApprovalGuard>
      <div className="flex h-screen overflow-hidden">
        {/* Fixed Sidebar */}
        <Sidebar />

        {/* Main Content Area - Scrollable */}
        <main
          className="flex-1 overflow-y-auto p-8"
          style={{ backgroundColor: '#1B4D3E' }}
        >
          {children}
        </main>
      </div>
    </ApprovalGuard>
  )
}
