'use client'

import { useEffect, useState } from 'react'
import { X, Loader, CheckCircle, XCircle, Cpu, Zap } from 'lucide-react'
import {
  computeApi,
  type ComputeStatus,
  type ComputeModels,
  type SettingsMeta,
  type SettingsPayload,
} from '@/lib/computeApi'
import { useEditor } from '@/context/EditorContext'

function mbToGb(mb: number): string { return (mb / 1024).toFixed(1) }

export default function ComputePanel() {
  const { computePanelOpen, setComputePanelOpen } = useEditor()

  const [status, setStatus]   = useState<ComputeStatus | null>(null)
  const [models, setModels]   = useState<ComputeModels | null>(null)
  const [settings, setSettings] = useState<SettingsMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<SettingsPayload>({})

  useEffect(() => {
    if (!computePanelOpen) return
    setLoading(true)
    Promise.all([computeApi.status(), computeApi.models(), computeApi.getSettings()])
      .then(([s, m, cfg]) => {
        setStatus(s)
        setModels(m)
        setSettings(cfg)
        setForm({ ACTIVE_MODEL: cfg.ACTIVE_MODEL ?? '' })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [computePanelOpen])

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const payload: SettingsPayload = {}
      for (const [k, v] of Object.entries(form)) {
        if (v) payload[k as keyof SettingsPayload] = v
      }
      const updated = await computeApi.saveSettings(payload)
      setSettings(updated)
      setForm({ ACTIVE_MODEL: updated.ACTIVE_MODEL ?? '' })
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!computePanelOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60" onClick={() => setComputePanelOpen(false)} />

      <div className="relative ml-auto w-96 h-full bg-elio-surface border-l border-elio-border flex flex-col shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-elio-border shrink-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-elio-text-muted">
            Compute Settings
          </h2>
          <button
            onClick={() => setComputePanelOpen(false)}
            className="p-1 rounded hover:bg-elio-surface-2 transition-colors duration-150"
          >
            <X className="h-4 w-4 text-elio-text-dim" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-elio-text-dim text-[11px]">
            <Loader className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="flex-1 p-4 space-y-6">
            {/* Ollama status */}
            {status && (
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-elio-text-dim mb-2">
                  Local Inference
                </h3>
                <div className="flex items-center gap-2 p-3 bg-elio-surface-2 border border-elio-border">
                  <Zap className="h-3.5 w-3.5 text-elio-primary shrink-0" />
                  <span className="text-[11px] text-elio-text-muted flex-1">Ollama</span>
                  {status.ollama.running ? (
                    <span className="flex items-center gap-1 text-[10px] text-elio-success">
                      <CheckCircle className="h-3 w-3" />
                      Running
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-elio-error">
                      <XCircle className="h-3 w-3" />
                      Offline
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* GPU info */}
            {status && status.gpus.length > 0 && (
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-elio-text-dim mb-2">
                  GPUs
                </h3>
                <div className="space-y-2">
                  {status.gpus.map((gpu, i) => (
                    <div key={i} className="p-3 bg-elio-surface-2 border border-elio-border">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span className="text-[11px] text-elio-text truncate">{gpu.name}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-elio-text-dim">
                          <span>VRAM</span>
                          <span className="font-mono">
                            {mbToGb(gpu.memory_used_mb)} / {mbToGb(gpu.memory_total_mb)} GB
                          </span>
                        </div>
                        <div className="h-1 bg-elio-surface-3 overflow-hidden">
                          <div
                            className="h-full bg-elio-primary transition-all duration-300"
                            style={{ width: `${(gpu.memory_used_mb / gpu.memory_total_mb) * 100}%` }}
                          />
                        </div>
                        {gpu.utilization_pct !== null && (
                          <div className="flex justify-between text-[10px] text-elio-text-dim">
                            <span>Utilization</span>
                            <span className="font-mono">{gpu.utilization_pct}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Active model */}
            {models && models.models.length > 0 && (
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-elio-text-dim mb-2">
                  Active Model
                </h3>
                <select
                  value={form.ACTIVE_MODEL ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, ACTIVE_MODEL: e.target.value }))}
                  className="w-full bg-elio-surface-2 border border-elio-border px-3 py-2 text-[11px] text-elio-text focus:outline-none focus:border-elio-primary transition-colors duration-150"
                >
                  <option value="">— Select model —</option>
                  {models.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.provider}] {m.name}{m.size_gb ? ` (${m.size_gb}GB)` : ''}
                    </option>
                  ))}
                </select>
              </section>
            )}

            {/* API Keys */}
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-elio-text-dim mb-2">
                API Keys
              </h3>
              <div className="space-y-3">
                {(
                  [
                    ['ANTHROPIC_API_KEY', 'Anthropic'],
                    ['OPENAI_API_KEY',    'OpenAI'],
                    ['RUNPOD_API_KEY',    'RunPod'],
                    ['LAMBDA_LABS_API_KEY', 'Lambda Labs'],
                  ] as [keyof SettingsPayload, string][]
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-[10px] text-elio-text-dim mb-1">
                      {label}
                      {settings?.[key as keyof SettingsMeta] === true && (
                        <span className="ml-2 text-elio-success">● set</span>
                      )}
                    </label>
                    <input
                      type="password"
                      placeholder={settings?.[key as keyof SettingsMeta] ? '••••••••' : 'Enter key…'}
                      value={(form[key] as string | undefined) ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full bg-elio-surface-2 border border-elio-border px-3 py-2 text-[11px] text-elio-text placeholder-elio-text-dim focus:outline-none focus:border-elio-primary transition-colors duration-150"
                    />
                  </div>
                ))}
              </div>
            </section>

            {saveError && <p className="text-[11px] text-elio-error">{saveError}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2 bg-elio-primary hover:bg-elio-primary-dim text-black font-semibold text-[11px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
            >
              {saving && <Loader className="h-3.5 w-3.5 animate-spin" />}
              Save Settings
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
