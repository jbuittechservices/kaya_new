import { Navigate, useNavigate } from 'react-router-dom'
import { useAppData } from '../../context/AppDataContext'
import DeliveryDetailsStep from './DeliveryDetailsStep'
import TrackingFlow from './TrackingFlow'

export default function Booking() {
  const { draft } = useAppData()
  const navigate = useNavigate()

  if (!draft) return <Navigate to="/app" replace />

  if (draft.phase === 'details') {
    return <DeliveryDetailsStep />
  }

  // searching, found, enroute, arrived, in_transit, completed, rated
  return <TrackingFlow onDone={() => navigate('/app')} />
}
