import { Handle, Position, type NodeProps } from 'reactflow'
import type { StakeholderNode } from '@/lib/stakeholderApi'
import HealthDot from './HealthDot'

export default function ToolNode({ data, selected }: NodeProps<StakeholderNode>) {
  return (
    <div
      className={`w-40 rounded-lg border bg-[#1e1a2e] transition-shadow ${
        selected
          ? 'border-purple-400 shadow-[0_0_0_2px_rgba(192,132,252,0.35)]'
          : 'border-purple-800/60 hover:border-purple-600'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!opacity-0 !pointer-events-none"
      />

      {/* Header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-900/40 rounded-t-lg border-b border-purple-800/40">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-purple-400">
          Tool
        </span>
        <HealthDot status={data.health} />
      </div>

      {/* Body */}
      <div className="px-2.5 py-2">
        <p className="text-xs font-semibold text-white leading-tight truncate" title={data.label}>
          {data.label}
        </p>
        <p className="text-[10px] text-purple-300/70 mt-1">
          {data.call_count} call{data.call_count !== 1 ? 's' : ''}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!opacity-0 !pointer-events-none"
      />
    </div>
  )
}
