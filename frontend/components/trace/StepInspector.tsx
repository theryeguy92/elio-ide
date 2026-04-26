import { X, CheckCircle, XCircle, Loader, Timer, Hash } from 'lucide-react'
import type { Step, StepType, StepStatus } from '@/lib/traceApi'
import { STEP_META } from './stepMeta'

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
// JSON / value renderer
// ---------------------------------------------------------------------------

function JsonView({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-500 font-mono text-xs">null</span>
  }
  if (typeof value === 'string') {
    return (
      <pre className="font-mono text-xs text-gray-200 whitespace-pre-wrap break-all leading-relaxed">
        {value}
      </pre>
    )
  }
  return (
    <pre className="font-mono text-xs text-blue-200 whitespace-pre-wrap break-all leading-relaxed overflow-x-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

// ---------------------------------------------------------------------------
// Status icon
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') return <CheckCircle className="h-3.5 w-3.5 text-green-400" />
  if (status === 'failed') return <XCircle className="h-3.5 w-3.5 text-red-400" />
  return <Loader className="h-3.5 w-3.5 text-blue-400 animate-spin" />
}

// ---------------------------------------------------------------------------
// StepInspector
// ---------------------------------------------------------------------------

export default function StepInspector({
  step,
  onClose,
}: {
  step: Step
  onClose: () => void
}) {
  const meta = STEP_META[step.type]
  const Icon = meta.icon

  return (
    <div className="border-t border-[#3c3c3c] flex flex-col bg-[#1e1e1e] h-56 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3c3c3c] shrink-0">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
        <span className="text-xs font-medium text-gray-200 flex-1 truncate">{meta.label}</span>
        <StatusIcon status={step.status} />
        <button
          onClick={onClose}
          className="ml-1 p-0.5 rounded hover:bg-[#3c3c3c] transition-colors"
          aria-label="Close inspector"
        >
          <X className="h-3.5 w-3.5 text-gray-500" />
        </button>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[#2a2d2e] shrink-0">
        <span className="text-[10px] text-gray-500">{formatTs(step.timestamp)}</span>
        {step.latency_ms !== null && (
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <Timer className="h-3 w-3" />
            {step.latency_ms}ms
          </span>
        )}
        {step.token_count !== null && (
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <Hash className="h-3 w-3" />
            {step.token_count} tok
          </span>
        )}
      </div>

      {/* Input / Output */}
      <div className="flex-1 overflow-y-auto">
        {step.input !== null && step.input !== undefined && (
          <Section label="Input">
            <JsonView value={step.input} />
          </Section>
        )}
        {step.output !== null && step.output !== undefined && (
          <Section label="Output">
            <JsonView value={step.output} />
          </Section>
        )}
        {step.input === null && step.output === null && (
          <div className="p-3">
            <p className="text-[10px] text-gray-600">No input / output recorded.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 pt-2 pb-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
        {label}
      </p>
      <div className="rounded bg-[#252526] border border-[#3c3c3c] p-2 overflow-x-auto">
        {children}
      </div>
    </div>
  )
}
