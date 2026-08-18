export default function Input({ label, error, icon, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-navy-900/80">{label}</span>}
      <div className="relative flex items-center">
        {icon && <span className="absolute left-4 text-lg text-navy-900/40">{icon}</span>}
        <input
          className={`w-full rounded-2xl border border-navy-900/12 bg-white px-4 py-3.5 text-[15px] text-navy-950 outline-none transition placeholder:text-navy-900/35 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 ${icon ? 'pl-11' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <span className="mt-1 block text-xs font-medium text-danger">{error}</span>}
    </label>
  )
}
