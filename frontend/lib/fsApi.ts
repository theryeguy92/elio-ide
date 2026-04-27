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

export type FileNode = {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: FileNode[]
}

export type FileContent = {
  path: string
  content: string
}

export const fsApi = {
  tree: (path = '') =>
    apiFetch<FileNode[]>(`/fs/tree${path ? `?path=${encodeURIComponent(path)}` : ''}`),

  readFile: (path: string) =>
    apiFetch<FileContent>(`/fs/file?path=${encodeURIComponent(path)}`),

  writeFile: (path: string, content: string) =>
    apiFetch<FileContent>('/fs/file', {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    }),
}
