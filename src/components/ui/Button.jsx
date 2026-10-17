const variants = {
  primary:   'bg-primary text-white hover:bg-primary-light',
  secondary: 'bg-surface border border-surface-border text-text hover:bg-surface-alt',
  danger:    'bg-danger text-white hover:bg-danger-dark',
  ghost:     'text-primary hover:bg-primary-bg',
  // Destructive action that shouldn't shout (Reject, Decline, Deactivate). Use instead of overriding ghost's colour.
  'ghost-danger': 'text-danger-dark hover:bg-danger-bg',
}

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
}

// For links styled as buttons (e.g. <Link className={buttonClasses()}>) — never nest <button> in <a>.
export function buttonClasses({ variant = 'primary', size = 'md', className = '' } = {}) {
  return [
    'inline-flex items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap',
    'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variants[variant] ?? variants.secondary,
    sizes[size],
    className,
  ].join(' ')
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  className = '',
  onClick,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {children}
    </button>
  )
}
