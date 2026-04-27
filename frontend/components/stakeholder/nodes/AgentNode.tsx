import { Handle, Position, type NodeProps } from 'reactflow'
import type { StakeholderNode } from '@/lib/stakeholderApi'
import HealthDot from './HealthDot'

export default function AgentNode({ data, selected }: NodeProps<StakeholderNode>) {
  return (
    <div
      className={`w-40 border transition-colors duration-150 ${
        selected
          ? 'border-[#F5A623] bg-[#1A1500]'
          : 'border-[#F5A623]/30 bg-[#1A1500] hover:border-[#F5A623]/60'
      }`}
      style={selected ? { boxShadow: '0 0 0 1px rgba(245,166,35,0.25)' } : undefined}
    >
      <Handle type="target" position={Position.Top}   className="!opacity-0 !pointer-events-none" />
      <Handle type="target" position={Position.Left}  className="!opacity-0 !pointer-events-none" />

      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-[#F5A623]/20">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-[#F5A623]/70">
          Agent
        </span>
        <HealthDot status={data.health} />
      </div>

      <div className="px-2.5 py-2">
        <p className="text-[11px] font-semibold text-[#F0F0F0] leading-tight truncate" title={data.label}>
          {data.label}
        </p>
        <p className="text-[10px] text-[#F5A623]/50 mt-1">
          {data.call_count} run{data.call_count !== 1 ? 's' : ''}
        </p>
      </div>

      <Handle type="source" position={Position.Bottom} className="!opacity-0 !pointer-events-none" />
      <Handle type="source" position={Position.Right}  className="!opacity-0 !pointer-events-none" />
    </div>
  )
}
