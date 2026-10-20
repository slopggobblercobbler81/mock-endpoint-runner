import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseYaml, normalizeConfig } from '../src/parser.js';

describe('Parser', () => {
  test('parses YAML text correctly', () => {
    const yaml = `
prefix: /api/v2
globalDelay: 100
routes:
  - method: GET
    path: /status
    response:
      active: true
      version: 2.1
  - method: POST
    path: /users
    status: 201
resources:
  - name: products
    count: 15
`;

    const parsed = parseYaml(yaml);
    assert.equal(parsed.prefix, '/api/v2');
    assert.equal(parsed.globalDelay, 100);
    assert.equal(parsed.routes.length, 2);
    assert.equal(parsed.routes[0].method, 'GET');
    assert.equal(parsed.routes[0].response.active, true);
    assert.equal(parsed.routes[0].response.version, 2.1);
    assert.equal(parsed.routes[1].status, 201);
    assert.equal(parsed.resources.length, 1);
    assert.equal(parsed.resources[0].name, 'products');
    assert.equal(parsed.resources[0].count, 15);
  });

  test('normalizes raw array configuration', () => {
    const raw = [
      { method: 'GET', path: '/test', response: { ok: true } }
    ];
    const norm = normalizeConfig(raw);
    assert.equal(norm.routes.length, 1);
    assert.equal(norm.routes[0].path, '/test');
    assert.equal(norm.routes[0].method, 'GET');
  });

  test('normalizes raw object configuration with endpoints key', () => {
    const raw = {
      prefix: '/v1',
      endpoints: [
        { path: '/items', status: 200 }
      ]
    };
    const norm = normalizeConfig(raw);
    assert.equal(norm.prefix, '/v1');
    assert.equal(norm.routes.length, 1);
    assert.equal(norm.routes[0].path, '/items');
  });
});
