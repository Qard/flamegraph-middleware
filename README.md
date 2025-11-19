# @platformatic/flamegraph-middleware

Node.js HTTP middleware for on-demand CPU and heap profiling with interactive flamegraph visualization.

## Features

- 🔥 **On-demand profiling** - Start CPU and heap profiling via HTTP request
- 📊 **Interactive flamegraphs** - Visualize profiles with WebGL-powered flamegraphs
- 🎯 **Dual profiling** - Collect both CPU and heap profiles simultaneously
- 🌐 **Framework agnostic** - Works with native `http`, Express, Fastify, and other frameworks
- ⚡ **Non-blocking** - Profiling runs in the background without blocking requests
- 💾 **In-memory storage** - Profiles stored temporarily with automatic expiration
- 🎨 **Customizable** - Configure colors, durations, and storage limits

## Installation

```bash
npm install @platformatic/flamegraph-middleware
```

## Quick Start

### With Native HTTP Server

```javascript
import http from 'http'
import { createFlamegraphMiddleware } from '@platformatic/flamegraph-middleware'

const flamegraph = createFlamegraphMiddleware()

const server = http.createServer((req, res) => {
  flamegraph(req, res, () => {
    res.writeHead(200)
    res.end('Hello World')
  })
})

server.listen(3000)
console.log('Server running at http://localhost:3000')
console.log('Profile at http://localhost:3000/flamegraph?duration=5000')
```

### With Express

```javascript
import express from 'express'
import { createFlamegraphMiddleware } from '@platformatic/flamegraph-middleware'

const app = express()

app.use(createFlamegraphMiddleware({
  basePath: '/flamegraph',
  defaultDuration: 10000
}))

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(3000)
```

### With Fastify

```javascript
import Fastify from 'fastify'
import middie from '@fastify/middie'
import { createFlamegraphMiddleware } from '@platformatic/flamegraph-middleware'

const fastify = Fastify({ logger: true })

await fastify.register(middie)
fastify.use(createFlamegraphMiddleware({
  logger: fastify.log  // Use Fastify's pino logger
}))

fastify.get('/', async (request, reply) => {
  return { hello: 'world' }
})

await fastify.listen({ port: 3000 })
```

## Usage

### Starting a Profile

Navigate to `/flamegraph?duration=10000` to start a 10-second profile:

```bash
curl http://localhost:3000/flamegraph?duration=10000
```

The page will show a "Profiling in Progress" message and automatically refresh when complete.

### Viewing Results

After profiling completes, you'll see two interactive flamegraphs:

1. **CPU Profile** - Shows where CPU time is being spent
2. **Heap Profile** - Shows memory allocation patterns

Each flamegraph is interactive:
- Click frames to zoom in
- Hover for details
- View stack traces
- Navigate hottest frames

## Configuration

```javascript
createFlamegraphMiddleware({
  basePath: '/flamegraph',        // Route prefix (default: '/flamegraph')
  maxDuration: 60000,              // Maximum profile duration in ms (default: 60000)
  defaultDuration: 10000,          // Default duration when not specified (default: 10000)
  heapSamplingInterval: 524288,    // Heap sampling interval in bytes (default: 512*1024)
  maxProfiles: 10,                 // Max profiles to keep in memory (default: 10)
  profileTTL: 300000,              // Profile expiration time in ms (default: 300000)
  colors: {
    primary: '#ff4444',            // Primary flamegraph color (default: '#ff4444')
    secondary: '#ffcc66'           // Secondary flamegraph color (default: '#ffcc66')
  },
  logger: pinoLogger               // Pino logger instance (optional, no logging if not provided)
})
```

### Logging

The middleware supports [pino](https://github.com/pinojs/pino) for structured logging. By default, if no logger is provided, the middleware will not log. You can pass your own pino logger instance to enable logging and integrate with your application's logging:

```javascript
import pino from 'pino'
import { createFlamegraphMiddleware } from '@platformatic/flamegraph-middleware'

// Custom logger configuration
const logger = pino({
  level: 'debug',
  transport: {
    target: 'pino-pretty'
  }
})

const flamegraph = createFlamegraphMiddleware({ logger })
```

#### Log Levels

The middleware logs at different levels:

- **debug** - Detailed operation logs (profile ID generation, encoding steps, retrieval attempts)
- **info** - Lifecycle events (profile requests, collection complete, storage operations)
- **warn** - Warnings (profile evictions, timing issues)
- **error** - Errors (profiling failures, encoding errors, storage issues)

All logs include structured data with relevant context like `profileId`, `duration`, `component`, etc.

## API

### `createFlamegraphMiddleware(options)`

Creates a middleware function for profiling.

**Parameters:**

- `options` (Object) - Configuration options
  - `basePath` (string) - Base URL path for the middleware
  - `maxDuration` (number) - Maximum allowed profile duration in milliseconds
  - `defaultDuration` (number) - Default profile duration when not specified
  - `heapSamplingInterval` (number) - Heap profiling sampling interval in bytes
  - `maxProfiles` (number) - Maximum number of profiles to store in memory
  - `profileTTL` (number) - Time in milliseconds before profiles expire
  - `colors` (Object) - Color customization
    - `primary` (string) - Primary color for flamegraphs (hex format)
    - `secondary` (string) - Secondary color for flamegraphs (hex format)
  - `logger` (Object) - Pino logger instance (optional, no logging if not provided)

**Returns:** `Function` - Middleware function with signature `(req, res, next)`

## Routes

### `GET /flamegraph?duration=<ms>`

Start a new profiling session.

**Query Parameters:**
- `duration` (optional) - Profile duration in milliseconds (must be ≤ maxDuration)

**Response:** HTML page showing "Profiling in Progress" with auto-refresh

### `GET /flamegraph/result/<id>`

View profiling results for a specific session.

**Response:** HTML page with interactive CPU and heap flamegraphs

## How It Works

1. **Request** - User navigates to `/flamegraph?duration=10000`
2. **Initialize** - Middleware starts CPU and heap profiling
3. **Progress** - Returns a progress page that auto-refreshes
4. **Collect** - After duration, both profiles are collected and stored
5. **Display** - Results page shows interactive flamegraphs side-by-side

## Security Considerations

⚠️ **Important:** This middleware exposes profiling capabilities that can:

- Impact application performance during profiling
- Expose internal code structure and behavior
- Consume memory to store profile data

**Recommendations:**

- **Do not expose in production** without authentication/authorization
- **Use rate limiting** to prevent abuse
- **Monitor resource usage** when profiling is active
- **Set appropriate maxDuration** to prevent excessive profiling
- **Consider IP whitelisting** for production deployments

### Example with Authentication

```javascript
import { createFlamegraphMiddleware } from '@platformatic/flamegraph-middleware'

const flamegraph = createFlamegraphMiddleware()

function requireAuth (req, res, next) {
  // Your authentication logic here
  if (!isAuthorized(req)) {
    res.writeHead(401)
    res.end('Unauthorized')
    return
  }
  next()
}

app.use('/flamegraph', requireAuth, flamegraph)
```

## Performance Impact

Profiling has minimal overhead on your application:

- **CPU profiling**: Sampling-based, ~1-2% overhead
- **Heap profiling**: Sampling-based with configurable interval
- **No impact** when not actively profiling
- **Background collection** doesn't block request handling

## Example Application

A complete TODO CRUD application example is available in the `example/` directory:

```bash
cd example
npm install
npm start
```

Visit http://localhost:3000 to:
- Create, update, and delete TODO items
- Try flamegraph profiling with a working application
- See the middleware integrated with Fastify

See [example/README.md](./example/README.md) for more details.

## Examples

### Generate a 30-second profile

```bash
curl http://localhost:3000/flamegraph?duration=30000
```

### Use default duration

```bash
curl http://localhost:3000/flamegraph
```

### Custom colors

```javascript
createFlamegraphMiddleware({
  colors: {
    primary: '#2563eb',    // Blue
    secondary: '#7dd3fc'   // Light blue
  }
})
```

## Dependencies

- [@datadog/pprof](https://www.npmjs.com/package/@datadog/pprof) - CPU and heap profiling
- [react-pprof](https://www.npmjs.com/package/react-pprof) - Flamegraph visualization
- [pino](https://www.npmjs.com/package/pino) - Fast structured logging

## Requirements

- Node.js 18 or higher
- Supported platforms: Linux, macOS, Windows (x64/arm64)

## License

Apache-2.0

## Contributing

Issues and pull requests are welcome at https://github.com/platformatic/flamegraph-middleware

## Author

Platformatic Inc. <oss@platformatic.dev> (http://platformatic.dev/)
