import { API_BASE, apiFetch } from '@/lib/apiFetch'

export type VaultNode = {
  name: string
  path: string
  type: 'file' | 'dir'
  children?: VaultNode[]
}

export type NoteContent = {
  path: string
  content: string
}

export type SearchHit = {
  path: string
  snippet: string
}

export const vaultApi = {
  tree: () => apiFetch<VaultNode[]>('/vault/tree'),

  readNote: (path: string) =>
    apiFetch<NoteContent>(`/vault/note?path=${encodeURIComponent(path)}`),

  writeNote: (path: string, content: string) =>
    apiFetch<NoteContent>('/vault/note', {
      method: 'POST',
      body: JSON.stringify({ path, content }),
    }),

  resolve: (name: string) =>
    apiFetch<NoteContent>(`/vault/resolve?name=${encodeURIComponent(name)}`),

  search: (q: string) =>
    apiFetch<SearchHit[]>(`/vault/search?q=${encodeURIComponent(q)}`),
}
