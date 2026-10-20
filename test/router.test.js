import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Router } from '../src/router.js';

describe('Router', () => {
  test('matches exact routes', () => {
    const router = new Router();
    router.addRoute({ method: 'GET', path: '/api/v1/ping', response: { pong: true } });

    const m = router.match('GET', '/api/v1/ping');
    assert.ok(m);
    assert.deepEqual(m.route.response, { pong: true });

    const notFound = router.match('GET', '/api/v1/pong');
    assert.equal(notFound, null);
  });

  test('extracts route parameters', () => {
    const router = new Router();
    router.addRoute({ method: 'GET', path: '/users/:userId/posts/:postId' });

    const m = router.match('GET', '/users/alice/posts/42');
    assert.ok(m);
    assert.equal(m.params.userId, 'alice');
    assert.equal(m.params.postId, '42');
  });

  test('matches wildcard routes', () => {
    const router = new Router();
    router.addRoute({ method: 'GET', path: '/static/*' });

    const m = router.match('GET', '/static/images/avatar.png');
    assert.ok(m);
    assert.equal(m.params.wildcard, 'images/avatar.png');
  });

  test('prioritizes exact matches over parameterized matches', () => {
    const router = new Router();
    router.addRoute({ method: 'GET', path: '/users/:id', response: 'param' });
    router.addRoute({ method: 'GET', path: '/users/me', response: 'exact' });

    const meMatch = router.match('GET', '/users/me');
    assert.ok(meMatch);
    assert.equal(meMatch.route.response, 'exact');

    const idMatch = router.match('GET', '/users/99');
    assert.ok(idMatch);
    assert.equal(idMatch.route.response, 'param');
    assert.equal(idMatch.params.id, '99');
  });

  test('matches query and header conditions', () => {
    const router = new Router();
    router.addRoute({
      method: 'GET',
      path: '/items',
      match: { query: { type: 'special' } },
      response: 'special-items'
    });
    router.addRoute({
      method: 'GET',
      path: '/items',
      response: 'regular-items'
    });

    const regular = router.match('GET', '/items', { type: 'normal' });
    assert.equal(regular.route.response, 'regular-items');

    const special = router.match('GET', '/items', { type: 'special' });
    assert.equal(special.route.response, 'special-items');
  });
});
