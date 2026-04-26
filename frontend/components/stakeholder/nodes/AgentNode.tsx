import { Handle, Position, type NodeProps } from 'reactflow'
import type { StakeholderNode } from '@/lib/stakeholderApi'
import HealthDot from './HealthDot'

export default function AgentNode({ data, selected }: NodeProps<StakeholderNode>) {
  return (
    <div
      className={`w-40 rounded-lg border bg-[#1a2a3a] transition-shadow ${
        selected
          ? 'border-blue-400 shadow-[0_0_0_2px_rgba(96,165,250,0.35)]'
          : 'border-blue-800/60 hover:border-blue-600'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!opacity-0 !pointer-events-none"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!opacity-0 !pointer-events-none"
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-900/40 rounded-t-lg border-b border-blue-800/40">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-blue-400">
          Agent
        </span>
        <HealthDot status={data.health} />
      </div>

      {/* Body */}
      <div className="px-2.5 py-2">
        <p className="text-xs font-semibold text-white leading-tight truncate" title={data.label}>
          {data.label}
        </p>
        <p className="text-[10px] text-blue-300/70 mt-1">
          {data.call_count} run{data.call_count !== 1 ? 's' : ''}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!opacity-0 !pointer-events-none"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!opacity-0 !pointer-events-none"
      />
    </div>
  )
}
