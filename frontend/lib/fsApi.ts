import { API_BASE, apiFetch } from '@/lib/apiFetch'

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
