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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mbToGb(mb: number): string {
  return (mb / 1024).toFixed(1)
}

// ---------------------------------------------------------------------------
// ComputePanel
// ---------------------------------------------------------------------------

export default function ComputePanel() {
  const { computePanelOpen, setComputePanelOpen } = useEditor()

  const [status, setStatus] = useState<ComputeStatus | null>(null)
  const [models, setModels] = useState<ComputeModels | null>(null)
  const [settings, setSettings] = useState<SettingsMeta | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [form, setForm] = useState<SettingsPayload>({})

  useEffect(() => {
    if (!computePanelOpen) return

    setLoadingStatus(true)
    Promise.all([computeApi.status(), computeApi.models(), computeApi.getSettings()])
      .then(([s, m, cfg]) => {
        setStatus(s)
        setModels(m)
        setSettings(cfg)
        setForm({ ACTIVE_MODEL: cfg.ACTIVE_MODEL ?? '' })
      })
      .catch(() => {})
      .finally(() => setLoadingStatus(false))
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => setComputePanelOpen(false)}
      />

      {/* Panel */}
      <div className="relative ml-auto w-96 h-full bg-[#252526] border-l border-[#3c3c3c] flex flex-col shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c] shrink-0">
          <h2 className="text-sm font-semibold text-gray-200">Compute Settings</h2>
          <button
            onClick={() => setComputePanelOpen(false)}
            className="p-1 rounded hover:bg-[#3c3c3c] transition-colors"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {loadingStatus ? (
          <div className="flex-1 flex items-center justify-center gap-2 text-gray-500 text-xs">
            <Loader className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        ) : (
          <div className="flex-1 p-4 space-y-6">
            {/* Ollama status */}
            {status && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Local Inference
                </h3>
                <div className="flex items-center gap-2 p-3 rounded bg-[#1e1e1e]">
                  <Zap className="h-4 w-4 text-yellow-400 shrink-0" />
                  <span className="text-xs text-gray-300 flex-1">Ollama</span>
                  {status.ollama.running ? (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Running
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <XCircle className="h-3.5 w-3.5" />
                      Offline
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* GPU info */}
            {status && status.gpus.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  GPUs
                </h3>
                <div className="space-y-2">
                  {status.gpus.map((gpu, i) => (
                    <div key={i} className="p-3 rounded bg-[#1e1e1e]">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span className="text-xs text-gray-200 truncate">{gpu.name}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-500">
                          <span>VRAM</span>
                          <span>
                            {mbToGb(gpu.memory_used_mb)} / {mbToGb(gpu.memory_total_mb)} GB
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#3c3c3c] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all"
                            style={{
                              width: `${(gpu.memory_used_mb / gpu.memory_total_mb) * 100}%`,
                            }}
                          />
                        </div>
                        {gpu.utilization_pct !== null && (
                          <div className="flex justify-between text-[10px] text-gray-500">
                            <span>Utilization</span>
                            <span>{gpu.utilization_pct}%</span>
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
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Active Model
                </h3>
                <select
                  value={form.ACTIVE_MODEL ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, ACTIVE_MODEL: e.target.value }))}
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">— Select model —</option>
                  {models.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      [{m.provider}] {m.name}
                      {m.size_gb ? ` (${m.size_gb}GB)` : ''}
                    </option>
                  ))}
                </select>
              </section>
            )}

            {/* API Keys */}
            <section>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                API Keys
              </h3>
              <div className="space-y-3">
                {(
                  [
                    ['ANTHROPIC_API_KEY', 'Anthropic'],
                    ['OPENAI_API_KEY', 'OpenAI'],
                    ['RUNPOD_API_KEY', 'RunPod'],
                    ['LAMBDA_LABS_API_KEY', 'Lambda Labs'],
                  ] as [keyof SettingsPayload, string][]
                ).map(([key, label]) => (
                  <div key={key}>
                    <label className="block text-[10px] text-gray-500 mb-1">
                      {label}
                      {settings?.[key as keyof SettingsMeta] === true && (
                        <span className="ml-2 text-green-400">● set</span>
                      )}
                    </label>
                    <input
                      type="password"
                      placeholder={
                        settings?.[key as keyof SettingsMeta] ? '••••••••' : 'Enter key…'
                      }
                      value={(form[key] as string | undefined) ?? ''}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                      className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                ))}
              </div>
            </section>

            {saveError && (
              <p className="text-xs text-red-400">{saveError}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs text-white font-medium"
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
