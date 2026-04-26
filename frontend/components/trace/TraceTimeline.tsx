'use client'

import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, Clock, RefreshCw } from 'lucide-react'
import { traceApi, type Run } from '@/lib/traceApi'
import RunList from './RunList'
import StepView from './StepView'

export default function TraceTimeline() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadRuns = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const data = await traceApi.listRuns()
      setRuns(data)
    } catch {
      // silently fail — empty state is shown
    } finally {
      setLoading(false)
      if (showSpinner) setRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  // Poll every 10 s when no run is selected (run list stays fresh)
  useEffect(() => {
    if (selectedRunId) return
    const id = setInterval(() => loadRuns(), 10_000)
    return () => clearInterval(id)
  }, [selectedRunId, loadRuns])

  const handleBack = useCallback(() => {
    setSelectedRunId(null)
    // Refresh list when returning so completed runs show updated status
    loadRuns()
  }, [loadRuns])

  return (
    <aside className="w-80 bg-[#252526] border-l border-[#3c3c3c] flex flex-col shrink-0 overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3c3c3c] shrink-0 min-h-[38px]">
        {selectedRunId ? (
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
            aria-label="Back to run list"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Runs
          </button>
        ) : (
          <>
            <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex-1">
              Trace Timeline
            </span>
            <button
              onClick={() => loadRuns(true)}
              disabled={refreshing}
              className="p-1 rounded hover:bg-[#3c3c3c] transition-colors disabled:opacity-50"
              aria-label="Refresh runs"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-gray-500 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Content                                                             */}
      {/* ------------------------------------------------------------------ */}
      {selectedRunId ? (
        <StepView runId={selectedRunId} onBack={handleBack} />
      ) : (
        <RunList runs={runs} loading={loading} onSelect={setSelectedRunId} />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Footer — only visible on run list                                   */}
      {/* ------------------------------------------------------------------ */}
      {!selectedRunId && (
        <div className="border-t border-[#3c3c3c] px-3 py-2 shrink-0">
          <p className="text-[10px] text-gray-600">
            {runs.length} run{runs.length !== 1 ? 's' : ''} · auto-refresh every 10s
          </p>
        </div>
      )}
    </aside>
  )
}
