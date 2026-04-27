'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, Loader, Wifi, WifiOff } from 'lucide-react'
import { traceApi, type RunWithSteps, type Step, type StepStatus } from '@/lib/traceApi'
import { useCodeJump } from '@/context/CodeJumpContext'
import { STEP_META } from './stepMeta'
import StepInspector from './StepInspector'

function formatTs(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') return <CheckCircle className="h-3 w-3 shrink-0 text-elio-success" />
  if (status === 'failed')    return <XCircle    className="h-3 w-3 shrink-0 text-elio-error" />
  return <Loader className="h-3 w-3 shrink-0 text-elio-primary animate-spin" />
}

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
  const { jumpToLine } = useCodeJump()
  const isRunning = step.status === 'running'

  const sourceLabel =
    step.source_file && step.source_line != null
      ? `${step.source_file.split('/').pop()}:${step.source_line}`
      : null

  const handleSourceClick = (e: React.MouseEvent) => {
    if (!step.source_file || step.source_line == null) return
    e.stopPropagation()
    jumpToLine(step.source_file, step.source_line)
  }

  return (
    <div
      className={`relative transition-colors duration-150 ${
        selected
          ? 'bg-elio-surface-3 border-l-2 border-elio-primary'
          : isRunning
            ? 'border-l-2 border-elio-primary/50'
            : 'border-l-2 border-transparent'
      }`}
    >
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-[19px] top-6 bottom-0 w-px bg-elio-border" />
      )}

      {/* Step type icon on timeline */}
      <div className={`absolute left-2.5 top-2 p-1 rounded ${meta.color}`}>
        <Icon className="h-2.5 w-2.5" />
      </div>

      <button
        onClick={onClick}
        className="w-full flex items-start gap-2 py-2 pr-2 pl-8 text-left hover:bg-elio-surface-2 transition-colors duration-150"
      >
        <div className="mt-0.5 shrink-0">
          <StepStatusIcon status={step.status} />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-medium truncate ${
            isRunning ? 'text-elio-text' : 'text-elio-text-muted'
          }`}>
            {meta.label}
            {isRunning && (
              <span className="ml-1.5 relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-elio-primary opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-elio-primary" />
              </span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-elio-text-dim font-mono">{formatTs(step.timestamp)}</span>
            {step.latency_ms !== null && (
              <span className="text-[10px] text-elio-text-dim">{step.latency_ms}ms</span>
            )}
            {step.token_count !== null && (
              <span className="text-[10px] text-elio-text-dim">{step.token_count}t</span>
            )}
            {sourceLabel && (
              <button
                onClick={handleSourceClick}
                className="text-[10px] font-mono px-1 py-0.5 rounded bg-elio-surface-3 text-elio-primary hover:bg-elio-primary/10 transition-colors duration-150"
                title={`Jump to ${step.source_file}:${step.source_line}`}
              >
                {sourceLabel}
              </button>
            )}
          </div>
        </div>
      </button>
    </div>
  )
}

export default function StepView({ runId, onBack }: { runId: string; onBack: () => void }) {
  const [run, setRun] = useState<RunWithSteps | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStep, setSelectedStep] = useState<Step | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  const stepsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    traceApi
      .getRun(runId)
      .then((data) => { setRun(data); setSteps(data.steps) })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [runId])

  useEffect(() => {
    if (!run || run.status !== 'running') return
    return traceApi.subscribe(
      runId,
      (step) => {
        setSteps((prev) => {
          const idx = prev.findIndex((s) => s.id === step.id)
          if (idx >= 0) { const next = [...prev]; next[idx] = step; return next }
          return [...prev, step]
        })
      },
      setWsConnected,
    )
  }, [runId, run?.status])

  useEffect(() => {
    stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps.length])

  const completed = steps.filter((s) => s.status === 'completed').length
  const failed    = steps.filter((s) => s.status === 'failed').length
  const running   = steps.filter((s) => s.status === 'running').length

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-elio-text-dim text-[11px]">
        <Loader className="h-3.5 w-3.5 animate-spin" />
        Loading run…
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-[11px] text-elio-error">{error ?? 'Run not found'}</p>
        <button onClick={onBack} className="text-[11px] text-elio-primary hover:opacity-80">
          ← Back to runs
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Run summary bar */}
      <div className="px-3 py-2 border-b border-elio-border shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-elio-text truncate pr-2">{run.name}</p>
          {run.status === 'running' ? (
            wsConnected
              ? <Wifi    className="h-3 w-3 shrink-0 text-elio-primary" aria-label="Live" />
              : <WifiOff className="h-3 w-3 shrink-0 text-elio-text-dim" aria-label="Connecting…" />
          ) : null}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-elio-text-dim">{steps.length} steps</span>
          {completed > 0 && <span className="text-[10px] text-elio-success">{completed} ok</span>}
          {running > 0   && <span className="text-[10px] text-elio-primary">{running} running</span>}
          {failed > 0    && <span className="text-[10px] text-elio-error">{failed} failed</span>}
          {run.total_tokens !== null && (
            <span className="text-[10px] text-elio-text-dim font-mono">
              {run.total_tokens.toLocaleString()}t
            </span>
          )}
        </div>
      </div>

      {/* Step list */}
      <div className="flex-1 overflow-y-auto py-1">
        {steps.length === 0 ? (
          <p className="text-[10px] text-elio-text-dim text-center mt-8">No steps yet.</p>
        ) : (
          steps.map((step, index) => (
            <StepRow
              key={step.id}
              step={step}
              isLast={index === steps.length - 1}
              selected={selectedStep?.id === step.id}
              onClick={() => setSelectedStep((prev) => (prev?.id === step.id ? null : step))}
            />
          ))
        )}
        <div ref={stepsEndRef} />
      </div>

      {selectedStep && (
        <StepInspector step={selectedStep} onClose={() => setSelectedStep(null)} />
      )}
    </>
  )
}
