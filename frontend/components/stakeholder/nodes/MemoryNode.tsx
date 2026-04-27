import { Handle, Position, type NodeProps } from 'reactflow'
import type { StakeholderNode } from '@/lib/stakeholderApi'
import HealthDot from './HealthDot'

export default function MemoryNode({ data, selected }: NodeProps<StakeholderNode>) {
  const { read_count, write_count } = data.metadata

  return (
    <div
      className={`w-40 border transition-colors duration-150 ${
        selected
          ? 'border-blue-400 bg-[#0D1520]'
          : 'border-blue-800/50 bg-[#0D1520] hover:border-blue-600/60'
      }`}
      style={selected ? { boxShadow: '0 0 0 1px rgba(96,165,250,0.2)' } : undefined}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !pointer-events-none" />

      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-blue-800/30">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-blue-400/70">
          Memory
        </span>
        <HealthDot status={data.health} />
      </div>

      <div className="px-2.5 py-2">
        <p className="text-[11px] font-semibold text-[#F0F0F0] leading-tight truncate" title={data.label}>
          {data.label}
        </p>
        <div className="flex gap-2 mt-1">
          <span className="text-[10px] text-blue-400/50">{read_count}r</span>
          <span className="text-[10px] text-blue-400/50">{write_count}w</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0 !pointer-events-none" />
    </div>
  )
}
