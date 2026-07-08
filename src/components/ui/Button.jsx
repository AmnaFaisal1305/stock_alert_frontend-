const variants = {
  primary:   'bg-primary text-white shadow-sm hover:bg-primary-light focus-visible:ring-primary active:scale-[0.98]',
  secondary: 'bg-surface border border-surface-border text-text shadow-sm hover:bg-surface-alt hover:text-text focus-visible:ring-secondary active:scale-[0.98]',
  danger:    'bg-danger text-white shadow-sm hover:bg-danger-light focus-visible:ring-danger active:scale-[0.98]',
  ghost:     'text-primary hover:bg-primary/5 focus-visible:ring-primary',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-sm rounded-lg',
  lg: 'px-5 py-2.5 text-sm font-semibold rounded-lg',
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
