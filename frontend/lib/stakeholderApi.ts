const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ---------------------------------------------------------------------------
// Shared types — mirror the backend Pydantic models
// ---------------------------------------------------------------------------

export type NodeType = 'agent' | 'tool' | 'memory'
export type HealthStatus = 'green' | 'yellow' | 'red'

export type StakeholderNode = {
  id: string
  type: NodeType
  label: string
  call_count: number
  health: HealthStatus
  metadata: {
    success_rate: number
    error_count: number
    read_count: number
    write_count: number
  }
}

export type StakeholderEdge = {
  id: string
  source: string
  target: string
  label: string
  count: number
}

export type StakeholderGraph = {
  nodes: StakeholderNode[]
  edges: StakeholderEdge[]
  last_updated: string
}

export type RecentStep = {
  type: string
  status: string
  latency_ms: number | null
  timestamp: string
  input_summary: string
  output_summary: string
}

export type NodeDescription = {
  node_id: string
  label: string
  node_type: string
  description: string
  recent_steps: RecentStep[]
}

export type NodeHealth = {
  status: HealthStatus
  success_rate: number
  total_calls: number
  error_count: number
}

export type HealthReport = {
  nodes: Record<string, NodeHealth>
  last_updated: string
}

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
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Stakeholder endpoints
// ---------------------------------------------------------------------------

export const stakeholderApi = {
  graph: () => apiFetch<StakeholderGraph>('/stakeholder/graph'),

  describe: (nodeId: string) =>
    apiFetch<NodeDescription>('/stakeholder/describe', {
      method: 'POST',
      body: JSON.stringify({ node_id: nodeId }),
    }),

  health: () => apiFetch<HealthReport>('/stakeholder/health'),
}
