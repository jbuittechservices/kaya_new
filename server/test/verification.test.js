import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startTestServer, stopTestServer, request, loginAs, signUp, SEEDED } from './support/helpers.js'

let admin, customer, driver

before(async () => {
  await startTestServer()
  admin = await loginAs(SEEDED.admin.phone, SEEDED.admin.password)
  customer = await loginAs(SEEDED.customer.phone, SEEDED.customer.password)
  driver = await loginAs(SEEDED.driver.phone, SEEDED.driver.password)
})

after(() => stopTestServer())

async function createOrder(body = {}) {
  const { body: res } = await request('POST', '/api/orders', {
    token: customer.token,
    body: { pickup: 'A', dropoff: 'B', category: 'parcel', vehicle: 'bike', paymentMethod: 'cash', ...body },
  })
  return res.order.id
}

test('a freshly signed-up driver starts unverified', async () => {
  const fresh = await signUp({ phone: '+2348055500001', name: 'Fresh Driver', role: 'driver' })
  assert.equal(fresh.user.onboarding.personalInfo, true, 'personalInfo is self-attested at signup')
  assert.equal(fresh.user.onboarding.documents, false)
  assert.equal(fresh.user.onboarding.guarantor, false)
})

test('REGRESSION: an unverified driver cannot accept an order, even one they can see', async () => {
  const fresh = await signUp({ phone: '+2348055500002', name: 'Fresh Driver 2', role: 'driver' })
  const orderId = await createOrder()

  const accept = await request('POST', `/api/orders/${orderId}/accept`, { token: fresh.token })
  assert.equal(accept.status, 403)
  assert.match(accept.body.error, /not verified/i)

  // The order must still be untouched — a rejected accept attempt shouldn't have
  // partially assigned it or changed its status.
  const check = await request('GET', `/api/orders/${orderId}`, { token: customer.token })
  assert.equal(check.body.order.status, 'searching')
  assert.equal(check.body.rider, null)
})

test('REGRESSION: an unverified driver sees no available orders at all', async () => {
  const fresh = await signUp({ phone: '+2348055500003', name: 'Fresh Driver 3', role: 'driver' })
  await createOrder()

  const res = await request('GET', '/api/orders?availableOnly=true', { token: fresh.token })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.orders, [])
})

test('the onboarding checklist becomes fully verified only once ALL three steps are approved', async () => {
  const fresh = await signUp({ phone: '+2348055500004', name: 'Fresh Driver 4', role: 'driver' })
  const usersResp = await request('GET', '/api/admin/users?role=driver', { token: admin.token })
  const freshId = usersResp.body.users.find((u) => u.phone === '+2348055500004').id

  // Admin approves — this is the only path that can flip documents/guarantor to true
  const verify = await request('PATCH', `/api/admin/users/${freshId}/verify-driver`, { token: admin.token })
  assert.equal(verify.status, 200)

  const me = await request('GET', '/api/drivers/me', { token: fresh.token })
  assert.equal(me.body.user.onboarding.personalInfo, true)
  assert.equal(me.body.user.onboarding.documents, true)
  assert.equal(me.body.user.onboarding.guarantor, true)
})

test('REGRESSION: once verified, a driver can accept orders', async () => {
  const fresh = await signUp({ phone: '+2348055500005', name: 'Fresh Driver 5', role: 'driver' })
  const usersResp = await request('GET', '/api/admin/users?role=driver', { token: admin.token })
  const freshId = usersResp.body.users.find((u) => u.phone === '+2348055500005').id
  await request('PATCH', `/api/admin/users/${freshId}/verify-driver`, { token: admin.token })

  const orderId = await createOrder()
  const accept = await request('POST', `/api/orders/${orderId}/accept`, { token: fresh.token })
  assert.equal(accept.status, 200)
  assert.equal(accept.body.order.status, 'enroute')
})

test('REGRESSION: driver-to-customer rating — valid, range-checked, one per order, ownership-checked', async () => {
  const orderId = await createOrder()
  await request('POST', `/api/orders/${orderId}/accept`, { token: driver.token })
  await request('POST', `/api/orders/${orderId}/advance`, { token: driver.token })
  await request('POST', `/api/orders/${orderId}/advance`, { token: driver.token })
  const delivered = await request('POST', `/api/orders/${orderId}/advance`, { token: driver.token })
  assert.equal(delivered.body.order.status, 'delivered')
  const confirmed = await request('POST', `/api/orders/${orderId}/confirm-delivery`, { token: customer.token })
  assert.equal(confirmed.body.order.status, 'completed')

  const tooHigh = await request('POST', `/api/orders/${orderId}/rate-customer`, { token: driver.token, body: { rating: 999 } })
  assert.equal(tooHigh.status, 400)

  const customerOnly = await request('POST', `/api/orders/${orderId}/rate-customer`, { token: customer.token, body: { rating: 5 } })
  assert.equal(customerOnly.status, 403, 'only the assigned rider can rate the customer for this order')

  const valid = await request('POST', `/api/orders/${orderId}/rate-customer`, { token: driver.token, body: { rating: 4, comment: 'Easy pickup' } })
  assert.equal(valid.status, 200)
  assert.equal(valid.body.order.customerRating, 4)

  const twice = await request('POST', `/api/orders/${orderId}/rate-customer`, { token: driver.token, body: { rating: 2 } })
  assert.equal(twice.status, 409, 'a driver should not be able to rate the same customer twice for one order')
})

test('a customer cannot be rated before the delivery is actually completed', async () => {
  const orderId = await createOrder()
  await request('POST', `/api/orders/${orderId}/accept`, { token: driver.token })
  // still 'enroute' at this point — not delivered yet
  const early = await request('POST', `/api/orders/${orderId}/rate-customer`, { token: driver.token, body: { rating: 5 } })
  assert.equal(early.status, 409)
})

test('both ratings on the same order are independent — rating one direction does not affect the other', async () => {
  const orderId = await createOrder()
  await request('POST', `/api/orders/${orderId}/accept`, { token: driver.token })
  await request('POST', `/api/orders/${orderId}/advance`, { token: driver.token })
  await request('POST', `/api/orders/${orderId}/advance`, { token: driver.token })
  await request('POST', `/api/orders/${orderId}/advance`, { token: driver.token })
  await request('POST', `/api/orders/${orderId}/confirm-delivery`, { token: customer.token })

  await request('POST', `/api/orders/${orderId}/rate`, { token: customer.token, body: { rating: 5 } })
  await request('POST', `/api/orders/${orderId}/rate-customer`, { token: driver.token, body: { rating: 2 } })

  const { body } = await request('GET', `/api/orders/${orderId}`, { token: customer.token })
  assert.equal(body.order.rating, 5, "customer's rating of the rider")
  assert.equal(body.order.customerRating, 2, "rider's rating of the customer, stored separately")
})
