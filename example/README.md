# Flamegraph Middleware Example

A simple TODO CRUD application built with Fastify that demonstrates the flamegraph middleware in action.

## Features

- ✅ Full CRUD operations for TODOs
- 🔥 Integrated flamegraph profiling
- 🎨 Clean, modern UI
- 📊 Real-time performance profiling

## Installation

```bash
npm install
```

## Running the Example

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

The server will start on http://localhost:3000

## Usage

### Web Interface

Visit http://localhost:3000 to:
- Create, read, update, and delete TODO items
- Start flamegraph profiling sessions
- View interactive CPU and heap profiles

### API Endpoints

**TODO Operations:**
- `GET /api/todos` - List all todos
- `GET /api/todos/:id` - Get a specific todo
- `POST /api/todos` - Create a new todo
  ```json
  { "title": "My todo", "completed": false }
  ```
- `PUT /api/todos/:id` - Update a todo
  ```json
  { "title": "Updated title", "completed": true }
  ```
- `DELETE /api/todos/:id` - Delete a todo

**Profiling:**
- `GET /flamegraph?duration=5000` - Start a 5-second profile

### Example cURL Commands

```bash
# List all todos
curl http://localhost:3000/api/todos

# Create a new todo
curl -X POST http://localhost:3000/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Learn flamegraph profiling"}'

# Update a todo
curl -X PUT http://localhost:3000/api/todos/1 \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# Delete a todo
curl -X DELETE http://localhost:3000/api/todos/1

# Start profiling
curl http://localhost:3000/flamegraph?duration=10000
```

## Profiling Tips

1. **Generate Load**: Create, update, and delete several TODOs while profiling to see activity in the flamegraphs

2. **Try Different Durations**:
   - Quick profile: `?duration=3000` (3 seconds)
   - Standard: `?duration=5000` (5 seconds)
   - Detailed: `?duration=15000` (15 seconds)

3. **Interpret Results**:
   - **CPU Profile**: Shows where your code is spending CPU time
   - **Heap Profile**: Shows memory allocation patterns
   - Click on frames to zoom in
   - Hover for detailed information

## Architecture

The example demonstrates:
- Fastify web framework
- @fastify/middie for middleware support
- In-memory data store (Map)
- RESTful API design
- Single-page application with vanilla JavaScript
- Integration of flamegraph middleware

## Notes

- Data is stored in-memory and will be lost on server restart
- The middleware runs alongside your application with minimal overhead
- Profiling only impacts performance during active profiling sessions
