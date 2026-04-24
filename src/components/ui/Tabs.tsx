import { useState, type ReactNode } from 'react'

interface Tab {
  key: string
  label: ReactNode
  icon?: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  activeKey: string
  onChange: (key: string) => void
  className?: string
}

export function Tabs({ tabs, activeKey, onChange, className = '' }: TabsProps) {
  return (
    <div className={`flex ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`
            flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium
            transition-colors
            ${activeKey === tab.key
              ? 'text-primary-400 border-t-2 border-primary-400'
              : 'text-slate-400 hover:text-slate-300 border-t-2 border-transparent'
            }
          `}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
