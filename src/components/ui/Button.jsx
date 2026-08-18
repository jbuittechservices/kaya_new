const VARIANTS = {
  primary: 'bg-amber-500 text-navy-950 hover:bg-amber-400 disabled:bg-amber-300',
  dark: 'bg-navy-900 text-white hover:bg-navy-800 disabled:bg-navy-600',
  outline: 'bg-transparent border border-navy-900/15 text-navy-900 hover:bg-navy-900/5',
  ghost: 'bg-transparent text-navy-900 hover:bg-navy-900/5',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15',
  'outline-light': 'bg-white/10 border border-white/25 text-white hover:bg-white/20',
}

const SIZES = {
  sm: 'h-9 px-3.5 text-sm rounded-xl',
  md: 'h-12 px-5 text-[15px] rounded-2xl',
  lg: 'h-14 px-6 text-base rounded-2xl',
}

export default function Button({
  as: Comp = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  full,
  ...props
}) {
  return (
    <Comp
      className={`tap inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </Comp>
  )
}
