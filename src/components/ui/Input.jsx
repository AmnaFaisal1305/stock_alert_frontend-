import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function Input({
  label,
  id,
  error,
  type = 'text',
  className = '',
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword && showPassword ? 'text' : type

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type={inputType}
          className={[
            'w-full rounded-lg border px-3.5 py-2 text-sm text-text bg-white shadow-sm transition-all',
            'placeholder:text-text-muted/60',
            'focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10',
            isPassword ? 'pr-10' : '',
            error
              ? 'border-danger focus:border-danger focus:ring-danger/10'
              : 'border-surface-border',
            className,
          ].join(' ')}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-muted hover:text-text focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff size={16} strokeWidth={2.2} />
            ) : (
              <Eye size={16} strokeWidth={2.2} />
            )}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
