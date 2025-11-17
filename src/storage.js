import crypto from 'node:crypto'

/**
 * In-memory storage for profile data with automatic expiration
 */
export class ProfileStorage {
  constructor (options = {}) {
    this.maxProfiles = options.maxProfiles || 10
    this.profileTTL = options.profileTTL || 5 * 60 * 1000 // 5 minutes default
    this.profiles = new Map()
    this.inProgress = new Map()
  }

  /**
   * Generate a unique ID for a profile session
   *
   * @returns {string} Unique profile ID
   */
  generateId () {
    return crypto.randomBytes(16).toString('hex')
  }

  /**
   * Mark a profile as in progress
   *
   * @param {string} id - Profile ID
   * @param {Object} metadata - Profile metadata (duration, startTime, etc.)
   */
  markInProgress (id, metadata) {
    this.inProgress.set(id, {
      ...metadata,
      startTime: Date.now()
    })
  }

  /**
   * Check if a profile is in progress
   *
   * @param {string} id - Profile ID
   * @returns {boolean}
   */
  isInProgress (id) {
    return this.inProgress.has(id)
  }

  /**
   * Get metadata for an in-progress profile
   *
   * @param {string} id - Profile ID
   * @returns {Object|null}
   */
  getInProgressMetadata (id) {
    return this.inProgress.get(id) || null
  }

  /**
   * Store a completed profile
   *
   * @param {string} id - Profile ID
   * @param {Object} data - Profile data (cpu and heap buffers)
   */
  storeProfile (id, data) {
    // Remove from in-progress
    this.inProgress.delete(id)

    // Enforce max profiles limit (FIFO eviction)
    if (this.profiles.size >= this.maxProfiles) {
      const oldestId = this.profiles.keys().next().value
      this.profiles.delete(oldestId)
    }

    // Store with expiration timer
    const timeout = setTimeout(() => {
      this.profiles.delete(id)
    }, this.profileTTL)

    this.profiles.set(id, {
      data,
      expiresAt: Date.now() + this.profileTTL,
      timeout
    })
  }

  /**
   * Retrieve a profile
   *
   * @param {string} id - Profile ID
   * @returns {Object|null} Profile data or null if not found
   */
  getProfile (id) {
    const entry = this.profiles.get(id)
    if (!entry) {
      return null
    }

    // Check if expired (should have been cleaned up, but double-check)
    if (Date.now() > entry.expiresAt) {
      this.profiles.delete(id)
      return null
    }

    return entry.data
  }

  /**
   * Delete a profile manually
   *
   * @param {string} id - Profile ID
   */
  deleteProfile (id) {
    const entry = this.profiles.get(id)
    if (entry && entry.timeout) {
      clearTimeout(entry.timeout)
    }
    this.profiles.delete(id)
  }

  /**
   * Clean up all profiles and timers
   */
  cleanup () {
    // Clear all timeouts
    for (const entry of this.profiles.values()) {
      if (entry.timeout) {
        clearTimeout(entry.timeout)
      }
    }

    this.profiles.clear()
    this.inProgress.clear()
  }
}
