'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, FolderOpen, Loader, X, XCircle } from 'lucide-react'
import { settingsApi, type Settings } from '@/lib/settingsApi'
import { useEditor } from '@/context/EditorContext'
import FolderPicker from '@/components/settings/FolderPicker'

const PRESETS = [
  { label: 'Kimi K3', provider: 'openai', llm_base_url: 'https://api.moonshot.ai/v1', llm_model: 'kimi-k3' },
  { label: 'ZAI GLM', provider: 'openai', llm_base_url: 'https://api.z.ai/api/paas/v4', llm_model: 'glm-5' },
  { label: 'Ollama (local)', provider: 'openai', llm_base_url: 'http://localhost:11434/v1', llm_model: 'qwen2.5-coder' },
  { label: 'Anthropic', provider: 'anthropic', llm_base_url: '', llm_model: '' },
] as const

const inputCls =
  'w-full bg-elio-surface-2 border border-elio-border rounded px-2 py-1.5 text-[11px] text-elio-text placeholder:text-elio-text-dim outline-none focus:border-elio-primary transition-colors duration-150'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-widest text-elio-text-dim mb-1">
        {label}
      </span>
      {children}
    </label>
  )
}

export default function SettingsModal() {
  const { settingsOpen, setSettingsOpen } = useEditor()
  const [form, setForm] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [picking, setPicking] = useState<'project_path' | 'vault_path' | null>(null)

  useEffect(() => {
    if (!settingsOpen) return
    setError(null)
    setTestResult(null)
    settingsApi.get().then(setForm).catch((e: Error) => setError(e.message))
  }, [settingsOpen])

  if (!settingsOpen) return null

  const set = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f))

  const save = async () => {
    if (!form) return
    setSaving(true)
    setError(null)
    try {
      const { needs_setup: _, ...payload } = form
      await settingsApi.update(payload)
      // Settings re-root the project/vault — cleanest refresh is a reload
      window.location.reload()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // Save first so the test hits the just-entered config
      const { needs_setup: _, ...payload } = form!
      await settingsApi.update(payload)
      setTestResult(await settingsApi.testLlm())
    } catch (e) {
      setTestResult({ ok: false, detail: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[420px] max-h-[85vh] overflow-y-auto rounded-lg border border-elio-border bg-elio-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-elio-border">
          <span className="text-xs font-semibold text-elio-text">
            {form?.needs_setup ? 'Welcome — set up Elio IDE' : 'Settings'}
          </span>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1 rounded hover:bg-elio-surface-2 transition-colors duration-150"
            aria-label="Close settings"
          >
            <X className="h-3.5 w-3.5 text-elio-text-muted" />
          </button>
        </div>

        {!form ? (
          <div className="p-4 flex items-center gap-2 text-[11px] text-elio-text-dim">
            <Loader className="h-3 w-3 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Paths */}
            <div className="space-y-2.5">
              <Field label="Project directory">
                <div className="flex items-center gap-1.5">
                  <input
                    value={form.project_path}
                    onChange={set('project_path')}
                    placeholder="/path/to/your/project"
                    className={`${inputCls} font-mono`}
                  />
                  <button
                    onClick={() => setPicking('project_path')}
                    className="p-1.5 rounded bg-elio-surface-2 border border-elio-border hover:border-elio-border-bright text-elio-text-muted hover:text-elio-text shrink-0 transition-colors duration-150"
                    aria-label="Browse for project directory"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Field>
              <Field label="Obsidian vault">
                <div className="flex items-center gap-1.5">
                  <input
                    value={form.vault_path}
                    onChange={set('vault_path')}
                    placeholder="/path/to/your/vault"
                    className={`${inputCls} font-mono`}
                  />
                  <button
                    onClick={() => setPicking('vault_path')}
                    className="p-1.5 rounded bg-elio-surface-2 border border-elio-border hover:border-elio-border-bright text-elio-text-muted hover:text-elio-text shrink-0 transition-colors duration-150"
                    aria-label="Browse for vault directory"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Field>
            </div>

            {/* LLM */}
            <div className="space-y-2.5 pt-2 border-t border-elio-border">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-elio-text-dim">
                  AI provider
                </span>
                <div className="flex gap-1">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setForm((f) => f ? { ...f, llm_provider: p.provider, llm_base_url: p.llm_base_url, llm_model: p.llm_model } : f)}
                      className="px-1.5 py-0.5 rounded bg-elio-surface-2 text-[9px] text-elio-text-muted hover:text-elio-text hover:bg-elio-surface-3 transition-colors duration-150"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.llm_provider === 'anthropic' ? (
                <Field label="Anthropic API key">
                  <input
                    type="password"
                    value={form.anthropic_api_key}
                    onChange={set('anthropic_api_key')}
                    placeholder="sk-ant-…"
                    className={`${inputCls} font-mono`}
                  />
                </Field>
              ) : (
                <>
                  <Field label="Base URL">
                    <input
                      value={form.llm_base_url}
                      onChange={set('llm_base_url')}
                      placeholder="https://api.moonshot.ai/v1"
                      className={`${inputCls} font-mono`}
                    />
                  </Field>
                  <Field label="API key (blank for local Ollama)">
                    <input
                      type="password"
                      value={form.llm_api_key}
                      onChange={set('llm_api_key')}
                      placeholder="sk-…"
                      className={`${inputCls} font-mono`}
                    />
                  </Field>
                  <Field label="Model">
                    <input
                      value={form.llm_model}
                      onChange={set('llm_model')}
                      placeholder="kimi-k3"
                      className={`${inputCls} font-mono`}
                    />
                  </Field>
                </>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={test}
                  disabled={testing}
                  className="px-2.5 py-1 rounded bg-elio-surface-2 border border-elio-border hover:border-elio-border-bright text-[10px] text-elio-text-muted hover:text-elio-text disabled:opacity-40 transition-colors duration-150"
                >
                  {testing ? 'Testing…' : 'Test connection'}
                </button>
                {testResult && (
                  <span className={`flex items-center gap-1 text-[10px] ${testResult.ok ? 'text-elio-success' : 'text-elio-error'}`}>
                    {testResult.ok ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    <span className="truncate max-w-[260px]" title={testResult.detail}>
                      {testResult.detail}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* GPU */}
            <div className="space-y-2.5 pt-2 border-t border-elio-border">
              <Field label="RunPod API key (optional)">
                <input
                  type="password"
                  value={form.runpod_api_key}
                  onChange={set('runpod_api_key')}
                  placeholder="Leave blank for local mode"
                  className={`${inputCls} font-mono`}
                />
              </Field>
            </div>

            {error && <p className="text-[10px] text-elio-error">{error}</p>}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-elio-border">
              <button
                onClick={() => setSettingsOpen(false)}
                className="px-3 py-1.5 rounded text-[11px] text-elio-text-muted hover:text-elio-text hover:bg-elio-surface-2 transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="px-3 py-1.5 rounded bg-elio-primary hover:bg-elio-primary-dim text-black text-[11px] font-semibold disabled:opacity-40 transition-colors duration-150"
              >
                {saving ? 'Saving…' : 'Save & reload'}
              </button>
            </div>
          </div>
        )}
      </div>

      {picking && form && (
        <FolderPicker
          initialPath={form[picking] || '~'}
          onSelect={(path) => {
            setForm((f) => (f ? { ...f, [picking]: path } : f))
            setPicking(null)
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  )
}
