'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from 'reactflow'
import { toPng } from 'html-to-image'
import { Download, RefreshCw, Network, Loader, AlertCircle } from 'lucide-react'
import {
  stakeholderApi,
  type StakeholderEdge,
  type StakeholderGraph,
  type StakeholderNode,
} from '@/lib/stakeholderApi'
import AgentNode from './nodes/AgentNode'
import ToolNode from './nodes/ToolNode'
import MemoryNode from './nodes/MemoryNode'
import NodeSidebar from './NodeSidebar'

// ---------------------------------------------------------------------------
// React Flow node type registry (must be stable — defined outside component)
// ---------------------------------------------------------------------------

const nodeTypes = {
  agent: AgentNode,
  tool: ToolNode,
  memory: MemoryNode,
}

// ---------------------------------------------------------------------------
// Layout — tiered: agents (row 0) → tools (row 1) → memory (row 2)
// ---------------------------------------------------------------------------

const NODE_W = 160
const NODE_H = 72
const H_GAP = 48
const V_GAP = 88

function computeLayout(nodes: StakeholderNode[]): Node<StakeholderNode>[] {
  const agents  = nodes.filter((n) => n.type === 'agent')
  const tools   = nodes.filter((n) => n.type === 'tool')
  const memories = nodes.filter((n) => n.type === 'memory')

  const rowPx = (row: StakeholderNode[]) =>
    Math.max(0, row.length * (NODE_W + H_GAP) - H_GAP)

  const maxPx = Math.max(rowPx(agents), rowPx(tools), rowPx(memories))

  const placeRow = (row: StakeholderNode[], yPx: number): Node<StakeholderNode>[] =>
    row.map((node, i) => ({
      id: node.id,
      type: node.type,
      position: {
        x: (maxPx - rowPx(row)) / 2 + i * (NODE_W + H_GAP),
        y: yPx,
      },
      data: node,
      style: { width: NODE_W },
    }))

  return [
    ...placeRow(agents,   0),
    ...placeRow(tools,    NODE_H + V_GAP),
    ...placeRow(memories, (NODE_H + V_GAP) * 2),
  ]
}

function toRFEdges(edges: StakeholderEdge[], animated: boolean): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.count > 1 ? `${e.label} (×${e.count})` : e.label,
    animated,
    type: 'smoothstep',
    style: { stroke: animated ? '#F5A623' : '#333333', strokeWidth: animated ? 2 : 1.5 },
    labelStyle: { fill: '#888888', fontSize: 9, fontFamily: 'inherit' },
    labelBgStyle: { fill: '#141414', fillOpacity: 0.9, rx: 2 },
    labelBgPadding: [4, 3] as [number, number],
  }))
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

// ---------------------------------------------------------------------------
// Inner component — uses hooks that require ReactFlowProvider context
// ---------------------------------------------------------------------------

function StakeholderCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  const [graph, setGraph]               = useState<StakeholderGraph | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [refreshing, setRefreshing]     = useState(false)
  const [hasLiveRun, setHasLiveRun]     = useState(false)
  const [selectedNode, setSelectedNode] = useState<StakeholderNode | null>(null)

  // Derived React Flow state
  const rfNodes = graph ? computeLayout(graph.nodes) : []
  const rfEdges = graph ? toRFEdges(graph.edges, hasLiveRun) : []

  const loadGraph = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const [g] = await Promise.all([stakeholderApi.graph()])
      setGraph(g)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      if (showSpinner) setRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  // Refresh every 30 s
  useEffect(() => {
    const id = setInterval(() => loadGraph(), 30_000)
    return () => clearInterval(id)
  }, [loadGraph])

  // Poll for live runs every 15 s to drive edge animation
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/traces/runs`,
        )
        if (!res.ok) return
        const runs = (await res.json()) as Array<{ status: string }>
        setHasLiveRun(runs.some((r) => r.status === 'running'))
      } catch {
        // ignore
      }
    }
    check()
    const id = setInterval(check, 15_000)
    return () => clearInterval(id)
  }, [])

  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNode((prev) =>
      prev?.id === node.id ? null : (node.data as StakeholderNode),
    )
  }, [])

  const handleExport = useCallback(async () => {
    if (!containerRef.current) return
    try {
      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: '#1e1e1e',
        pixelRatio: 2,
        filter: (el) =>
          !el.classList?.contains('react-flow__controls') &&
          !el.classList?.contains('react-flow__attribution'),
      })
      const link = document.createElement('a')
      link.download = `elio-architecture-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch {
      // export failed — fail silently
    }
  }, [])

  // ------------------------------------------------------------------
  // Render states
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center gap-2 text-elio-text-dim text-[11px]">
        <Loader className="h-4 w-4 animate-spin" />
        Building architecture diagram…
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 px-6 text-center">
        <AlertCircle className="h-6 w-6 text-elio-error" />
        <p className="text-[11px] text-elio-error">{error}</p>
        <button
          onClick={() => loadGraph(true)}
          className="text-[11px] text-elio-primary hover:opacity-80 transition-opacity"
        >
          Retry
        </button>
      </div>
    )
  }

  if (graph && graph.nodes.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Network className="h-10 w-10 text-elio-text-dim opacity-30" />
        <div>
          <p className="text-[11px] font-medium text-elio-text-muted">No agent runs yet</p>
          <p className="text-[10px] text-elio-text-dim mt-1 leading-relaxed">
            Start an agent run and this diagram will auto-populate with the system
            components and how they connect.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-elio-border shrink-0 bg-elio-surface">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {hasLiveRun && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-elio-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-elio-primary" />
            </span>
          )}
          {graph && (
            <span className="text-[10px] text-elio-text-dim truncate">
              Updated {relativeTime(graph.last_updated)} ·{' '}
              {graph.nodes.length} component{graph.nodes.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button
          onClick={() => loadGraph(true)}
          disabled={refreshing}
          className="p-1 rounded hover:bg-elio-surface-2 transition-colors duration-150 disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 text-elio-text-dim ${refreshing ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={handleExport}
          className="flex items-center gap-1 px-2 py-1 rounded bg-elio-surface-2 hover:bg-elio-surface-3 border border-elio-border transition-colors duration-150 text-[10px] text-elio-text-muted"
        >
          <Download className="h-3 w-3" />
          Export
        </button>
      </div>

      {/* Canvas + sidebar */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={containerRef} className="h-full w-full">
          <ReactFlow
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            nodesDraggable={false}
            nodesConnectable={false}
            panOnScroll
            zoomOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1}
              color="#222222"
            />
            <Controls
              showInteractive={false}
              className="!border-[#3c3c3c] !bg-[#252526] !shadow-none"
            />
          </ReactFlow>
        </div>

        {/* Node detail sidebar — overlays canvas from the right */}
        {selectedNode && (
          <NodeSidebar
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Default export — wraps with ReactFlowProvider
// ---------------------------------------------------------------------------

export default function StakeholderTab() {
  return (
    <ReactFlowProvider>
      <StakeholderCanvas />
    </ReactFlowProvider>
  )
}
