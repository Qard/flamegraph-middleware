import pprof from '@datadog/pprof'

/**
 * Profiler class for managing CPU and heap profiling
 */
export class Profiler {
  constructor (options = {}) {
    this.heapSamplingInterval = options.heapSamplingInterval || 512 * 1024
    this.heapStackDepth = options.heapStackDepth || 64
    this.heapStarted = false
  }

  /**
   * Initialize heap profiling (only needs to be called once)
   */
  startHeapProfiling () {
    if (!this.heapStarted) {
      pprof.heap.start(this.heapSamplingInterval, this.heapStackDepth)
      this.heapStarted = true
    }
  }

  /**
   * Collect both CPU and heap profiles concurrently
   *
   * @param {number} duration - Duration in milliseconds
   * @returns {Promise<{cpu: Profile, heap: Profile}>}
   */
  async collectProfiles (duration) {
    // Ensure heap profiling is started
    this.startHeapProfiling()

    // Collect both profiles concurrently
    const [cpuProfile, heapProfile] = await Promise.all([
      this.collectCPUProfile(duration),
      this.collectHeapProfile(duration)
    ])

    return {
      cpu: cpuProfile,
      heap: heapProfile
    }
  }

  /**
   * Collect a CPU profile
   *
   * @param {number} duration - Duration in milliseconds
   * @returns {Promise<Profile>}
   */
  async collectCPUProfile (duration) {
    return await pprof.time.profile({ durationMillis: duration })
  }

  /**
   * Collect a heap profile (waits for duration then samples)
   *
   * @param {number} duration - Duration in milliseconds (for consistency with CPU profiling)
   * @returns {Promise<Profile>}
   */
  async collectHeapProfile (duration) {
    // Wait for the same duration as CPU profiling for consistency
    await new Promise(resolve => setTimeout(resolve, duration))
    return await pprof.heap.profile()
  }

  /**
   * Encode a profile to binary format (uncompressed protobuf)
   *
   * @param {Profile} profile - Profile object from pprof
   * @returns {Promise<Buffer>}
   */
  async encodeProfile (profile) {
    // Use the profile's own encode() method to get uncompressed protobuf data
    // instead of pprof.encode() which returns gzipped data
    const encoded = await profile.encode()
    return Buffer.from(encoded)
  }
}
