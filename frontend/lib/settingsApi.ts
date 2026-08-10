import { apiFetch } from '@/lib/apiFetch'

export type Settings = {
  project_path: string
  vault_path: string
  llm_provider: string
  llm_base_url: string
  llm_api_key: string
  llm_model: string
  anthropic_api_key: string
  runpod_api_key: string
  needs_setup: boolean
}

export type SettingsUpdate = Partial<Omit<Settings, 'needs_setup'>>

export type LlmTestResult = {
  ok: boolean
  detail: string
}

export type BrowseResult = {
  path: string
  parent: string | null
  dirs: string[]
}

export const settingsApi = {
  get: () => apiFetch<Settings>('/settings'),

  update: (data: SettingsUpdate) =>
    apiFetch<Settings>('/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  testLlm: () =>
    apiFetch<LlmTestResult>('/settings/test-llm', { method: 'POST' }),

  browse: (path = '~') =>
    apiFetch<BrowseResult>(`/settings/browse?path=${encodeURIComponent(path)}`),
}
