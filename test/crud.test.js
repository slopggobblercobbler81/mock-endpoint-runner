import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CrudResource } from '../src/crud.js';
import { Router } from '../src/router.js';

describe('CrudResource', () => {
  test('initializes with seed fixtures and supports CRUD', () => {
    const resource = new CrudResource('users', {
      fixtures: [
        { id: '1', name: 'Alice', role: 'admin' },
        { id: '2', name: 'Bob', role: 'user' }
      ]
    });

    // 1. getAll
    const all = resource.getAll();
    assert.equal(all.total, 2);
    assert.equal(all.data.length, 2);

    // 2. filter by field
    const admins = resource.getAll({ role: 'admin' });
    assert.equal(admins.total, 1);
    assert.equal(admins.data[0].name, 'Alice');

    // 3. search with ?q=
    const searched = resource.getAll({ q: 'bob' });
    assert.equal(searched.total, 1);
    assert.equal(searched.data[0].id, '2');

    // 4. getById
    const item = resource.getById('1');
    assert.equal(item.name, 'Alice');

    // 5. create
    const created = resource.create({ name: 'Charlie', role: 'guest' });
    assert.ok(created.id);
    assert.equal(resource.getAll().total, 3);

    // 6. patch
    const updated = resource.update(created.id, { role: 'member' }, false);
    assert.equal(updated.role, 'member');
    assert.equal(updated.name, 'Charlie');

    // 7. delete
    const deleted = resource.delete(created.id);
    assert.equal(deleted, true);
    assert.equal(resource.getAll().total, 2);

    // 8. reset
    resource.create({ name: 'Temp' });
    assert.equal(resource.getAll().total, 3);
    resource.reset();
    assert.equal(resource.getAll().total, 2);
  });

  test('registers routes into router', () => {
    const router = new Router();
    const resource = new CrudResource('posts', {
      fixtures: [{ id: 'p1', title: 'First Post' }]
    });
    resource.registerRoutes(router);

    // GET /posts
    const listMatch = router.match('GET', '/posts');
    assert.ok(listMatch);
    const listRes = listMatch.route.handler({ query: {} });
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.total, 1);

    // GET /posts/:id
    const itemMatch = router.match('GET', '/posts/p1');
    assert.ok(itemMatch);
    const itemRes = itemMatch.route.handler({ params: itemMatch.params });
    assert.equal(itemRes.status, 200);
    assert.equal(itemRes.body.title, 'First Post');
  });
});
