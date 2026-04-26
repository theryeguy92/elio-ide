'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, Loader, Wifi, WifiOff } from 'lucide-react'
import { traceApi, type RunWithSteps, type Step, type StepStatus } from '@/lib/traceApi'
import { STEP_META } from './stepMeta'
import StepInspector from './StepInspector'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Step status icon
// ---------------------------------------------------------------------------

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === 'completed')
    return <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-400" />
  if (status === 'failed')
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
  return <Loader className="h-3.5 w-3.5 shrink-0 text-blue-400 animate-spin" />
}

// ---------------------------------------------------------------------------
// Single step row
// ---------------------------------------------------------------------------

function StepRow({
  step,
  isLast,
  selected,
  onClick,
}: {
  step: Step
  isLast: boolean
  selected: boolean
  onClick: () => void
}) {
  const meta = STEP_META[step.type]
  const Icon = meta.icon

  return (
    <div className="relative pl-8">
      {/* Vertical timeline connector */}
      {!isLast && (
        <div className="absolute left-[13px] top-5 bottom-0 w-px bg-[#3c3c3c]" />
      )}

      {/* Step type icon — sits on the timeline */}
      <div className={`absolute left-1 top-1.5 p-1 rounded ${meta.color}`}>
        <Icon className="h-3 w-3" />
      </div>

      <button
        onClick={onClick}
        className={`w-full flex items-start gap-2 py-1.5 pr-2 rounded text-left transition-colors ${
          selected ? 'bg-[#2a3a4a]' : 'hover:bg-[#2a2d2e]'
        }`}
      >
        <div className="mt-0.5">
          <StepStatusIcon status={step.status} />
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-medium truncate ${
              step.status === 'running' ? 'text-white' : 'text-gray-200'
            }`}
          >
            {meta.label}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-500">{formatTs(step.timestamp)}</span>
            {step.latency_ms !== null && (
              <span className="text-[10px] text-gray-500">{step.latency_ms}ms</span>
            )}
            {step.token_count !== null && (
              <span className="text-[10px] text-gray-500">{step.token_count}t</span>
            )}
          </div>
        </div>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// StepView
// ---------------------------------------------------------------------------

export default function StepView({
  runId,
  onBack,
}: {
  runId: string
  onBack: () => void
}) {
  const [run, setRun] = useState<RunWithSteps | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStep, setSelectedStep] = useState<Step | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  const stepsEndRef = useRef<HTMLDivElement>(null)

  // Load run + initial steps
  useEffect(() => {
    setLoading(true)
    setError(null)
    traceApi
      .getRun(runId)
      .then((data) => {
        setRun(data)
        setSteps(data.steps)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [runId])

  // WebSocket — only while run is active
  useEffect(() => {
    if (!run || run.status !== 'running') return
    const unsub = traceApi.subscribe(
      runId,
      (step) => {
        setSteps((prev) => {
          // Upsert: replace if we've already seen this id (status update),
          // otherwise append.
          const idx = prev.findIndex((s) => s.id === step.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = step
            return next
          }
          return [...prev, step]
        })
      },
      setWsConnected,
    )
    return unsub
  }, [runId, run?.status])

  // Auto-scroll to newest step
  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps.length])

  // ---------------------------------------------------------------------------

  const completed = steps.filter((s) => s.status === 'completed').length
  const failed = steps.filter((s) => s.status === 'failed').length
  const running = steps.filter((s) => s.status === 'running').length

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-gray-500 text-xs">
        <Loader className="h-3.5 w-3.5 animate-spin" />
        Loading run…
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-xs text-red-400">{error ?? 'Run not found'}</p>
        <button onClick={onBack} className="text-xs text-blue-400 hover:text-blue-300">
          ← Back to runs
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Run summary bar */}
      <div className="px-3 py-2 border-b border-[#3c3c3c] shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-200 truncate pr-2">{run.name}</p>
          {run.status === 'running' ? (
            wsConnected ? (
              <Wifi className="h-3 w-3 shrink-0 text-blue-400" aria-label="Live" />
            ) : (
              <WifiOff className="h-3 w-3 shrink-0 text-gray-500" aria-label="Connecting…" />
            )
          ) : null}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] text-gray-500">{steps.length} steps</span>
          {completed > 0 && (
            <span className="text-[10px] text-green-500">{completed} ok</span>
          )}
          {running > 0 && (
            <span className="text-[10px] text-blue-400">{running} running</span>
          )}
          {failed > 0 && (
            <span className="text-[10px] text-red-400">{failed} failed</span>
          )}
          {run.total_tokens !== null && (
            <span className="text-[10px] text-gray-500">
              {run.total_tokens.toLocaleString()} tok
            </span>
          )}
        </div>
      </div>

      {/* Step list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {steps.length === 0 ? (
          <p className="text-xs text-gray-600 text-center mt-8">No steps yet.</p>
        ) : (
          steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              isLast={index === steps.length - 1}
              selected={selectedStep?.id === step.id}
              onClick={() =>
                setSelectedStep((prev) => (prev?.id === step.id ? null : step))
              }
            />
          ))
        )}
        <div ref={stepsEndRef} />
      </div>

      {/* Step inspector — shown when a step is selected */}
      {selectedStep && (
        <StepInspector
          step={selectedStep}
          onClose={() => setSelectedStep(null)}
        />
      )}
    </>
  )
}
