import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Loader2 } from 'lucide-react'
import { hasGoogleMaps, useGoogleMaps } from '../../lib/googleMaps'

let placesServiceDiv = null // shared dummy element PlacesService requires; never attached to the DOM

/**
 * A text input with a fully custom-styled autocomplete dropdown, built directly
 * on Google's AutocompleteService/PlacesService rather than the built-in
 * <Autocomplete> widget. The built-in widget renders its own unstyled dropdown
 * (`.pac-container`) appended straight to <body>, completely outside Tailwind/React,
 * which looks broken next to the rest of the app. This renders real React elements
 * we can theme, animate, and keyboard-navigate like everything else in the app.
 *
 * The dropdown itself is rendered through a portal directly into document.body,
 * positioned by the input's own bounding box. Any ancestor between this input and
 * the page root that has `overflow: hidden` (rounded cards, scroll containers,
 * anything) would otherwise silently clip an absolutely-positioned dropdown even
 * though its own z-index looks correct — a portal sidesteps that entirely.
 *
 * Falls back to a plain input when no API key is configured, so the booking flow
 * still works end to end in local development.
 */
export default function PlacesAutocompleteInput({ value, onChange, onSelect, placeholder, className = '', dark = false }) {
  const { isLoaded } = useGoogleMaps()
  const autocompleteServiceRef = useRef(null)
  const sessionTokenRef = useRef(null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  const [predictions, setPredictions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (!isLoaded || !window.google) return
    autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
    sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken()
  }, [isLoaded])

  // Keep the portal's position glued to the input — recompute on open, and on any
  // scroll/resize anywhere on the page while it's open (position: fixed doesn't
  // auto-follow scrolling containers the input might be inside).
  useEffect(() => {
    if (!open) return
    function updateRect() {
      if (inputRef.current) setRect(inputRef.current.getBoundingClientRect())
    }
    updateRect()
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [open])

  // Close on outside click (checks both the input and the portalled dropdown)
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current?.contains(e.target)) return
      if (e.target.closest?.('[data-places-dropdown]')) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const fetchPredictions = useCallback((input) => {
    if (!autocompleteServiceRef.current || input.trim().length < 3) {
      setPredictions([])
      setLoading(false)
      return
    }
    setLoading(true)
    autocompleteServiceRef.current.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: 'ng' },
        sessionToken: sessionTokenRef.current,
      },
      (results, status) => {
        setLoading(false)
        if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results) {
          setPredictions([])
          return
        }
        setPredictions(results)
        setHighlighted(-1)
      }
    )
  }, [])

  function handleChange(e) {
    const next = e.target.value
    onChange(next)
    setOpen(true)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchPredictions(next), 300)
  }

  function selectPrediction(prediction) {
    if (!placesServiceDiv) placesServiceDiv = document.createElement('div')
    const service = new window.google.maps.places.PlacesService(placesServiceDiv)

    service.getDetails(
      { placeId: prediction.place_id, fields: ['formatted_address', 'name', 'geometry'], sessionToken: sessionTokenRef.current },
      (place, status) => {
        const address =
          status === window.google.maps.places.PlacesServiceStatus.OK
            ? place.formatted_address || place.name || prediction.description
            : prediction.description
        const lat = place?.geometry?.location?.lat?.()
        const lng = place?.geometry?.location?.lng?.()
        onChange(address)
        onSelect?.({ address, lat, lng })
        // Session tokens should be rotated after each completed search per Google's billing guidance
        sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken()
      }
    )
    setOpen(false)
    setPredictions([])
  }

  function handleKeyDown(e) {
    if (!open || predictions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => Math.min(i + 1, predictions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault()
      selectPrediction(predictions[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const baseInputClass =
    className ||
    (dark
      ? 'flex-1 bg-transparent text-sm font-medium text-white outline-none placeholder:text-white/40'
      : 'flex-1 bg-transparent text-sm font-medium text-navy-900 outline-none placeholder:text-navy-900/35')

  if (!hasGoogleMaps || !isLoaded) {
    return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={baseInputClass} />
  }

  const showDropdown = open && (loading || predictions.length > 0) && rect

  return (
    <div ref={containerRef} className="w-full flex-1">
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={baseInputClass}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />

      {showDropdown &&
        createPortal(
          <div
            data-places-dropdown
            style={{ position: 'fixed', top: rect.bottom + 8, left: rect.left, width: rect.width }}
            className={`animate-slide-up z-[100] overflow-hidden rounded-2xl border shadow-xl ${
              dark ? 'border-white/10 bg-navy-800' : 'border-navy-900/10 bg-white'
            }`}
          >
            {loading && predictions.length === 0 && (
              <div className={`flex items-center gap-2 px-4 py-3 text-sm ${dark ? 'text-white/50' : 'text-slate-muted'}`}>
                <Loader2 size={14} className="animate-spin" /> Searching…
              </div>
            )}

            <ul className="max-h-64 overflow-y-auto py-1">
              {predictions.map((p, i) => (
                <li key={p.place_id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectPrediction(p)}
                    onMouseEnter={() => setHighlighted(i)}
                    className={`flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors ${
                      i === highlighted ? (dark ? 'bg-white/10' : 'bg-amber-100/60') : ''
                    }`}
                  >
                    <MapPin size={15} className={`mt-0.5 shrink-0 ${dark ? 'text-white/40' : 'text-navy-900/35'}`} />
                    <span className="min-w-0">
                      <span className={`block truncate text-sm font-semibold ${dark ? 'text-white' : 'text-navy-950'}`}>
                        {p.structured_formatting?.main_text || p.description}
                      </span>
                      {p.structured_formatting?.secondary_text && (
                        <span className={`block truncate text-xs ${dark ? 'text-white/45' : 'text-slate-muted'}`}>
                          {p.structured_formatting.secondary_text}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {/* Required attribution when Place predictions are shown without a persistently visible Google Map */}
            <div className={`border-t px-4 py-2 text-right text-[11px] font-medium ${dark ? 'border-white/10 text-white/30' : 'border-navy-900/8 text-navy-900/30'}`}>
              Powered by Google
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
