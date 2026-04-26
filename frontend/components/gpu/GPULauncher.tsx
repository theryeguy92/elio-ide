'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Cpu, Loader, Square, Zap } from 'lucide-react'
import { gpuApi, type GPUProvider, type Session } from '@/lib/api'

type UIState = 'idle' | 'launching' | 'running' | 'terminating' | 'error'

const TERMINAL_STATUSES = new Set(['exited', 'terminated', 'dead', 'failed'])
const POLL_INTERVAL_MS = 5_000
const TICK_INTERVAL_MS = 100

export default function GPULauncher() {
  // Provider list
  const [providers, setProviders] = useState<GPUProvider[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [providersError, setProvidersError] = useState<string | null>(null)

  // Selection & session
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [uiState, setUiState] = useState<UIState>('idle')
  const [session, setSession] = useState<Session | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Live cost display — interpolated between polls
  const [displayCost, setDisplayCost] = useState(0)
  const accrueBaseRef = useRef(0)   // accrued cost at last poll
  const accrueTimeRef = useRef(0)   // Date.now() at last poll
  const costRateRef = useRef(0)     // cost_per_hr from last poll

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ------------------------------------------------------------------
  // Providers
  // ------------------------------------------------------------------

  useEffect(() => {
    gpuApi
      .providers()
      .then((data) => {
        const available = data.filter((p) => p.available)
        setProviders(available)
        if (available.length > 0) setSelectedId(available[0].id)
      })
      .catch((err: Error) => setProvidersError(err.message))
      .finally(() => setLoadingProviders(false))
  }, [])

  // ------------------------------------------------------------------
  // Interval helpers
  // ------------------------------------------------------------------

  const stopAll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
  }, [])

  useEffect(() => () => stopAll(), [stopAll])

  const startCostTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = setInterval(() => {
      const elapsedHrs = (Date.now() - accrueTimeRef.current) / 3_600_000
      setDisplayCost(accrueBaseRef.current + elapsedHrs * costRateRef.current)
    }, TICK_INTERVAL_MS)
  }, [])

  const syncCostRefs = useCallback((s: Session) => {
    accrueBaseRef.current = s.accrued_cost ?? 0
    accrueTimeRef.current = Date.now()
    costRateRef.current = s.cost_per_hr
  }, [])

  const startPolling = useCallback(
    (sessionId: string) => {
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          const updated = await gpuApi.status(sessionId)
          setSession(updated)
          syncCostRefs(updated)

          if (TERMINAL_STATUSES.has(updated.status)) {
            stopAll()
            setSession(null)
            setDisplayCost(0)
            setUiState('idle')
          }
        } catch {
          // non-fatal — keep trying next tick
        }
      }, POLL_INTERVAL_MS)
    },
    [stopAll, syncCostRefs],
  )

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const handleLaunch = async () => {
    if (!selectedId) return
    setUiState('launching')
    setErrorMsg(null)
    try {
      const s = await gpuApi.launch({ gpu_type_id: selectedId })
      setSession(s)
      syncCostRefs(s)
      setDisplayCost(0)
      setUiState('running')
      startCostTick()
      startPolling(s.id)
    } catch (err) {
      setErrorMsg((err as Error).message)
      setUiState('error')
    }
  }

  const handleTerminate = async () => {
    if (!session) return
    setUiState('terminating')
    try {
      await gpuApi.terminate(session.id)
      stopAll()
      setSession(null)
      setDisplayCost(0)
      setUiState('idle')
    } catch (err) {
      setErrorMsg((err as Error).message)
      setUiState('error')
    }
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const selected = providers.find((p) => p.id === selectedId)

  if (loadingProviders) {
    return (
      <div className="p-3 flex items-center gap-2 text-gray-400 text-sm">
        <Loader className="h-4 w-4 animate-spin" />
        Loading GPU options…
      </div>
    )
  }

  if (providersError) {
    return (
      <div className="p-3 flex items-center gap-2 text-red-400 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="text-xs">{providersError}</span>
      </div>
    )
  }

  const isActive = session !== null && uiState !== 'idle'

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-purple-400" />
        <span className="text-sm font-medium text-gray-200">GPU Launcher</span>
      </div>

      {isActive ? (
        <ActiveSession
          session={session!}
          displayCost={displayCost}
          terminating={uiState === 'terminating'}
          onTerminate={handleTerminate}
        />
      ) : (
        <ProviderSelector
          providers={providers}
          selectedId={selectedId}
          selected={selected ?? null}
          launching={uiState === 'launching'}
          errorMsg={errorMsg}
          onSelect={setSelectedId}
          onLaunch={handleLaunch}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActiveSession({
  session,
  displayCost,
  terminating,
  onTerminate,
}: {
  session: Session
  displayCost: number
  terminating: boolean
  onTerminate: () => void
}) {
  return (
    <div className="space-y-2">
      <div className="px-3 py-2.5 rounded bg-[#2a2d2e] border border-[#3c3c3c] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-200 truncate pr-2">
            {session.gpu_type}
          </span>
          <StatusBadge status={session.status} />
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-gray-500">${session.cost_per_hr.toFixed(2)}/hr</span>
          <span className="font-mono tabular-nums text-green-400">
            ${displayCost.toFixed(4)} accrued
          </span>
        </div>

        {session.uptime_seconds !== null && (
          <div className="text-[10px] text-gray-500">
            Uptime: {formatUptime(session.uptime_seconds)}
          </div>
        )}
      </div>

      <button
        onClick={onTerminate}
        disabled={terminating}
        className="flex items-center gap-2 px-4 py-1.5 rounded bg-red-700 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {terminating ? (
          <Loader className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Square className="h-3.5 w-3.5 fill-white" />
        )}
        {terminating ? 'Terminating…' : 'Terminate Session'}
      </button>
    </div>
  )
}

function ProviderSelector({
  providers,
  selectedId,
  selected,
  launching,
  errorMsg,
  onSelect,
  onLaunch,
}: {
  providers: GPUProvider[]
  selectedId: string | null
  selected: GPUProvider | null
  launching: boolean
  errorMsg: string | null
  onSelect: (id: string) => void
  onLaunch: () => void
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {providers.map((gpu) => (
          <button
            key={gpu.id}
            onClick={() => onSelect(gpu.id)}
            className={`p-2 rounded border text-left transition-colors ${
              selectedId === gpu.id
                ? 'border-blue-500 bg-blue-500/10 text-white'
                : 'border-[#3c3c3c] text-gray-400 hover:border-gray-500 hover:text-gray-200'
            }`}
          >
            <p className="text-xs font-medium truncate">{gpu.name}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              ${gpu.price_per_hr.toFixed(2)}/hr
            </p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="px-3 py-2 rounded bg-[#2a2d2e] border border-[#3c3c3c]">
          <p className="text-xs text-gray-300">{selected.memory_gb} GB VRAM</p>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-start gap-2 px-3 py-2 rounded bg-red-900/20 border border-red-700/40">
          <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-red-300 break-all">{errorMsg}</p>
        </div>
      )}

      <button
        onClick={onLaunch}
        disabled={!selectedId || launching}
        className="flex items-center gap-2 px-4 py-1.5 rounded bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {launching ? (
          <Loader className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="h-3.5 w-3.5" />
        )}
        {launching ? 'Launching…' : 'Launch Instance'}
      </button>
    </>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    running: 'bg-green-400/15 text-green-400 border-green-500/30',
    pending: 'bg-yellow-400/15 text-yellow-400 border-yellow-500/30',
    exited: 'bg-red-400/15 text-red-400 border-red-500/30',
    terminated: 'bg-red-400/15 text-red-400 border-red-500/30',
  }
  const cls = variants[status] ?? 'bg-gray-400/15 text-gray-400 border-gray-500/30'
  return (
    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${cls}`}>
      {status}
    </span>
  )
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
