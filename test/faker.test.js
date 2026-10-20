import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { faker, seed, resetSeed } from '../src/faker.js';

describe('faker fixture generator', () => {
  test('generates primitive fake values', () => {
    const num = faker.integer(10, 20);
    assert.ok(num >= 10 && num <= 20);

    const flt = faker.float(1.5, 5.5, 2);
    assert.ok(flt >= 1.5 && flt <= 5.5);

    const bool = faker.boolean();
    assert.equal(typeof bool, 'boolean');

    const choice = faker.oneOf(['alpha', 'beta', 'gamma']);
    assert.ok(['alpha', 'beta', 'gamma'].includes(choice));
  });

  test('generates valid UUIDs and IDs', () => {
    const u = faker.uuid();
    assert.match(u, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    const customId = faker.id('user_');
    assert.ok(customId.startsWith('user_'));
  });

  test('generates identity data (names, emails, addresses)', () => {
    const fullName = faker.name();
    assert.ok(fullName.includes(' '));

    const em = faker.email();
    assert.ok(em.includes('@'));

    const addr = faker.address();
    assert.ok(addr.city);
    assert.ok(addr.street);
    assert.ok(addr.country);
  });

  test('generates complex schemas (user, product, post, order)', () => {
    const u = faker.user();
    assert.ok(u.id);
    assert.ok(u.email);
    assert.ok(u.company);

    const p = faker.product();
    assert.ok(p.id);
    assert.ok(p.price > 0);
    assert.ok(p.sku.startsWith('SKU-'));

    const post = faker.post();
    assert.ok(post.id);
    assert.ok(post.title);
    assert.ok(Array.isArray(post.tags));

    const o = faker.order();
    assert.ok(o.orderNumber.startsWith('ORD-'));
    assert.ok(o.items.length > 0);
  });

  test('supports deterministic seed reproduction', () => {
    seed(12345);
    const run1 = [faker.integer(1, 1000), faker.name(), faker.uuid()];

    seed(12345);
    const run2 = [faker.integer(1, 1000), faker.name(), faker.uuid()];

    assert.deepEqual(run1, run2);

    resetSeed();
  });
});
