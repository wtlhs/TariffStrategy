import { useState, useRef, useEffect, type ReactNode } from 'react'

interface SelectOption {
  value: string
  label: string
  icon?: ReactNode
}

interface SelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function Select({ options, value, onChange, placeholder, className = '' }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-1.5 text-sm flex items-center gap-2
          bg-slate-900/60 border border-slate-700/50 rounded-lg
          text-slate-200 text-left
          hover:border-slate-600/50
          focus:outline-none focus:ring-1 focus:ring-primary-500/50"
      >
        {selected?.icon}
        <span className="flex-1 truncate">
          {selected?.label ?? placeholder ?? '请选择'}
        </span>
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 py-1
          bg-slate-800 border border-slate-700/50 rounded-lg shadow-xl
          max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full px-3 py-1.5 text-sm text-left flex items-center gap-2
                hover:bg-slate-700/50 transition-colors
                ${opt.value === value ? 'text-primary-400 bg-primary-500/10' : 'text-slate-300'}`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
