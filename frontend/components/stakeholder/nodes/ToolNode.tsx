import { Handle, Position, type NodeProps } from 'reactflow'
import type { StakeholderNode } from '@/lib/stakeholderApi'
import HealthDot from './HealthDot'

export default function ToolNode({ data, selected }: NodeProps<StakeholderNode>) {
  return (
    <div
      className={`w-40 border transition-colors duration-150 ${
        selected
          ? 'border-purple-400 bg-[#130D1F]'
          : 'border-purple-800/50 bg-[#130D1F] hover:border-purple-600/60'
      }`}
      style={selected ? { boxShadow: '0 0 0 1px rgba(167,139,250,0.2)' } : undefined}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !pointer-events-none" />

      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-purple-800/30">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-purple-400/70">
          Tool
        </span>
        <HealthDot status={data.health} />
      </div>

      <div className="px-2.5 py-2">
        <p className="text-[11px] font-semibold text-[#F0F0F0] leading-tight truncate" title={data.label}>
          {data.label}
        </p>
        <p className="text-[10px] text-purple-400/50 mt-1">
          {data.call_count} call{data.call_count !== 1 ? 's' : ''}
        </p>
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0 !pointer-events-none" />
    </div>
  )
}
