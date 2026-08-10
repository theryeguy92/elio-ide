'use client'

import { useEffect, useRef, useState } from 'react'
import { BookOpen, FileText, Loader, Send, Sparkles } from 'lucide-react'
import {
  assistantApi,
  type AssistantConfig,
  type AssistantMode,
  type ChatMessage,
  type ProposedFile,
} from '@/lib/assistantApi'
import { fsApi } from '@/lib/fsApi'
import { vaultApi } from '@/lib/vaultApi'

type Message = ChatMessage & { files?: ProposedFile[] }

const MODES: { id: AssistantMode; label: string; icon: typeof BookOpen; hint: string }[] = [
  {
    id: 'vault-setup',
    label: 'Vault Setup',
    icon: BookOpen,
    hint: 'Set up your Obsidian vault from your project README',
  },
  {
    id: 'readme',
    label: 'README',
    icon: FileText,
    hint: 'Draft a professional README for this project',
  },
]

export default function AssistantPanel() {
  const [mode, setMode] = useState<AssistantMode>('vault-setup')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [applied, setApplied] = useState<Set<string>>(new Set())
  const [config, setConfig] = useState<AssistantConfig | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    assistantApi.config().then(setConfig).catch(() => setConfig(null))
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, busy])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)

    const history: ChatMessage[] = messages.map(({ role, content }) => ({ role, content }))
    setMessages((prev) => [...prev, { role: 'user', content: text }])

    try {
      const resp = await assistantApi.chat(mode, text, history)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: resp.reply, files: resp.files.length ? resp.files : undefined },
      ])
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠ ${(e as Error).message}` },
      ])
    } finally {
      setBusy(false)
    }
  }

  const applyFiles = async (files: ProposedFile[]) => {
    for (const f of files) {
      if (mode === 'vault-setup') {
        await vaultApi.writeNote(f.path, f.content)
      } else {
        await fsApi.writeFile(f.path, f.content)
      }
      setApplied((prev) => new Set(prev).add(f.path))
    }
  }

  return (
    <div className="h-full bg-elio-bg flex flex-col">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-elio-border shrink-0">
        <Sparkles className="h-3 w-3 text-elio-primary mr-1" />
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setMode(id); setMessages([]); setApplied(new Set()) }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-colors duration-150 ${
              mode === id
                ? 'bg-elio-surface-2 text-elio-text'
                : 'text-elio-text-dim hover:text-elio-text-muted'
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
        <span className="ml-2 text-[10px] text-elio-text-dim truncate">
          {MODES.find((m) => m.id === mode)?.hint}
        </span>
        {config && (
          <span
            className="ml-auto pl-2 text-[10px] text-elio-text-dim shrink-0"
            title={config.base_url || undefined}
          >
            {config.provider} · {config.model}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-[11px] text-elio-text-dim">
            Ask me to {mode === 'vault-setup'
              ? 'design a zettelkasten vault structure for this project'
              : 'write a README for this project'}.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded px-3 py-2 text-[11px] whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-elio-primary/20 text-elio-text'
                  : 'bg-elio-surface-2 text-elio-text-muted'
              }`}
            >
              {m.content}
              {m.files && (
                <div className="mt-2 pt-2 border-t border-elio-border">
                  <div className="text-[10px] text-elio-text-dim mb-1">
                    Proposed {m.files.length} file{m.files.length === 1 ? '' : 's'}:
                  </div>
                  {m.files.map((f) => (
                    <div key={f.path} className="font-mono text-[10px] text-elio-text truncate">
                      {applied.has(f.path) ? '✓ ' : ''}{f.path}
                    </div>
                  ))}
                  <button
                    onClick={() => applyFiles(m.files!)}
                    disabled={m.files.every((f) => applied.has(f.path))}
                    className="mt-1.5 px-2 py-0.5 rounded bg-elio-primary/80 hover:bg-elio-primary text-white text-[10px] font-medium disabled:opacity-40 transition-colors duration-150"
                  >
                    {m.files.every((f) => applied.has(f.path)) ? 'Applied' : 'Apply all'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-[11px] text-elio-text-dim">
            <Loader className="h-3 w-3 animate-spin" />
            Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-elio-border shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask the assistant…"
          className="flex-1 bg-elio-surface-2 rounded px-2 py-1.5 text-[11px] text-elio-text placeholder:text-elio-text-dim outline-none"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="p-1.5 rounded bg-elio-primary/80 hover:bg-elio-primary text-white disabled:opacity-40 transition-colors duration-150"
          aria-label="Send"
        >
          <Send className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
