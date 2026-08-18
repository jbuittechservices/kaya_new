import { useJsApiLoader } from '@react-google-maps/api'

const LIBRARIES = ['places']

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
export const hasGoogleMaps = Boolean(GOOGLE_MAPS_API_KEY)

// Default map center: Lagos, Nigeria
export const DEFAULT_CENTER = { lat: 6.5244, lng: 3.3792 }

export function useGoogleMaps() {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'kaya-google-maps',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  })
  // Never attempt to load without a key — useJsApiLoader would otherwise throw
  return hasGoogleMaps ? { isLoaded, loadError } : { isLoaded: false, loadError: null }
}

export const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#F4F6F8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#0A0A0A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F4F6F8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#E3F6FF' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]
