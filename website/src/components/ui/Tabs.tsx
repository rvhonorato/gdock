import { useId, useState } from 'react'
import type { ReactNode } from 'react'

interface Tab {
  id: string
  label: string
  content: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
}

export function Tabs({ tabs, defaultTab }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)
  const baseId = useId()

  return (
    <div>
      <div
        role="tablist"
        className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-700 -mx-2 px-2 scrollbar-hide"
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            id={`${baseId}-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`${baseId}-panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-accent-500 text-accent-500'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {/* All panels stay in the DOM, so crawlers and page search find their text.
          Do not put a heavy or stateful component (viewer, WASM job) in a tab:
          it would mount hidden, with zero size, and keep running. */}
      {tabs.map(tab => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          className="pt-4"
        >
          {tab.content}
        </div>
      ))}
    </div>
  )
}
