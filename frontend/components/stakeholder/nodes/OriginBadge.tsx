import { AlertTriangle, CircleDashed } from 'lucide-react'
import type { StakeholderNode } from '@/lib/stakeholderApi'

/** Declared-but-untested (dashed) or observed-but-undocumented (amber) marker. */
export default function OriginBadge({ node }: { node: StakeholderNode }) {
  if (node.origin === 'declared') {
    return (
      <span title="Declared in elio.agents.yaml — not yet observed in a run">
        <CircleDashed className="h-2.5 w-2.5 text-elio-text-dim" />
      </span>
    )
  }
  if (node.origin === 'observed' && node.documented) {
    return (
      <span title="Undocumented — seen in traces but missing from elio.agents.yaml">
        <AlertTriangle className="h-2.5 w-2.5 text-elio-warning" />
      </span>
    )
  }
  return null
}
