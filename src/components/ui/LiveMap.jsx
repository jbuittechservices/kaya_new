import { useEffect, useMemo, useState } from 'react'
import { GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api'
import { hasGoogleMaps, useGoogleMaps, DEFAULT_CENTER, MAP_STYLES } from '../../lib/googleMaps'
import MapBackdrop from './MapBackdrop'

/**
 * Renders a live Google Map with pickup/dropoff markers and the driving route
 * between them. Rider position is shown from, in priority order:
 *  1. `liveMarker` — a real {lat,lng} reported by the driver's device over Socket.IO
 *  2. `progress` (0–1) — a simulated position interpolated along the route, used
 *     as a fallback until the driver app has reported a real GPS fix
 *
 * Falls back to the illustrated MapBackdrop when no Google Maps API key is
 * configured, or when we don't have coordinates to plot yet.
 */
export default function LiveMap({ pickup, dropoff, progress, liveMarker, className = '', children }) {
  const { isLoaded } = useGoogleMaps()
  const [directions, setDirections] = useState(null)

  const hasPickup = pickup?.lat != null && pickup?.lng != null
  const hasDropoff = dropoff?.lat != null && dropoff?.lng != null
  const hasLiveMarker = liveMarker?.lat != null && liveMarker?.lng != null

  useEffect(() => {
    setDirections(null)
    if (!isLoaded || !hasPickup || !hasDropoff || !window.google) return
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
  }, [isLoaded, hasPickup, hasDropoff, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng])

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

  if (!hasGoogleMaps || !isLoaded) {
    return <MapBackdrop className={className}>{children}</MapBackdrop>
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={hasPickup && hasDropoff ? 12 : 14}
        options={{
          styles: MAP_STYLES,
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: 'none',
          keyboardShortcuts: false,
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
      {children}
    </div>
  )
}
