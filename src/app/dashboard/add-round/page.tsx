'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload } from 'lucide-react'
import ScorecardUploader from '@/components/ScorecardUploader'
import RoundEntryForm from '@/components/RoundEntryForm'
import { GeminiExtractedData } from '@/app/actions/gemini-upload'

// ============================================
// TYPES
// ============================================

type ViewState = 'upload' | 'form'

// ============================================
// COMPONENT
// ============================================

export default function AddRoundPage() {
  const [view, setView] = useState<ViewState>('upload')
  const [extractedData, setExtractedData] = useState<GeminiExtractedData | null>(null)

  // ============================================
  // HANDLERS
  // ============================================

  const handleDataExtracted = (data: GeminiExtractedData) => {
    setExtractedData(data)
    setView('form')
  }

  const handleBackToUpload = () => {
    setView('upload')
    setExtractedData(null)
  }

  const handleSaveRound = (formData: unknown) => {
    // Round is saved via the RoundEntryForm component directly
    console.log('Round saved:', formData)
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1B4D3E' }}>
      {/* Back Link */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#C9A227' }}>
            Add New Round
          </h1>
          <p className="text-white/70 text-sm mt-1">
            {view === 'upload'
              ? 'Upload a scorecard screenshot or enter scores manually'
              : 'Review and edit your round details'}
          </p>
        </div>

        {/* Upload View */}
        {view === 'upload' && (
          <div className="space-y-6">
            {/* AI Upload Section */}
            <div
              className="rounded-xl p-6"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(201, 162, 39, 0.3)',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(201, 162, 39, 0.2)' }}
                >
                  <span className="text-sm font-bold" style={{ color: '#C9A227' }}>
                    AI
                  </span>
                </div>
                <h2 className="text-lg font-semibold" style={{ color: '#C9A227' }}>
                  Smart Upload
                </h2>
              </div>

              <ScorecardUploader onDataExtracted={handleDataExtracted} />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-white/20" />
              <span className="text-white/40 text-sm">or</span>
              <div className="flex-1 h-px bg-white/20" />
            </div>

            {/* Manual Entry Option */}
            <button
              onClick={() => setView('form')}
              className="w-full py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all hover:bg-white/10"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(201, 162, 39, 0.3)',
              }}
            >
              <span className="text-white/80">Enter Scores Manually</span>
              <ArrowLeft className="w-4 h-4 text-white/60 rotate-180" />
            </button>
          </div>
        )}

        {/* Form View */}
        {view === 'form' && (
          <div className="space-y-4">
            {/* Back to Upload Button */}
            <button
              onClick={handleBackToUpload}
              className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors mb-2"
            >
              <Upload className="w-4 h-4" />
              Back to Upload
            </button>

            {/* AI Data Badge (if data was extracted) */}
            {extractedData && (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-lg w-fit"
                style={{
                  backgroundColor: 'rgba(201, 162, 39, 0.15)',
                  border: '1px solid rgba(201, 162, 39, 0.3)',
                }}
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(201, 162, 39, 0.3)' }}
                >
                  <span className="text-xs font-bold" style={{ color: '#C9A227' }}>
                    AI
                  </span>
                </div>
                <span className="text-sm" style={{ color: '#C9A227' }}>
                  Pre-filled from scorecard image
                </span>
              </div>
            )}

            {/* Round Entry Form */}
            <RoundEntryForm initialData={extractedData} onSave={handleSaveRound} />
          </div>
        )}
      </div>
    </div>
  )
}
