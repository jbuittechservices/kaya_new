import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startTestServer, stopTestServer, request, loginAs, SEEDED } from './support/helpers.js'

let admin, driver

before(async () => {
  await startTestServer()
  admin = await loginAs(SEEDED.admin.phone, SEEDED.admin.password)
  driver = await loginAs(SEEDED.driver.phone, SEEDED.driver.password)
})

after(() => stopTestServer())

test('REGRESSION: admin pageSize is clamped to a sane maximum, not unbounded', async () => {
  const { status, body } = await request('GET', '/api/admin/users?pageSize=999999999', { token: admin.token })
  assert.equal(status, 200)
  assert.ok(body.pageSize <= 100, `pageSize should be clamped, got ${body.pageSize}`)
})

test('REGRESSION: a negative page number clamps to page 1 instead of returning nothing', async () => {
  const { status, body } = await request('GET', '/api/admin/users?page=-5', { token: admin.token })
  assert.equal(status, 200)
  assert.equal(body.page, 1)
  assert.ok(body.users.length > 0)
})

test('admin list endpoints report a total distinct from the page size', async () => {
  const { body } = await request('GET', '/api/admin/orders?pageSize=1', { token: admin.token })
  assert.ok('total' in body, 'response should include a total count for pagination')
})

test('a non-admin cannot access admin endpoints', async () => {
  const { status } = await request('GET', '/api/admin/users', { token: driver.token })
  assert.equal(status, 403)
})

test('REGRESSION: a driver cannot self-verify documents/guarantor — only personalInfo is self-service', async () => {
  const before1 = await request('GET', '/api/drivers/me', { token: driver.token })
  const originalOnboarding = before1.body.user.onboarding

  const attempt = await request('PATCH', '/api/drivers/onboarding', {
    token: driver.token,
    body: { documents: true, guarantor: true },
  })
  assert.equal(attempt.status, 200) // request succeeds, but should silently ignore the disallowed fields
  assert.equal(attempt.body.onboarding.documents, originalOnboarding.documents, 'documents flag must not change via self-service')
  assert.equal(attempt.body.onboarding.guarantor, originalOnboarding.guarantor, 'guarantor flag must not change via self-service')

  // personalInfo remains legitimately self-service
  const legit = await request('PATCH', '/api/drivers/onboarding', { token: driver.token, body: { personalInfo: true } })
  assert.equal(legit.body.onboarding.personalInfo, true)
})

test('only an admin can grant document/guarantor verification', async () => {
  const meResp = await request('GET', '/api/drivers/me', { token: driver.token })
  const driverId = meResp.body.user.id

  const verify = await request('PATCH', `/api/admin/users/${driverId}/verify-driver`, { token: admin.token })
  assert.equal(verify.status, 200)

  const after1 = await request('GET', '/api/drivers/me', { token: driver.token })
  assert.equal(after1.body.user.onboarding.documents, true)
  assert.equal(after1.body.user.onboarding.guarantor, true)
})
