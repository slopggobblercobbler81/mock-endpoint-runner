import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { interpolate, interpolateString, evaluateExpression } from '../src/template.js';

describe('template interpolator', () => {
  test('evaluates request context variables', () => {
    const ctx = {
      params: { id: 'usr_42' },
      query: { filter: 'active', limit: 25 },
      headers: { 'x-api-key': 'secret-123' },
      body: { name: 'Alice' }
    };

    assert.equal(interpolate('User: {{params.id}}', ctx), 'User: usr_42');
    assert.equal(interpolate('Filter: {{query.filter}}', ctx), 'Filter: active');
    assert.equal(interpolate('Body: {{body.name}}', ctx), 'Body: Alice');
    assert.equal(interpolate("Key: {{headers['x-api-key']}}", ctx), 'Key: secret-123');
  });

  test('evaluates timestamps and faker calls', () => {
    const ts = interpolate('{{timestamp}}');
    assert.equal(typeof ts, 'number');
    assert.ok(ts > 100000000);

    const email = interpolate('{{faker.email}}');
    assert.match(email, /@/);

    const intVal = interpolate('{{faker.integer(50, 60)}}');
    assert.equal(typeof intVal, 'number');
    assert.ok(intVal >= 50 && intVal <= 60);
  });

  test('deeply traverses objects and arrays', () => {
    const templateObj = {
      user: {
        id: '{{params.userId}}',
        status: 'active',
        tags: ['tag-{{query.type}}', 'verified']
      },
      count: '{{faker.integer(1, 10)}}'
    };

    const ctx = {
      params: { userId: '101' },
      query: { type: 'premium' }
    };

    const result = interpolate(templateObj, ctx);
    assert.equal(result.user.id, '101');
    assert.equal(result.user.tags[0], 'tag-premium');
    assert.equal(result.user.tags[1], 'verified');
    assert.equal(typeof result.count, 'number');
    assert.ok(result.count >= 1 && result.count <= 10);
  });
});
