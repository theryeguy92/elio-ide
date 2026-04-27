import { X, CheckCircle, XCircle, Loader, Timer, Hash } from 'lucide-react'
import type { Step, StepStatus } from '@/lib/traceApi'
import { STEP_META } from './stepMeta'

function formatTs(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function JsonView({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-elio-text-dim font-mono text-[11px]">null</span>
  }
  if (typeof value === 'string') {
    return (
      <pre className="font-mono text-[11px] text-elio-text-muted whitespace-pre-wrap break-all leading-relaxed">
        {value}
      </pre>
    )
  }
  return (
    <pre className="font-mono text-[11px] text-blue-300 whitespace-pre-wrap break-all leading-relaxed overflow-x-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') return <CheckCircle className="h-3.5 w-3.5 text-elio-success" />
  if (status === 'failed')    return <XCircle    className="h-3.5 w-3.5 text-elio-error" />
  return <Loader className="h-3.5 w-3.5 text-elio-primary animate-spin" />
}

export default function StepInspector({ step, onClose }: { step: Step; onClose: () => void }) {
  const meta = STEP_META[step.type]
  const Icon = meta.icon

  return (
    <div className="border-t border-elio-border flex flex-col bg-elio-bg h-56 shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-elio-border shrink-0">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
        <span className="text-[11px] font-medium text-elio-text flex-1 truncate">{meta.label}</span>
        <StatusIcon status={step.status} />
        <button
          onClick={onClose}
          className="ml-1 p-0.5 rounded hover:bg-elio-surface-2 transition-colors duration-150"
        >
          <X className="h-3.5 w-3.5 text-elio-text-dim" />
        </button>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-elio-border shrink-0">
        <span className="text-[10px] text-elio-text-dim font-mono">{formatTs(step.timestamp)}</span>
        {step.latency_ms !== null && (
          <span className="flex items-center gap-1 text-[10px] text-elio-text-dim">
            <Timer className="h-3 w-3" />
            {step.latency_ms}ms
          </span>
        )}
        {step.token_count !== null && (
          <span className="flex items-center gap-1 text-[10px] text-elio-text-dim">
            <Hash className="h-3 w-3" />
            {step.token_count}t
          </span>
        )}
      </div>

      {/* Input / Output */}
      <div className="flex-1 overflow-y-auto">
        {step.input !== null && step.input !== undefined && (
          <Section label="Input"><JsonView value={step.input} /></Section>
        )}
        {step.output !== null && step.output !== undefined && (
          <Section label="Output"><JsonView value={step.output} /></Section>
        )}
        {step.input === null && step.output === null && (
          <div className="p-3">
            <p className="text-[10px] text-elio-text-dim">No input / output recorded.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 pt-2 pb-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-elio-text-dim mb-1.5">
        {label}
      </p>
      <div className="rounded bg-elio-surface border border-elio-border p-2 overflow-x-auto">
        {children}
      </div>
    </div>
  )
}
