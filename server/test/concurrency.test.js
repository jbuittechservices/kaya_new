import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startTestServer, stopTestServer, request, loginAs, SEEDED } from './support/helpers.js'

let customer, driver

before(async () => {
  await startTestServer()
  customer = await loginAs(SEEDED.customer.phone, SEEDED.customer.password)
  driver = await loginAs(SEEDED.driver.phone, SEEDED.driver.password)
})

after(() => stopTestServer())

test('REGRESSION: N simultaneous accept requests on one order resolve to exactly 1 success', async () => {
  const created = await request('POST', '/api/orders', {
    token: customer.token,
    body: { pickup: 'A', dropoff: 'B', category: 'parcel', vehicle: 'bike', paymentMethod: 'cash' },
  })
  const orderId = created.body.order.id

  // The accept guard is keyed on the order's own status/rider_id columns, not on which
  // driver is asking — firing the same driver's token N times concurrently exercises
  // exactly the same read-check-write race window a genuinely different driver would.
  const attempts = Array.from({ length: 5 }, () => request('POST', `/api/orders/${orderId}/accept`, { token: driver.token }))
  const results = await Promise.all(attempts)
  const successes = results.filter((r) => r.status === 200).length
  const conflicts = results.filter((r) => r.status === 409).length

  assert.equal(successes, 1, 'exactly one accept should succeed')
  assert.equal(conflicts, 4, 'the other four should get a clean conflict, not corrupt state')
})

test('REGRESSION: concurrent withdrawals never overdraw the wallet', async () => {
  await request('PATCH', '/api/drivers/bank-details', {
    token: driver.token,
    body: { bankName: 'GTBank', bankAccountNumber: '0123456789', bankAccountName: 'Test Driver' },
  })

  const before1 = await request('GET', '/api/wallet', { token: driver.token })
  const startBalance = before1.body.balance
  const withdrawAmount = 500
  const affordableCount = Math.floor(startBalance / withdrawAmount)
  const attempts = Math.min(affordableCount + 6, 20) // always over-attempt relative to what's affordable

  const results = await Promise.all(
    Array.from({ length: attempts }, () => request('POST', '/api/drivers/withdraw', { token: driver.token, body: { amount: withdrawAmount } }))
  )
  const successes = results.filter((r) => r.status === 200).length

  assert.equal(successes, affordableCount, `expected exactly ${affordableCount} successful withdrawals, got ${successes}`)

  const after1 = await request('GET', '/api/wallet', { token: driver.token })
  assert.ok(after1.body.balance >= 0, `balance went negative: ${after1.body.balance}`)
  assert.equal(after1.body.balance, startBalance - successes * withdrawAmount)
})
