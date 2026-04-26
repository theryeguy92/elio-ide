import type { HealthStatus } from '@/lib/stakeholderApi'

const colors: Record<HealthStatus, string> = {
  green: 'bg-green-400',
  yellow: 'bg-yellow-400',
  red: 'bg-red-400',
}

const labels: Record<HealthStatus, string> = {
  green: 'Healthy',
  yellow: 'Degraded',
  red: 'Unhealthy',
}

export default function HealthDot({ status }: { status: HealthStatus }) {
  return (
    <span
      className={`ml-auto h-2 w-2 rounded-full shrink-0 ${colors[status]}`}
      title={labels[status]}
    />
  )
}
