const variants = {
  primary:   'bg-primary text-text-inverse hover:bg-primary-dark focus-visible:ring-primary',
  secondary: 'bg-surface border border-surface-border text-text hover:bg-surface-alt focus-visible:ring-secondary',
  danger:    'bg-danger text-text-inverse hover:bg-danger-dark focus-visible:ring-danger',
  ghost:     'text-primary hover:bg-primary/10 focus-visible:ring-primary',
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
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
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
