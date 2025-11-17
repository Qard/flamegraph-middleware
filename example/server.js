import Fastify from 'fastify'
import middie from '@fastify/middie'
import { createFlamegraphMiddleware } from '../src/index.js'

// In-memory TODO store
const todos = new Map()
let nextId = 1

// Initialize with some sample data
todos.set(1, { id: 1, title: 'Learn Fastify', completed: false, createdAt: new Date().toISOString() })
todos.set(2, { id: 2, title: 'Try flamegraph profiling', completed: false, createdAt: new Date().toISOString() })
todos.set(3, { id: 3, title: 'Build awesome apps', completed: false, createdAt: new Date().toISOString() })
nextId = 4

// Create Fastify instance
const fastify = Fastify({
  logger: true
})

// Register middie for Express-style middleware support
await fastify.register(middie)

// Add flamegraph middleware
fastify.use(createFlamegraphMiddleware({
  basePath: '/flamegraph',
  defaultDuration: 5000,
  maxDuration: 30000,
  colors: {
    primary: '#ff4444',
    secondary: '#ffcc66'
  }
}))

// Root route with instructions
fastify.get('/', async (request, reply) => {
  return reply.type('text/html').send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TODO App with Flamegraph Profiling</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 0 20px;
      background-color: #f5f5f5;
    }
    h1 { color: #333; }
    .section {
      background: white;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .todo-form {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    .todo-form input {
      flex: 1;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }
    .todo-form button {
      padding: 10px 20px;
      background-color: #ff4444;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .todo-form button:hover {
      background-color: #cc3333;
    }
    .todo-item {
      display: flex;
      align-items: center;
      padding: 12px;
      margin: 8px 0;
      background: #f9f9f9;
      border-radius: 4px;
      border-left: 3px solid #ff4444;
    }
    .todo-item.completed {
      opacity: 0.6;
      border-left-color: #4caf50;
    }
    .todo-item input[type="checkbox"] {
      margin-right: 12px;
      width: 18px;
      height: 18px;
    }
    .todo-item .title {
      flex: 1;
      font-size: 14px;
    }
    .todo-item.completed .title {
      text-decoration: line-through;
    }
    .todo-item button {
      padding: 6px 12px;
      background-color: #ff4444;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .todo-item button:hover {
      background-color: #cc3333;
    }
    .flamegraph-link {
      display: inline-block;
      padding: 12px 24px;
      background-color: #2563eb;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 500;
    }
    .flamegraph-link:hover {
      background-color: #1d4ed8;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
    }
    .api-list {
      list-style: none;
      padding: 0;
    }
    .api-list li {
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .api-list li:last-child {
      border-bottom: none;
    }
    .method {
      display: inline-block;
      padding: 2px 8px;
      background: #ff4444;
      color: white;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
      margin-right: 8px;
    }
    .method.get { background: #4caf50; }
    .method.post { background: #2196f3; }
    .method.put { background: #ff9800; }
    .method.delete { background: #f44336; }
  </style>
</head>
<body>
  <h1>🔥 TODO App with Flamegraph Profiling</h1>

  <div class="section">
    <h2>📝 TODO List</h2>
    <div class="todo-form">
      <input type="text" id="todoInput" placeholder="What needs to be done?" />
      <button onclick="addTodo()">Add TODO</button>
    </div>
    <div id="todoList"></div>
  </div>

  <div class="section">
    <h2>🔥 Flamegraph Profiling</h2>
    <p>Profile your application's performance in real-time:</p>
    <a href="/flamegraph?duration=5000" class="flamegraph-link" target="_blank">
      Start 5-second Profile
    </a>
    <p style="margin-top: 20px; font-size: 14px; color: #666;">
      This will collect CPU and heap profiles for 5 seconds and display interactive flamegraphs.
    </p>
  </div>

  <div class="section">
    <h2>🚀 API Endpoints</h2>
    <ul class="api-list">
      <li><span class="method get">GET</span><code>/api/todos</code> - Get all todos</li>
      <li><span class="method get">GET</span><code>/api/todos/:id</code> - Get a specific todo</li>
      <li><span class="method post">POST</span><code>/api/todos</code> - Create a new todo</li>
      <li><span class="method put">PUT</span><code>/api/todos/:id</code> - Update a todo</li>
      <li><span class="method delete">DELETE</span><code>/api/todos/:id</code> - Delete a todo</li>
      <li><span class="method get">GET</span><code>/flamegraph?duration=30s</code> - Start profiling (supports "30s", "5m", or milliseconds)</li>
    </ul>
  </div>

  <script>
    // Fetch and render todos
    async function loadTodos() {
      const response = await fetch('/api/todos')
      const todos = await response.json()

      const list = document.getElementById('todoList')
      list.innerHTML = todos.map(todo => \`
        <div class="todo-item \${todo.completed ? 'completed' : ''}">
          <input
            type="checkbox"
            \${todo.completed ? 'checked' : ''}
            onchange="toggleTodo(\${todo.id})"
          />
          <span class="title">\${todo.title}</span>
          <button onclick="deleteTodo(\${todo.id})">Delete</button>
        </div>
      \`).join('')
    }

    // Add a new todo
    async function addTodo() {
      const input = document.getElementById('todoInput')
      const title = input.value.trim()

      if (!title) return

      await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      })

      input.value = ''
      loadTodos()
    }

    // Toggle todo completion
    async function toggleTodo(id) {
      const response = await fetch(\`/api/todos/\${id}\`)
      const todo = await response.json()

      await fetch(\`/api/todos/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !todo.completed })
      })

      loadTodos()
    }

    // Delete a todo
    async function deleteTodo(id) {
      await fetch(\`/api/todos/\${id}\`, { method: 'DELETE' })
      loadTodos()
    }

    // Allow Enter key to add todo
    document.getElementById('todoInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addTodo()
    })

    // Load todos on page load
    loadTodos()
  </script>
</body>
</html>
  `)
})

// GET /api/todos - List all todos
fastify.get('/api/todos', async (request, reply) => {
  const todoList = Array.from(todos.values()).sort((a, b) => a.id - b.id)
  return todoList
})

// GET /api/todos/:id - Get a specific todo
fastify.get('/api/todos/:id', async (request, reply) => {
  const id = parseInt(request.params.id)
  const todo = todos.get(id)

  if (!todo) {
    return reply.code(404).send({ error: 'Todo not found' })
  }

  return todo
})

// POST /api/todos - Create a new todo
fastify.post('/api/todos', async (request, reply) => {
  const { title, completed = false } = request.body

  if (!title || typeof title !== 'string') {
    return reply.code(400).send({ error: 'Title is required and must be a string' })
  }

  const todo = {
    id: nextId++,
    title: title.trim(),
    completed: Boolean(completed),
    createdAt: new Date().toISOString()
  }

  todos.set(todo.id, todo)

  return reply.code(201).send(todo)
})

// PUT /api/todos/:id - Update a todo
fastify.put('/api/todos/:id', async (request, reply) => {
  const id = parseInt(request.params.id)
  const todo = todos.get(id)

  if (!todo) {
    return reply.code(404).send({ error: 'Todo not found' })
  }

  const { title, completed } = request.body

  if (title !== undefined) {
    if (typeof title !== 'string') {
      return reply.code(400).send({ error: 'Title must be a string' })
    }
    todo.title = title.trim()
  }

  if (completed !== undefined) {
    todo.completed = Boolean(completed)
  }

  todo.updatedAt = new Date().toISOString()
  todos.set(id, todo)

  return todo
})

// DELETE /api/todos/:id - Delete a todo
fastify.delete('/api/todos/:id', async (request, reply) => {
  const id = parseInt(request.params.id)

  if (!todos.has(id)) {
    return reply.code(404).send({ error: 'Todo not found' })
  }

  todos.delete(id)

  return reply.code(204).send()
})

// Start the server
try {
  await fastify.listen({ port: 3000, host: '0.0.0.0' })
  console.log('🚀 Server is running on http://localhost:3000')
  console.log('📝 TODO app available at http://localhost:3000')
  console.log('🔥 Flamegraph profiling at http://localhost:3000/flamegraph?duration=5s')
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
