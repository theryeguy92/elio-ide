import {
  Sparkles,
  Wrench,
  ArrowRightLeft,
  BookOpen,
  Database,
  type LucideIcon,
} from 'lucide-react'
import type { StepType } from '@/lib/traceApi'

export type StepMeta = {
  label: string
  icon: LucideIcon
  color: string
}

export const STEP_META: Record<StepType, StepMeta> = {
  llm_call:      { label: 'LLM Call',     icon: Sparkles,       color: 'text-purple-400' },
  tool_call:     { label: 'Tool Call',    icon: Wrench,         color: 'text-orange-400' },
  agent_handoff: { label: 'Handoff',      icon: ArrowRightLeft, color: 'text-blue-400'   },
  memory_read:   { label: 'Memory Read',  icon: BookOpen,       color: 'text-green-400'  },
  memory_write:  { label: 'Memory Write', icon: Database,       color: 'text-yellow-400' },
}
