import { parse as parseUrl } from 'node:url'
import parseDuration from 'parse-duration'
import { Profiler } from './profiler.js'
import { ProfileStorage } from './storage.js'
import {
  generateProgressPage,
  generateResultsPage,
  generateErrorPage
} from './html-generator.js'

/**
 * Create a flamegraph middleware instance
 *
 * @param {Object} options - Configuration options
 * @param {string} options.basePath - Base path for the middleware (default: '/flamegraph')
 * @param {number} options.maxDuration - Maximum profile duration in ms (default: 60000)
 * @param {number} options.defaultDuration - Default profile duration in ms (default: 10000)
 * @param {number} options.heapSamplingInterval - Heap sampling interval in bytes (default: 512*1024)
 * @param {number} options.maxProfiles - Maximum number of profiles to keep in memory (default: 10)
 * @param {number} options.profileTTL - Profile expiration time in ms (default: 300000)
 * @param {Object} options.colors - Color configuration
 * @param {string} options.colors.primary - Primary color (default: '#ff4444')
 * @param {string} options.colors.secondary - Secondary color (default: '#ffcc66')
 * @returns {Function} Middleware function
 */
export function createFlamegraphMiddleware (options = {}) {
  const {
    basePath = '/flamegraph',
    maxDuration = 60000,
    defaultDuration = 10000,
    heapSamplingInterval = 512 * 1024,
    maxProfiles = 10,
    profileTTL = 5 * 60 * 1000,
    colors = {}
  } = options

  const primaryColor = colors.primary || '#ff4444'
  const secondaryColor = colors.secondary || '#ffcc66'

  // Initialize profiler and storage
  const profiler = new Profiler({ heapSamplingInterval })
  const storage = new ProfileStorage({ maxProfiles, profileTTL })

  // Start heap profiling once
  profiler.startHeapProfiling()

  /**
   * Middleware function
   */
  return function flamegraphMiddleware (req, res, next) {
    // Parse URL
    const parsedUrl = parseUrl(req.url, true)
    const pathname = parsedUrl.pathname

    // Check if this request is for our middleware
    if (!pathname.startsWith(basePath)) {
      return next()
    }

    // Extract the path after basePath
    const subPath = pathname.slice(basePath.length) || '/'

    // Handle start profiling request
    if (subPath === '/' || subPath === '') {
      return handleStartProfiling(req, res, parsedUrl.query)
    }

    // Handle result page request
    const resultMatch = subPath.match(/^\/result\/([a-f0-9]+)$/)
    if (resultMatch) {
      const profileId = resultMatch[1]
      return handleResultPage(req, res, profileId)
    }

    // Unknown path
    return sendError(res, 'Not found', 404)
  }

  /**
   * Handle profiling start request
   */
  async function handleStartProfiling (req, res, query) {
    try {
      // Parse duration from query string
      let duration
      if (query.duration) {
        // Try parsing as human-readable duration first (e.g., "30s", "5m")
        duration = parseDuration(query.duration)

        // If parse-duration returns null, try as raw number
        if (duration === null) {
          duration = parseInt(query.duration, 10)
          if (isNaN(duration)) {
            return sendError(res, 'Invalid duration parameter. Use a number in milliseconds or human-readable format like "30s", "5m".', 400)
          }
        }
      } else {
        duration = defaultDuration
      }

      // Validate duration
      if (duration <= 0) {
        return sendError(res, 'Duration must be greater than 0', 400)
      }

      if (duration > maxDuration) {
        return sendError(res, `Duration exceeds maximum allowed (${maxDuration}ms)`, 400)
      }

      // Generate unique profile ID
      const profileId = storage.generateId()

      // Mark profile as in progress
      storage.markInProgress(profileId, { duration })

      // Start profiling in background (don't await)
      collectProfilesInBackground(profileId, duration)

      // Send progress page immediately
      const html = generateProgressPage(profileId, duration, basePath)
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(html)
      })
      res.end(html)
    } catch (error) {
      console.error('Error starting profiling:', error)
      return sendError(res, 'Failed to start profiling', 500)
    }
  }

  /**
   * Handle result page request
   */
  async function handleResultPage (req, res, profileId) {
    try {
      // Check if profile is still in progress
      if (storage.isInProgress(profileId)) {
        const metadata = storage.getInProgressMetadata(profileId)
        const elapsed = Date.now() - metadata.startTime
        const remaining = Math.max(0, metadata.duration - elapsed)

        // If still profiling, show progress page again
        if (remaining > 0) {
          const html = generateProgressPage(profileId, remaining, basePath)
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': Buffer.byteLength(html)
          })
          return res.end(html)
        }

        // Profile should be done but not yet stored, wait a bit
        return sendError(res, 'Profile is being processed. Please refresh in a moment.', 202)
      }

      // Get completed profile
      const profileData = storage.getProfile(profileId)

      if (!profileData) {
        return sendError(res, 'Profile not found or expired', 404)
      }

      // Generate results page
      const html = await generateResultsPage(
        profileData.cpu,
        profileData.heap,
        { primaryColor, secondaryColor }
      )

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(html)
      })
      res.end(html)
    } catch (error) {
      console.error('Error handling result page:', error)
      return sendError(res, 'Failed to generate results page', 500)
    }
  }

  /**
   * Collect profiles in the background
   */
  async function collectProfilesInBackground (profileId, duration) {
    try {
      // Collect both profiles
      const profiles = await profiler.collectProfiles(duration)

      // Encode profiles to buffers
      const [cpuBuffer, heapBuffer] = await Promise.all([
        profiler.encodeProfile(profiles.cpu),
        profiler.encodeProfile(profiles.heap)
      ])

      // Store the encoded profiles
      storage.storeProfile(profileId, {
        cpu: cpuBuffer,
        heap: heapBuffer
      })
    } catch (error) {
      console.error(`Error collecting profiles for ${profileId}:`, error)
      // Profile will remain in progress and eventually time out
    }
  }

  /**
   * Send an error response
   */
  function sendError (res, message, statusCode = 500) {
    const html = generateErrorPage(message, statusCode)
    res.writeHead(statusCode, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(html)
    })
    res.end(html)
  }
}

/**
 * Default export
 */
export default createFlamegraphMiddleware
