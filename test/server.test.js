import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createMockServer } from '../src/server.js';

describe('MockServer HTTP tests', () => {
  let server;
  let baseUrl;
  const PORT = 38472;

  before(async () => {
    server = createMockServer({
      prefix: '/api',
      routes: [
        {
          method: 'GET',
          path: '/hello',
          response: { message: 'Hello World' }
        },
        {
          method: 'GET',
          path: '/users/:userId',
          response: {
            id: '{{params.userId}}',
            search: '{{query.q}}',
            serverTime: '{{timestamp}}'
          }
        },
        {
          method: 'POST',
          path: '/echo',
          status: 201,
          response: {
            received: '{{body.msg}}'
          }
        },
        {
          method: 'GET',
          path: '/fail',
          errorRate: 1.0,
          errorStatus: 500,
          errorResponse: { error: 'Broken by design' }
        }
      ],
      resources: [
        {
          name: 'books',
          path: '/books',
          fixtures: [
            { id: 'b1', title: 'The Pragmatic Programmer', author: 'Andy Hunt' },
            { id: 'b2', title: 'Clean Code', author: 'Robert C. Martin' }
          ]
        }
      ],
      quiet: true
    }, { port: PORT, host: '127.0.0.1' });

    await server.listen(PORT, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${PORT}`;
  });

  after(async () => {
    if (server) {
      await server.close();
    }
  });

  test('serves simple GET route', async () => {
    const res = await fetch(`${baseUrl}/api/hello`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.message, 'Hello World');
  });

  test('interpolates params and query strings', async () => {
    const res = await fetch(`${baseUrl}/api/users/9988?q=findme`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, '9988');
    assert.equal(data.search, 'findme');
    assert.equal(typeof data.serverTime, 'number');
  });

  test('handles POST requests with JSON payload', async () => {
    const res = await fetch(`${baseUrl}/api/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: 'Antigravity rocks' })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.received, 'Antigravity rocks');
  });

  test('simulates errors when errorRate is configured', async () => {
    const res = await fetch(`${baseUrl}/api/fail`);
    assert.equal(res.status, 500);
    const data = await res.json();
    assert.equal(data.error, 'Broken by design');
  });

  test('handles CORS preflight requests', async () => {
    const res = await fetch(`${baseUrl}/api/hello`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://frontend.dev',
        'Access-Control-Request-Method': 'GET'
      }
    });
    assert.equal(res.status, 204);
    assert.ok(res.headers.get('access-control-allow-origin'));
  });

  test('serves automatic CRUD resource endpoints', async () => {
    // 1. List books
    const listRes = await fetch(`${baseUrl}/api/books`);
    assert.equal(listRes.status, 200);
    const listData = await listRes.json();
    assert.equal(listData.total, 2);

    // 2. Get book by ID
    const itemRes = await fetch(`${baseUrl}/api/books/b1`);
    assert.equal(itemRes.status, 200);
    const itemData = await itemRes.json();
    assert.equal(itemData.title, 'The Pragmatic Programmer');

    // 3. Create book
    const postRes = await fetch(`${baseUrl}/api/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Refactoring', author: 'Martin Fowler' })
    });
    assert.equal(postRes.status, 201);
    const created = await postRes.json();
    assert.equal(created.title, 'Refactoring');

    // Verify count increased
    const listAfterRes = await fetch(`${baseUrl}/api/books`);
    const listAfterData = await listAfterRes.json();
    assert.equal(listAfterData.total, 3);

    // 4. Delete created book
    const delRes = await fetch(`${baseUrl}/api/books/${created.id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);

    const listFinalRes = await fetch(`${baseUrl}/api/books`);
    const listFinalData = await listFinalRes.json();
    assert.equal(listFinalData.total, 2);
  });

  test('inspects requests via /__mock/requests', async () => {
    const res = await fetch(`${baseUrl}/__mock/requests`);
    assert.equal(res.status, 200);
    const logs = await res.json();
    assert.ok(Array.isArray(logs));
    assert.ok(logs.length > 0);
    assert.ok(logs.some(log => log.url.includes('/api/hello')));
  });

  test('resets state via /__mock/reset', async () => {
    // Modify state first
    await fetch(`${baseUrl}/api/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Temporary book' })
    });

    const resetRes = await fetch(`${baseUrl}/__mock/reset`, { method: 'POST' });
    assert.equal(resetRes.status, 200);

    // Check request logs cleared
    const logsRes = await fetch(`${baseUrl}/__mock/requests`);
    const logs = await logsRes.json();
    assert.equal(logs.length, 0);

    // Check books restored to original 2
    const booksRes = await fetch(`${baseUrl}/api/books`);
    const books = await booksRes.json();
    assert.equal(books.total, 2);
  });

  test('dynamically overrides route at runtime via /__mock/override', async () => {
    const overrideRes = await fetch(`${baseUrl}/__mock/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'GET',
        path: '/injected',
        response: { injected: true, answer: 42 }
      })
    });
    assert.equal(overrideRes.status, 200);

    const checkRes = await fetch(`${baseUrl}/api/injected`);
    assert.equal(checkRes.status, 200);
    const data = await checkRes.json();
    assert.equal(data.injected, true);
    assert.equal(data.answer, 42);
  });

  test('returns 404 with helpful details when no route matches', async () => {
    const res = await fetch(`${baseUrl}/api/non-existent-route`);
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.error, 'Not Found');
    assert.ok(Array.isArray(data.availableRoutes));
  });
});
