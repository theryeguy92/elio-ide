const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

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

export type OllamaStatus = { running: boolean; base_url: string }
export type GpuInfo = {
  name: string
  memory_total_mb: number
  memory_used_mb: number
  utilization_pct: number | null
}
export type ComputeStatus = { ollama: OllamaStatus; gpus: GpuInfo[] }

export type ModelEntry = {
  id: string
  name: string
  provider: string
  size_gb: number | null
}
export type ComputeModels = { models: ModelEntry[]; active_model: string | null }

export type SettingsMeta = {
  RUNPOD_API_KEY: boolean
  LAMBDA_LABS_API_KEY: boolean
  ANTHROPIC_API_KEY: boolean
  OPENAI_API_KEY: boolean
  ACTIVE_MODEL: string | null
}

export type SettingsPayload = {
  RUNPOD_API_KEY?: string
  LAMBDA_LABS_API_KEY?: string
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  ACTIVE_MODEL?: string
}

export const computeApi = {
  status: () => apiFetch<ComputeStatus>('/compute/status'),
  models: () => apiFetch<ComputeModels>('/compute/models'),
  getSettings: () => apiFetch<SettingsMeta>('/compute/settings'),
  saveSettings: (body: SettingsPayload) =>
    apiFetch<SettingsMeta>('/compute/settings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}
