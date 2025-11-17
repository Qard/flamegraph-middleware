import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import http from 'node:http'
import { createFlamegraphMiddleware } from '../src/index.js'

describe('Flamegraph Middleware', () => {
  let server
  let port

  beforeEach(() => {
    return new Promise((resolve) => {
      const middleware = createFlamegraphMiddleware({
        basePath: '/flamegraph',
        defaultDuration: 100,
        maxDuration: 500
      })

      server = http.createServer((req, res) => {
        middleware(req, res, () => {
          res.writeHead(404)
          res.end('Not found')
        })
      })

      server.listen(0, () => {
        port = server.address().port
        resolve()
      })
    })
  })

  afterEach(() => {
    return new Promise((resolve) => {
      server.close(resolve)
    })
  })

  it('should respond to root path with progress page', async () => {
    const res = await makeRequest('/flamegraph?duration=100')

    assert.strictEqual(res.statusCode, 200)
    assert.ok(res.headers['content-type'].includes('text/html'))
    assert.ok(res.body.includes('Profiling in Progress'))
    assert.ok(res.body.includes('100ms'))
  })

  it('should use default duration when not specified', async () => {
    const res = await makeRequest('/flamegraph')

    assert.strictEqual(res.statusCode, 200)
    assert.ok(res.body.includes('100ms'))
  })

  it('should reject invalid duration', async () => {
    const res = await makeRequest('/flamegraph?duration=invalid')

    assert.strictEqual(res.statusCode, 400)
    assert.ok(res.body.includes('Invalid duration'))
  })

  it('should reject duration exceeding max', async () => {
    const res = await makeRequest('/flamegraph?duration=1000')

    assert.strictEqual(res.statusCode, 400)
    assert.ok(res.body.includes('exceeds maximum'))
  })

  it('should respond to result page for in-progress profile', async () => {
    // Start profiling
    const startRes = await makeRequest('/flamegraph?duration=2000')
    assert.strictEqual(startRes.statusCode, 200)

    // Extract profile ID from the HTML
    const match = startRes.body.match(/Profile ID: <code>([a-f0-9]+)<\/code>/)
    assert.ok(match, 'Should find profile ID in response')
    const profileId = match[1]

    // Request result page immediately (should show progress)
    const resultRes = await makeRequest(`/flamegraph/result/${profileId}`)
    assert.strictEqual(resultRes.statusCode, 200)
    assert.ok(resultRes.body.includes('Profiling in Progress'))
  })

  it('should respond with 404 for unknown result ID', async () => {
    const res = await makeRequest('/flamegraph/result/nonexistent123456')

    assert.strictEqual(res.statusCode, 404)
    assert.ok(res.body.includes('not found'))
  })

  it('should call next() for non-matching paths', async () => {
    const res = await makeRequest('/other-path')

    assert.strictEqual(res.statusCode, 404)
    assert.strictEqual(res.body, 'Not found')
  })

  it('should handle result page after profiling completes', async () => {
    // Start profiling with short duration
    const startRes = await makeRequest('/flamegraph?duration=100')
    const match = startRes.body.match(/Profile ID: <code>([a-f0-9]+)<\/code>/)
    const profileId = match[1]

    // Wait for profiling to complete
    await new Promise(resolve => setTimeout(resolve, 200))

    // Request result page
    const resultRes = await makeRequest(`/flamegraph/result/${profileId}`)

    // Should either show results or be processing (timing dependent)
    assert.ok(
      resultRes.statusCode === 200 || resultRes.statusCode === 202,
      'Should return 200 or 202'
    )

    if (resultRes.statusCode === 200) {
      assert.ok(
        resultRes.body.includes('Profile Results') ||
        resultRes.body.includes('Profiling in Progress'),
        'Should show either results or progress'
      )
    }
  })

  /**
   * Helper function to make HTTP requests
   */
  function makeRequest (path) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port,
        path,
        method: 'GET'
      }, (res) => {
        let body = ''
        res.on('data', chunk => { body += chunk })
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          })
        })
      })

      req.on('error', reject)
      req.end()
    })
  }
})
