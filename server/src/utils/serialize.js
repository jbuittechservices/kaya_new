export function serializeUser(u) {
  if (!u) return null
  return {
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatar_url,
    status: u.status,
    walletBalance: u.wallet_balance,
    riderRating: u.rider_rating,
    riderTrips: u.rider_trips,
    riderVehicle: u.rider_vehicle,
    riderPlate: u.rider_plate,
    vehicleType: u.vehicle_type,
    customerRating: u.customer_rating,
    customerRatingCount: u.customer_rating_count,
    bankName: u.bank_name,
    bankAccountNumber: u.bank_account_number,
    bankAccountName: u.bank_account_name,
    guarantorName: u.guarantor_name,
    guarantorPhone: u.guarantor_phone,
    guarantorRelationship: u.guarantor_relationship,
    guarantorAddress: u.guarantor_address,
    documents: u.documents_json ? JSON.parse(u.documents_json) : {},
    onboarding: u.onboarding_json ? JSON.parse(u.onboarding_json) : null,
    createdAt: u.created_at,
  }
}

export function serializeOrder(o) {
  if (!o) return null
  return {
    id: o.id,
    customerId: o.customer_id,
    riderId: o.rider_id,
    status: o.status,
    pickup: o.pickup,
    dropoff: o.dropoff,
    pickupLat: o.pickup_lat,
    pickupLng: o.pickup_lng,
    dropoffLat: o.dropoff_lat,
    dropoffLng: o.dropoff_lng,
    category: o.category,
    vehicle: o.vehicle,
    price: o.price,
    paymentMethod: o.payment_method,
    note: o.note,
    senderPhone: o.sender_phone,
    recipientPhone: o.recipient_phone,
    rating: o.rating,
    ratingComment: o.rating_comment,
    customerRating: o.customer_rating,
    customerRatingComment: o.customer_rating_comment,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  }
}

export function serializeTransaction(t) {
  return {
    id: t.id,
    userId: t.user_id,
    orderId: t.order_id,
    type: t.type,
    label: t.label,
    amount: t.amount,
    reference: t.reference,
    status: t.status,
    createdAt: t.created_at,
  }
}

export function serializeLocation(l) {
  return { id: l.id, label: l.label, address: l.address, icon: l.icon, lat: l.lat, lng: l.lng }
}

export function serializeMessage(m) {
  return { id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, text: m.text, createdAt: m.created_at }
}
