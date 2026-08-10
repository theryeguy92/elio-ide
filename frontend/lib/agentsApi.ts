import { apiFetch } from '@/lib/apiFetch'

export type AgentCli = {
  id: string
  name: string
  available: boolean
  path: string
}

export const agentsApi = {
  list: () => apiFetch<AgentCli[]>('/agents'),
}
