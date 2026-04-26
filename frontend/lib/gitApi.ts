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

export interface FileStatus {
  path: string
  status: string
  staged: boolean
  unstaged: boolean
}

export interface GitStatusResponse {
  branch: string
  ahead: number
  behind: number
  files: FileStatus[]
}

export interface CommitEntry {
  hash: string
  short_hash: string
  message: string
  author: string
  date: string
}

export interface BranchEntry {
  name: string
  current: boolean
  remote: boolean
}

export const gitApi = {
  status: () => apiFetch<GitStatusResponse>('/git/status'),

  log: (limit = 20) => apiFetch<CommitEntry[]>(`/git/log?limit=${limit}`),

  stage: (paths: string[]) =>
    apiFetch<{ staged: string[] }>('/git/stage', {
      method: 'POST',
      body: JSON.stringify({ paths }),
    }),

  unstage: (paths: string[]) =>
    apiFetch<{ unstaged: string[] }>('/git/unstage', {
      method: 'POST',
      body: JSON.stringify({ paths }),
    }),

  commit: (message: string) =>
    apiFetch<CommitEntry>('/git/commit', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),

  push: () => apiFetch<{ pushed: boolean; output: string }>('/git/push', { method: 'POST' }),

  branches: () => apiFetch<BranchEntry[]>('/git/branches'),

  createBranch: (name: string, checkout = true) =>
    apiFetch<BranchEntry>('/git/branches', {
      method: 'POST',
      body: JSON.stringify({ name, checkout }),
    }),

  checkout: (branch: string) =>
    apiFetch<BranchEntry>('/git/checkout', {
      method: 'POST',
      body: JSON.stringify({ branch }),
    }),

  suggestMessage: () =>
    apiFetch<{ message: string }>('/git/suggest-message', { method: 'POST' }),
}
