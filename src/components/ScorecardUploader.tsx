'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, AlertCircle, Loader2 } from 'lucide-react'
import { extractRoundFromImage, GeminiExtractedData } from '@/app/actions/gemini-upload'

// ============================================
// TYPES
// ============================================

interface ScorecardUploaderProps {
  onDataExtracted: (data: GeminiExtractedData) => void
}

// ============================================
// COMPONENT
// ============================================

export default function ScorecardUploader({ onDataExtracted }: ScorecardUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ============================================
  // FILE HANDLING
  // ============================================

  const handleFile = useCallback(async (file: File) => {
    setError(null)

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image (JPEG, PNG, or WebP)')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large. Please upload an image under 10MB.')
      return
    }

    // Start analysis
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('image', file)

      const result = await extractRoundFromImage(formData)

      if (!result.success) {
        setError(result.error)
        return
      }

      onDataExtracted(result.data)
    } catch (err) {
      console.error('Upload error:', err)
      setError('Failed to analyze scorecard. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [onDataExtracted])

  // ============================================
  // DRAG & DROP HANDLERS
  // ============================================

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0 && !isLoading) {
      handleFile(files[0])
    }
  }, [handleFile, isLoading])

  // ============================================
  // INPUT HANDLERS
  // ============================================

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  const handleClick = () => {
    if (!isLoading) {
      fileInputRef.current?.click()
    }
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="w-full">
      {/* Error Alert */}
      {error && (
        <div
          className="mb-4 p-4 rounded-lg flex items-start gap-3"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
          }}
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Area */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-12
          flex flex-col items-center justify-center
          transition-all duration-300
          ${isLoading ? 'cursor-wait' : 'cursor-pointer hover:border-[#C9A227]'}
          ${isDragging ? 'border-[#C9A227] bg-[#C9A227]/10' : 'border-[#C9A227]/60'}
        `}
        style={{
          backgroundColor: isDragging ? 'rgba(201, 162, 39, 0.1)' : 'rgba(27, 77, 62, 0.2)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={handleInputChange}
          className="hidden"
          disabled={isLoading}
        />

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center">
            <div className="relative mb-4">
              <div
                className="w-16 h-16 rounded-full animate-pulse"
                style={{
                  backgroundColor: 'rgba(201, 162, 39, 0.2)',
                  boxShadow: '0 0 40px rgba(201, 162, 39, 0.4)',
                }}
              />
              <Loader2
                className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin"
                style={{ color: '#C9A227' }}
              />
            </div>
            <p className="text-lg font-medium" style={{ color: '#C9A227' }}>
              Analyzing with Gemini AI...
            </p>
            <p className="text-sm text-white/60 mt-1">
              Extracting scores, ratings, and course data
            </p>
          </div>
        ) : (
          /* Default Upload State */
          <div className="flex flex-col items-center">
            <Upload
              className="w-12 h-12 mb-4"
              style={{ color: '#C9A227' }}
            />
            <p className="text-lg font-medium text-white mb-1">
              {isDragging ? 'Drop your scorecard here' : 'Click or Drag to Upload Scorecard'}
            </p>
            <p className="text-sm text-white/60">
              Golf Ireland App screenshot (JPEG, PNG, WebP)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
