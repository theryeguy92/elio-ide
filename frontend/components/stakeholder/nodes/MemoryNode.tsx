import { Handle, Position, type NodeProps } from 'reactflow'
import type { StakeholderNode } from '@/lib/stakeholderApi'
import HealthDot from './HealthDot'

export default function MemoryNode({ data, selected }: NodeProps<StakeholderNode>) {
  const { read_count, write_count } = data.metadata

  return (
    <div
      className={`w-40 rounded-lg border bg-[#1e1a0e] transition-shadow ${
        selected
          ? 'border-amber-400 shadow-[0_0_0_2px_rgba(251,191,36,0.35)]'
          : 'border-amber-800/60 hover:border-amber-600'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!opacity-0 !pointer-events-none"
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-900/30 rounded-t-lg border-b border-amber-800/40">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-400">
          Memory
        </span>
        <HealthDot status={data.health} />
      </div>

      {/* Body */}
      <div className="px-2.5 py-2">
        <p className="text-xs font-semibold text-white leading-tight truncate" title={data.label}>
          {data.label}
        </p>
        <div className="flex gap-2 mt-1">
          <span className="text-[10px] text-amber-300/70">{read_count}r</span>
          <span className="text-[10px] text-amber-300/70">{write_count}w</span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!opacity-0 !pointer-events-none"
      />
    </div>
  )
}
