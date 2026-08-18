export default function DarkInput({ label, error, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-white/70">{label}</span>}
      <input
        className={`w-full rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-[15px] text-white outline-none transition placeholder:text-white/30 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 ${className}`}
        {...props}
      />
      {error && <span className="mt-1 block text-xs font-medium text-amber-300">{error}</span>}
    </label>
  )
}
