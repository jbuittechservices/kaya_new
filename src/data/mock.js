export const PACKAGE_CATEGORIES = [
  { id: 'document', label: 'Document', desc: 'Letters, files, papers' },
  { id: 'parcel', label: 'Parcel', desc: 'Small boxes & bags' },
  { id: 'food', label: 'Food', desc: 'Meals & groceries' },
  { id: 'electronics', label: 'Electronics', desc: 'Gadgets, fragile items' },
  { id: 'fashion', label: 'Fashion', desc: 'Clothing & accessories' },
  { id: 'other', label: 'Other', desc: 'Anything else' },
]

export const VEHICLE_OPTIONS = [
  { id: 'bike', label: 'Bike', eta: '3–8 min', price: 1200, desc: 'Fast, for small packages', capacity: 'Up to 5kg' },
  { id: 'car', label: 'Car', eta: '6–12 min', price: 2400, desc: 'Bigger loads, AC comfort', capacity: 'Up to 30kg' },
  { id: 'van', label: 'Van', eta: '12–20 min', price: 5600, desc: 'Bulk & business deliveries', capacity: 'Up to 200kg' },
]

export const QUICK_TOPUP_AMOUNTS = [1000, 2500, 5000, 10000]

// Must match PLATFORM_FEE_PCT in server/src/routes/orders.js
export const PLATFORM_FEE_PCT = 0.15
