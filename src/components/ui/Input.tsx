import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-xs text-slate-400 font-medium">{label}</label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-3 py-1.5 text-sm
            bg-slate-900/60 border border-slate-700/50 rounded-lg
            text-slate-200 placeholder:text-slate-500
            focus:outline-none focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500/50
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-500/50 focus:ring-red-500/50' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    )
  },
)

Input.displayName = 'Input'
