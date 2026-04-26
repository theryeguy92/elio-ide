const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
// http → ws, https → wss
const WS_BASE = API_BASE.replace(/^http/, 'ws')

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type RunStatus = 'running' | 'completed' | 'failed'
export type StepType =
  | 'llm_call'
  | 'tool_call'
  | 'agent_handoff'
  | 'memory_read'
  | 'memory_write'
export type StepStatus = 'completed' | 'running' | 'failed'

export type Run = {
  id: string
  name: string
  status: RunStatus
  created_at: string
  total_tokens: number | null
  total_cost: number | null
}

export type Step = {
  id: string
  run_id: string
  type: StepType
  status: StepStatus
  input: unknown
  output: unknown
  latency_ms: number | null
  token_count: number | null
  timestamp: string
}

export type RunWithSteps = Run & { steps: Step[] }

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// REST endpoints
// ---------------------------------------------------------------------------

export const traceApi = {
  createRun: (name: string) =>
    apiFetch<Run>('/traces/runs', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  updateRun: (
    id: string,
    patch: { status?: RunStatus; total_tokens?: number; total_cost?: number },
  ) =>
    apiFetch<Run>(`/traces/runs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  appendStep: (
    runId: string,
    step: Pick<Step, 'type' | 'status'> &
      Partial<Pick<Step, 'input' | 'output' | 'latency_ms' | 'token_count'>>,
  ) =>
    apiFetch<Step>(`/traces/runs/${runId}/steps`, {
      method: 'POST',
      body: JSON.stringify(step),
    }),

  listRuns: () => apiFetch<Run[]>('/traces/runs'),

  getRun: (id: string) => apiFetch<RunWithSteps>(`/traces/runs/${id}`),

  deleteRun: (id: string) => apiFetch<void>(`/traces/runs/${id}`, { method: 'DELETE' }),

  // ---------------------------------------------------------------------------
  // WebSocket subscription — auto-reconnects on unexpected close.
  // Returns a cleanup function; call it to permanently close the socket.
  // ---------------------------------------------------------------------------
  subscribe(
    runId: string,
    onStep: (step: Step) => void,
    onStateChange?: (connected: boolean) => void,
  ): () => void {
    let ws: WebSocket
    let disposed = false

    const connect = () => {
      if (disposed) return
      ws = new WebSocket(`${WS_BASE}/traces/runs/${runId}/live`)
      onStateChange?.(false)

      ws.onopen = () => onStateChange?.(true)

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as Record<string, unknown>
          // Ignore keepalive pings — they have type "__ping__" and no `id` field.
          if ('id' in msg) onStep(msg as unknown as Step)
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
        onStateChange?.(false)
        if (!disposed) setTimeout(connect, 3_000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      disposed = true
      ws?.close()
    }
  },
}
