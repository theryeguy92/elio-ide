'use client'

import { useState } from 'react'
import { Terminal, Cpu, Users, ChevronDown } from 'lucide-react'
import GPULauncher from '@/components/gpu/GPULauncher'
import StakeholderTab from '@/components/stakeholder/StakeholderTab'

type TabId = 'terminal' | 'gpu' | 'stakeholder'

const tabs = [
  { id: 'terminal' as TabId, label: 'Terminal', icon: Terminal },
  { id: 'gpu' as TabId, label: 'GPU Launcher', icon: Cpu },
  { id: 'stakeholder' as TabId, label: 'Stakeholder', icon: Users },
]

export default function BottomTabBar() {
  const [activeTab, setActiveTab] = useState<TabId>('terminal')
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className={`bg-[#1e1e1e] border-t border-[#3c3c3c] flex flex-col shrink-0 transition-all duration-200 ${
        collapsed ? 'h-9' : activeTab === 'stakeholder' ? 'h-96' : 'h-48'
      }`}
    >
      <div className="h-9 flex items-center bg-[#252526] border-b border-[#3c3c3c] shrink-0">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              if (collapsed) setCollapsed(false)
              setActiveTab(id)
            }}
            className={`h-full flex items-center gap-1.5 px-4 text-xs font-medium border-t-2 transition-colors ${
              activeTab === id && !collapsed
                ? 'border-blue-500 text-white bg-[#1e1e1e]'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#2a2d2e]'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="px-2 py-1 mr-2 rounded hover:bg-[#3c3c3c] transition-colors"
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              collapsed ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-auto">
          {activeTab === 'terminal' && (
            <div className="h-full bg-[#0d0d0d] p-3 font-mono text-sm">
              <p className="text-gray-500 text-xs mb-2">Terminal — bash</p>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">~/elio-project</span>
                <span className="text-white">$</span>
                <span className="text-gray-300">uvicorn main:app --reload</span>
              </div>
              <p className="mt-1 text-gray-400 text-xs">
                INFO: Uvicorn running on http://127.0.0.1:8000
              </p>
            </div>
          )}
          {activeTab === 'gpu' && <GPULauncher />}
          {activeTab === 'stakeholder' && <StakeholderTab />}
        </div>
      )}
    </div>
  )
}
