import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api'
import { Maximize2, X } from 'lucide-react'
import { hasGoogleMaps, useGoogleMaps, DEFAULT_CENTER, MAP_STYLES } from '../../lib/googleMaps'
import MapBackdrop from './MapBackdrop'

/**
 * Renders a live Google Map with pickup/dropoff markers and the driving route
 * between them. Rider position is shown from, in priority order:
 *  1. `liveMarker` — a real {lat,lng} reported by the driver's device over Socket.IO
 *  2. `progress` (0–1) — a simulated position interpolated along the route, used
 *     as a fallback until the driver app has reported a real GPS fix
 *
 * The embedded view is a small, deliberately non-interactive preview (no gestures,
 * no zoom controls) so it doesn't fight page scrolling. Tapping the expand button
 * opens a genuinely interactive full-screen map — pan, zoom, everything — rendered
 * through a portal so it isn't constrained by the small preview's size.
 *
 * Falls back to the illustrated MapBackdrop when no Google Maps API key is
 * configured, or when we don't have coordinates to plot yet.
 */
export default function LiveMap({ pickup, dropoff, progress, liveMarker, className = '', children }) {
  const { isLoaded } = useGoogleMaps()
  const [fullscreen, setFullscreen] = useState(false)

  const hasPickup = pickup?.lat != null && pickup?.lng != null
  const hasDropoff = dropoff?.lat != null && dropoff?.lng != null

  if (!hasGoogleMaps || !isLoaded) {
    return <MapBackdrop className={className}>{children}</MapBackdrop>
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <MapCanvas pickup={pickup} dropoff={dropoff} progress={progress} liveMarker={liveMarker} interactive={false} />
      {(hasPickup || hasDropoff) && (
        <button
          onClick={() => setFullscreen(true)}
          className="tap absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-navy-950/85 px-3 py-1.5 text-xs font-semibold text-white"
        >
          <Maximize2 size={13} /> View map in full mode
        </button>
      )}
      {children}

      {fullscreen &&
        createPortal(
          <div className="fixed inset-0 z-[200] bg-white">
            <MapCanvas pickup={pickup} dropoff={dropoff} progress={progress} liveMarker={liveMarker} interactive fullHeight />
            <button
              onClick={() => setFullscreen(false)}
              className="tap safe-top absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg"
            >
              <X size={20} className="text-navy-950" />
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}

function MapCanvas({ pickup, dropoff, progress, liveMarker, interactive, fullHeight }) {
  const [directions, setDirections] = useState(null)

  const hasPickup = pickup?.lat != null && pickup?.lng != null
  const hasDropoff = dropoff?.lat != null && dropoff?.lng != null
  const hasLiveMarker = liveMarker?.lat != null && liveMarker?.lng != null

  useEffect(() => {
    setDirections(null)
    if (!hasPickup || !hasDropoff || !window.google) return
    const service = new window.google.maps.DirectionsService()
    service.route(
      {
        origin: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: dropoff.lat, lng: dropoff.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK') setDirections(result)
      }
    )
  }, [hasPickup, hasDropoff, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng])

  const riderPosition = useMemo(() => {
    if (hasLiveMarker) return { lat: liveMarker.lat, lng: liveMarker.lng }
    if (progress == null) return null
    const path = directions?.routes?.[0]?.overview_path
    if (path && path.length > 1) {
      const idx = Math.min(path.length - 1, Math.round(progress * (path.length - 1)))
      const pt = path[idx]
      return { lat: pt.lat(), lng: pt.lng() }
    }
    if (hasPickup && hasDropoff) {
      return {
        lat: pickup.lat + (dropoff.lat - pickup.lat) * progress,
        lng: pickup.lng + (dropoff.lng - pickup.lng) * progress,
      }
    }
    return null
  }, [hasLiveMarker, liveMarker, progress, directions, hasPickup, hasDropoff, pickup, dropoff])

  const center = riderPosition || (hasPickup ? { lat: pickup.lat, lng: pickup.lng } : DEFAULT_CENTER)

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: fullHeight ? '100%' : '100%' }}
      center={center}
      zoom={hasPickup && hasDropoff ? 12 : 14}
      options={{
        styles: MAP_STYLES,
        disableDefaultUI: !interactive,
        zoomControl: interactive,
        gestureHandling: interactive ? 'greedy' : 'none',
        keyboardShortcuts: interactive,
      }}
    >
      {hasPickup && (
        <Marker
          position={{ lat: pickup.lat, lng: pickup.lng }}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#0A0A0A',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }}
        />
      )}
      {hasDropoff && (
        <Marker
          position={{ lat: dropoff.lat, lng: dropoff.lng }}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#00ABFD',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }}
        />
      )}
      {riderPosition && (
        <Marker
          position={riderPosition}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#1F9D55',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          }}
        />
      )}
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: true,
            polylineOptions: { strokeColor: '#0A0A0A', strokeWeight: 3, strokeOpacity: 0.8 },
          }}
        />
      )}
    </GoogleMap>
  )
}
