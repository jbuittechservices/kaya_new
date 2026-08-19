import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startTestServer, stopTestServer, request, loginAs, SEEDED } from './support/helpers.js'

let admin, customer

before(async () => {
  await startTestServer()
  admin = await loginAs(SEEDED.admin.phone, SEEDED.admin.password)
  customer = await loginAs(SEEDED.customer.phone, SEEDED.customer.password)
})

after(() => stopTestServer())

test('wrong password is rejected', async () => {
  const { status } = await request('POST', '/api/auth/login', { body: { phone: SEEDED.customer.phone, password: 'wrong-password' } })
  assert.equal(status, 401)
})

test('a request with no token is rejected', async () => {
  const { status } = await request('GET', '/api/orders')
  assert.equal(status, 401)
})

test('a request with a garbage token is rejected', async () => {
  const { status } = await request('GET', '/api/orders', { token: 'not-a-real-token' })
  assert.equal(status, 401)
})

test('REGRESSION: a suspended account is tagged with a machine-readable code so the frontend can react to it', async () => {
  const usersResp = await request('GET', '/api/admin/users?role=customer', { token: admin.token })
  const targetId = usersResp.body.users.find((u) => u.phone === SEEDED.customer.phone).id

  await request('PATCH', `/api/admin/users/${targetId}/status`, { token: admin.token, body: { status: 'suspended' } })

  // The customer's token is still cryptographically valid — it's the account status that changed.
  const { status, body } = await request('GET', '/api/orders', { token: customer.token })
  assert.equal(status, 403)
  assert.equal(body.code, 'ACCOUNT_SUSPENDED', 'suspension must carry a distinguishable code, not just a generic 403')

  // restore for any tests that run after this one
  await request('PATCH', `/api/admin/users/${targetId}/status`, { token: admin.token, body: { status: 'active' } })
})

test('a suspended account cannot log in at all', async () => {
  const usersResp = await request('GET', '/api/admin/users?role=customer', { token: admin.token })
  const targetId = usersResp.body.users.find((u) => u.phone === SEEDED.customer.phone).id
  await request('PATCH', `/api/admin/users/${targetId}/status`, { token: admin.token, body: { status: 'suspended' } })

  const { status } = await request('POST', '/api/auth/login', { body: { phone: SEEDED.customer.phone, password: SEEDED.customer.password } })
  assert.equal(status, 403)

  await request('PATCH', `/api/admin/users/${targetId}/status`, { token: admin.token, body: { status: 'active' } })
})

test('REGRESSION: requesting an OTP twice in quick succession is rate-limited with a clear cooldown message', async () => {
  const phone = '+2348088880001'
  const first = await request('POST', '/api/auth/signup/request-otp', { body: { phone } })
  assert.equal(first.status, 200)

  const second = await request('POST', '/api/auth/signup/request-otp', { body: { phone } })
  assert.equal(second.status, 429)
  assert.match(second.body.error, /wait/i)
})

test('an ordinary permission error (not your order) does not carry the suspended code', async () => {
  // Sanity check that ACCOUNT_SUSPENDED detection can't be confused with regular 403s —
  // this guards the fix that made the frontend react only to the suspension code, not
  // to any 403.
  const otherCustomerOrder = await request('POST', '/api/orders', {
    token: customer.token,
    body: { pickup: 'A', dropoff: 'B', category: 'parcel', vehicle: 'bike', paymentMethod: 'cash' },
  })
  const orderId = otherCustomerOrder.body.order.id

  const admin2 = await loginAs(SEEDED.admin.phone, SEEDED.admin.password)
  // Admin is neither the customer nor the assigned rider on this order
  const { status, body } = await request('POST', `/api/orders/${orderId}/rate`, { token: admin2.token, body: { rating: 5 } })
  assert.equal(status, 403)
  assert.equal(body.code, undefined, 'an ordinary permission error must not carry ACCOUNT_SUSPENDED')
})
