# mock-endpoint-runner

[![Test Suite](https://github.com/slopggobblercobbler81/mock-endpoint-runner/actions/workflows/test.yml/badge.svg)](https://github.com/slopggobblercobbler81/mock-endpoint-runner/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)

> **A lightweight, zero-dependency local HTTP API mock server and fixture generator for frontend and integration testing.**

Spin up realistic, stateful, and scriptable mock APIs in milliseconds without installing megabytes of node dependencies. Perfect for local frontend development, Playwright / Cypress end-to-end tests, CI environments, and edge case reproduction.

---

## ✨ Features

- ⚡ **Zero External Dependencies**: Powered entirely by Node.js built-ins. Starts in `< 20ms`.
- 📁 **JSON, YAML, & JavaScript**: Load configs from standard `.json`, `.yaml`, `.yml`, or scriptable `.js` files and directories.
- 🎭 **Built-in Fixture Generator & Faker**: Generate realistic users, products, emails, UUIDs, addresses, and dates without external libraries.
- 🧩 **Dynamic Template Interpolation**: Inject route parameters, query strings, headers, and fake data using `{{params.id}}`, `{{query.q}}`, or `{{faker.name}}`.
- 🔄 **Instant In-Memory REST CRUD**: One line generates complete RESTful endpoints (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) with search, filter, and pagination.
- ⏱️ **Latency & Chaos Engineering**: Simulate real-world network lag (`delay: [100, 500]`) and flaky network conditions (`errorRate: 0.15`).
- 🔍 **Live Request Inspector & Replay**: Inspect captured requests and reset fixtures between test runs via `/__mock/requests` and `POST /__mock/reset`.
- 🌐 **First-Class CORS**: Out-of-the-box support for browser cross-origin requests and preflight `OPTIONS`.
- 💻 **CLI & Programmatic API**: Use via terminal command line or embed directly into your Vitest, Jest, Playwright, or Node test suites.
- 🔄 **Live Watch Mode**: Automatically reloads mock definitions on file changes (`--watch`).

---

## 🚀 Quick Start

### 1. Run instantly with npx

```bash
# Initialize a sample mocks.json
npx mock-endpoint-runner init

# Start the mock server
npx mock-endpoint-runner serve mocks.json
```

### 2. Global or local installation

```bash
# Global
npm install -g mock-endpoint-runner

# Or as a project devDependency
npm install --save-dev mock-endpoint-runner
```

---

## 📖 CLI Usage

```text
Usage:
  mock-endpoint-runner <command> [options]

Commands:
  serve [file|dir]       Start the mock HTTP server (default: mocks.json or ./mocks)
  generate <type>        Generate realistic JSON fixtures (user, product, post, order, etc.)
  validate [file]        Validate endpoint configuration file syntax and paths
  init [dir]             Scaffold an example mocks.json configuration
  help                   Show help message
  version                Show version

Options for 'serve':
  -p, --port <port>      Server port (default: 3000 or $PORT)
  -H, --host <host>      Server host (default: 0.0.0.0)
  -d, --delay <ms>       Artificial global response delay in milliseconds
  --prefix <prefix>      Global route prefix (e.g. /api/v1)
  --no-cors              Disable CORS response headers
  -w, --watch            Watch configuration file/dir and reload on change
  -q, --quiet            Silence per-request access logs

Options for 'generate':
  -c, --count <num>      Number of items to generate (default: 10)
  -o, --output <file>    Output JSON file path (default: stdout)
  -s, --seed <num>       Seed number for reproducible pseudo-random data
```

---

## 🛠 Configuration Guide

### JSON Configuration Example (`mocks.json`)

```json
{
  "prefix": "/api",
  "globalDelay": 50,
  "routes": [
    {
      "method": "GET",
      "path": "/users/:id",
      "status": 200,
      "response": {
        "id": "{{params.id}}",
        "name": "{{faker.name}}",
        "email": "{{faker.email}}",
        "avatar": "{{faker.avatar}}",
        "role": "admin"
      }
    },
    {
      "method": "POST",
      "path": "/auth/login",
      "status": 200,
      "response": {
        "token": "bearer_{{faker.uuid}}",
        "username": "{{body.username}}"
      }
    },
    {
      "method": "GET",
      "path": "/payment/flaky",
      "errorRate": 0.3,
      "errorStatus": 503,
      "errorResponse": { "error": "Gateway timeout" },
      "response": { "status": "success", "chargeId": "ch_{{faker.uuid}}" }
    }
  ],
  "resources": [
    {
      "name": "posts",
      "path": "/posts",
      "generate": {
        "schema": "post",
        "count": 10
      }
    }
  ]
}
```

### YAML Configuration Example (`endpoints.yaml`)

```yaml
prefix: /v1
routes:
  - method: GET
    path: /status
    response:
      online: true
      version: 1.0.0
      timestamp: "{{timestamp}}"
  - method: GET
    path: /products/:id
    response:
      id: "{{params.id}}"
      price: "{{faker.float(10, 500, 2)}}"
      inStock: "{{faker.boolean}}"
resources:
  - name: users
    path: /users
    count: 5
```

---

## 📦 Automatic REST CRUD Resources

Declaring a resource gives you an instant, in-memory stateful REST collection:

```json
{
  "resources": [
    {
      "name": "products",
      "path": "/api/products",
      "count": 10
    }
  ]
}
```

This immediately registers:
- `GET /api/products`: List items with query support:
  - `?limit=10&offset=20` or `?page=2&pageSize=10`
  - `?q=keyboard` (full-text search across properties)
  - `?category=electronics` (field filtering)
  - `?sort=price&order=desc`
- `GET /api/products/:id`: Fetch item by ID
- `POST /api/products`: Create a new item (auto-assigns ID & timestamps)
- `PUT /api/products/:id`: Replace item
- `PATCH /api/products/:id`: Update item properties
- `DELETE /api/products/:id`: Remove item

State is preserved across requests until reset or restarted!

---

## 🎯 Response Templating & Built-in Faker

You can use dynamic placeholders anywhere inside your mock responses:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `{{params.<name>}}` | Route path parameter | `{{params.id}}` |
| `{{query.<name>}}` | URL query parameter | `{{query.search}}` |
| `{{body.<name>}}` | Request body field | `{{body.email}}` |
| `{{headers.<name>}}` | Request header | `{{headers['x-api-key']}}` |
| `{{timestamp}}` | Current UNIX timestamp (ms) | `1740000000000` |
| `{{isoDate}}` | ISO 8601 timestamp string | `2026-10-20T05:00:00.000Z` |
| `{{faker.uuid}}` | RFC 4122 v4 UUID | `e3b0c442-98fc-1c14-9afb-4c7b8019b161` |
| `{{faker.name}}` | Realistic full name | `Morgan Smith` |
| `{{faker.email}}` | Realistic email address | `morgan.smith42@example.com` |
| `{{faker.integer(min, max)}}` | Random integer | `{{faker.integer(10, 50)}}` |
| `{{faker.float(min, max, dec)}}`| Random float | `{{faker.float(9.99, 99.99, 2)}}` |
| `{{faker.boolean}}` | Random boolean (`true` or `false`) | `true` |
| `{{faker.phone}}` | Phone number | `+1-555-234-5678` |
| `{{faker.company}}` | Company name | `Acme Corp` |
| `{{faker.city}}` | City | `San Francisco` |
| `{{faker.sentence}}` | Lorem sentence | `Lorem ipsum dolor sit amet.` |

---

## 🧪 Integration Testing Inspector Endpoints

During end-to-end integration tests, `mock-endpoint-runner` exposes built-in management routes:

### 1. Inspect Past Requests
```http
GET /__mock/requests
```
Returns an array of all requests received by the mock server (timestamp, method, path, query, headers, payload body, and response duration).

### 2. Reset Mock State
```http
POST /__mock/reset
```
Clears the request history log and resets all CRUD resources back to their initial fixture data.

### 3. Dynamic Route Overrides
```http
POST /__mock/override
Content-Type: application/json

{
  "method": "GET",
  "path": "/api/users/custom",
  "response": { "overridden": true }
}
```

---

## 💻 Programmatic Usage (Vitest / Playwright / Jest)

Embed `mock-endpoint-runner` directly inside your test suite:

```javascript
import { test, beforeAll, afterAll, beforeEach } from 'vitest';
import { createMockServer } from 'mock-endpoint-runner';

let server;

beforeAll(async () => {
  server = createMockServer({
    routes: [
      {
        method: 'POST',
        path: '/api/checkout',
        status: 200,
        response: { status: 'confirmed', orderId: '{{faker.uuid}}' }
      }
    ]
  });

  await server.listen(4000);
});

beforeEach(async () => {
  server.reset(); // Clears logs and restores initial state
});

afterAll(async () => {
  await server.close();
});

test('submits order successfully', async () => {
  const response = await fetch('http://localhost:4000/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: ['item_1', 'item_2'] })
  });

  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.status).toBe('confirmed');

  // Verify request history
  const requests = server.logger.tracker.getRequests();
  expect(requests).toHaveLength(1);
  expect(requests[0].body.items).toContain('item_1');
});
```

---

## 🛠 Fixture Generator CLI

Generate standalone JSON fixture files on demand:

```bash
# Generate 50 realistic users to users.json
mock-endpoint-runner generate user --count 50 -o users.json

# Generate reproducible data with a seed
mock-endpoint-runner generate product --count 20 --seed 42 -o products.json
```

Available generator types: `user`, `product`, `post`, `order`, `company`, `address`.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check [issues page](https://github.com/slopggobblercobbler81/mock-endpoint-runner/issues).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
