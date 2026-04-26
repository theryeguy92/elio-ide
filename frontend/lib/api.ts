const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GPUProvider = {
  id: string
  name: string
  memory_gb: number
  price_per_hr: number
  available: boolean
}

export type Session = {
  id: string
  /** RunPod desiredStatus lowercased: "running" | "pending" | "exited" | "terminated" */
  status: string
  gpu_type: string
  cost_per_hr: number
  uptime_seconds: number | null
  accrued_cost: number | null
}

export type LaunchRequest = {
  gpu_type_id: string
  image?: string
  disk_gb?: number
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
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// GPU endpoints
// ---------------------------------------------------------------------------

export const gpuApi = {
  providers: () =>
    apiFetch<GPUProvider[]>('/gpu/providers'),

  launch: (body: LaunchRequest) =>
    apiFetch<Session>('/gpu/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  status: (id: string) =>
    apiFetch<Session>(`/gpu/sessions/${id}`),

  terminate: (id: string) =>
    apiFetch<void>(`/gpu/sessions/${id}`, { method: 'DELETE' }),
}
