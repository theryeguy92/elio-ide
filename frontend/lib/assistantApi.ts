import { apiFetch } from '@/lib/apiFetch'

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ProposedFile = {
  path: string
  content: string
}

export type ChatResponse = {
  reply: string
  files: ProposedFile[]
}

export type AssistantMode = 'vault-setup' | 'readme'

export type AssistantConfig = {
  provider: string
  model: string
  base_url: string
}

export const assistantApi = {
  config: () => apiFetch<AssistantConfig>('/assistant/config'),

  chat: async (
    mode: AssistantMode,
    message: string,
    history: ChatMessage[],
  ): Promise<ChatResponse> => {
    return apiFetch<ChatResponse>('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ mode, message, history }),
    })
  },
}
