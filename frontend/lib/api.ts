import { API_BASE, apiFetch } from '@/lib/apiFetch'

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
