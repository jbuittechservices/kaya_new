/**
 * A phone input with a fixed "+234" country prefix. `value` is always the full
 * E.164-ish string (e.g. "+2348030001122") so callers don't need any conversion
 * logic — this component handles the common ways people type a Nigerian number
 * (with or without a leading 0, with or without spaces) and normalizes all of
 * them to the same stored format, which is what Twilio actually requires.
 */
export default function PhoneInput({ label, error, value, onChange, dark = false, ...props }) {
  // Strip the +234 prefix back off just for display in the input itself
  const national = (value || '').replace(/^\+234/, '')

  function handleChange(e) {
    let digits = e.target.value.replace(/\D/g, '')
    if (digits.startsWith('234')) digits = digits.slice(3) // pasted a full number including country code
    if (digits.startsWith('0')) digits = digits.slice(1) // typed the local leading 0
    digits = digits.slice(0, 10) // Nigerian numbers are 10 digits after the country code
    onChange(digits ? `+234${digits}` : '')
  }

  const wrapperClass = dark
    ? 'flex items-center rounded-2xl border border-white/15 bg-white/[0.06] px-4 transition focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/25'
    : 'flex items-center rounded-2xl border border-navy-900/12 bg-white px-4 transition focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/25'

  return (
    <label className="block">
      {label && <span className={`mb-1.5 block text-sm font-medium ${dark ? 'text-white/70' : 'text-navy-900/80'}`}>{label}</span>}
      <div className={wrapperClass}>
        <span className={`shrink-0 py-3.5 pr-2 text-[15px] font-semibold ${dark ? 'text-white/50' : 'text-navy-900/40'}`}>+234</span>
        <span className={`h-5 w-px shrink-0 ${dark ? 'bg-white/15' : 'bg-navy-900/12'}`} />
        <input
          type="tel"
          inputMode="numeric"
          value={national}
          onChange={handleChange}
          placeholder="803 000 1122"
          className={`w-full bg-transparent py-3.5 pl-2 text-[15px] outline-none ${dark ? 'text-white placeholder:text-white/30' : 'text-navy-950 placeholder:text-navy-900/35'}`}
          {...props}
        />
      </div>
      {error && <span className={`mt-1 block text-xs font-medium ${dark ? 'text-amber-300' : 'text-danger'}`}>{error}</span>}
    </label>
  )
}
