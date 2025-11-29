import pprof from '@datadog/pprof'

/**
 * Profiler class for managing CPU and heap profiling
 */
export class Profiler {
  constructor (options = {}) {
    this.heapSamplingInterval = options.heapSamplingInterval || 512 * 1024
    this.heapStackDepth = options.heapStackDepth || 64
    this.heapStarted = false
    this.logger = options.logger?.child({ component: 'profiler' }) || options.logger
  }

  /**
   * Initialize heap profiling (only needs to be called once)
   */
  startHeapProfiling () {
    if (!this.heapStarted) {
      pprof.heap.start(this.heapSamplingInterval, this.heapStackDepth)
      this.heapStarted = true
      this.logger?.debug(
        { heapSamplingInterval: this.heapSamplingInterval, heapStackDepth: this.heapStackDepth },
        'Heap profiling initialized'
      )
    }
  }

  /**
   * Stop heap profiling
   */
  stopHeapProfiling () {
    if (this.heapStarted) {
      pprof.heap.stop()
      this.heapStarted = false
      this.logger?.debug('Heap profiling stopped')
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
    this.logger?.debug({ duration, type: 'cpu' }, 'Starting CPU profile collection')
    const profile = await pprof.time.profile({ durationMillis: duration })
    this.logger?.info({ type: 'cpu', duration }, 'CPU profile collected successfully')
    return profile
  }

  /**
   * Collect a heap profile (waits for duration then samples)
   *
   * @param {number} duration - Duration in milliseconds (for consistency with CPU profiling)
   * @returns {Promise<Profile>}
   */
  async collectHeapProfile (duration) {
    this.logger?.debug({ duration, type: 'heap' }, 'Starting heap profile collection')
    // Wait for the same duration as CPU profiling for consistency
    await new Promise(resolve => setTimeout(resolve, duration))
    const profile = await pprof.heap.profile()
    this.logger?.info({ type: 'heap', duration }, 'Heap profile collected successfully')
    return profile
  }

  /**
   * Encode a profile to binary format (uncompressed protobuf)
   *
   * @param {Profile} profile - Profile object from pprof
   * @returns {Promise<Buffer>}
   */
  async encodeProfile (profile) {
    this.logger?.debug('Starting profile encoding')
    // Use the profile's own encode() method to get uncompressed protobuf data
    // instead of pprof.encode() which returns gzipped data
    const encoded = await profile.encode()
    const buffer = Buffer.from(encoded)
    this.logger?.debug({ size: buffer.length }, 'Profile encoded successfully')
    return buffer
  }
}
