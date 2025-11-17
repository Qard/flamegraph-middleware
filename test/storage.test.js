import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import { ProfileStorage } from '../src/storage.js'

describe('ProfileStorage', () => {
  let storage

  beforeEach(() => {
    storage = new ProfileStorage({
      maxProfiles: 3,
      profileTTL: 1000
    })
  })

  afterEach(() => {
    storage.cleanup()
  })

  it('should generate unique IDs', () => {
    const id1 = storage.generateId()
    const id2 = storage.generateId()

    assert.ok(id1.length > 0)
    assert.ok(id2.length > 0)
    assert.notStrictEqual(id1, id2)
  })

  it('should track in-progress profiles', () => {
    const id = storage.generateId()
    const metadata = { duration: 5000 }

    storage.markInProgress(id, metadata)

    assert.strictEqual(storage.isInProgress(id), true)
    const retrieved = storage.getInProgressMetadata(id)
    assert.strictEqual(retrieved.duration, 5000)
    assert.ok(retrieved.startTime)
  })

  it('should store and retrieve profiles', () => {
    const id = storage.generateId()
    const data = { cpu: Buffer.from('cpu'), heap: Buffer.from('heap') }

    storage.storeProfile(id, data)

    const retrieved = storage.getProfile(id)
    assert.deepStrictEqual(retrieved, data)
  })

  it('should remove from in-progress when storing', () => {
    const id = storage.generateId()

    storage.markInProgress(id, { duration: 5000 })
    assert.strictEqual(storage.isInProgress(id), true)

    storage.storeProfile(id, { cpu: Buffer.from('test'), heap: Buffer.from('test') })
    assert.strictEqual(storage.isInProgress(id), false)
  })

  it('should enforce max profiles limit', () => {
    const ids = []

    // Store 4 profiles (max is 3)
    for (let i = 0; i < 4; i++) {
      const id = storage.generateId()
      ids.push(id)
      storage.storeProfile(id, { cpu: Buffer.from(`cpu${i}`), heap: Buffer.from(`heap${i}`) })
    }

    // First profile should be evicted
    assert.strictEqual(storage.getProfile(ids[0]), null)

    // Others should still exist
    assert.ok(storage.getProfile(ids[1]))
    assert.ok(storage.getProfile(ids[2]))
    assert.ok(storage.getProfile(ids[3]))
  })

  it('should expire profiles after TTL', async () => {
    const id = storage.generateId()
    storage.storeProfile(id, { cpu: Buffer.from('test'), heap: Buffer.from('test') })

    // Should exist immediately
    assert.ok(storage.getProfile(id))

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1100))

    // Should be expired
    assert.strictEqual(storage.getProfile(id), null)
  })

  it('should delete profiles manually', () => {
    const id = storage.generateId()
    storage.storeProfile(id, { cpu: Buffer.from('test'), heap: Buffer.from('test') })

    assert.ok(storage.getProfile(id))

    storage.deleteProfile(id)

    assert.strictEqual(storage.getProfile(id), null)
  })

  it('should cleanup all profiles', () => {
    const id1 = storage.generateId()
    const id2 = storage.generateId()

    storage.storeProfile(id1, { cpu: Buffer.from('test1'), heap: Buffer.from('test1') })
    storage.storeProfile(id2, { cpu: Buffer.from('test2'), heap: Buffer.from('test2') })

    storage.cleanup()

    assert.strictEqual(storage.getProfile(id1), null)
    assert.strictEqual(storage.getProfile(id2), null)
  })
})
