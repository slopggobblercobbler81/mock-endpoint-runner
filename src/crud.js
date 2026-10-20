/**
 * mock-endpoint-runner - In-Memory REST CRUD Resource Manager
 * Generates full RESTful CRUD endpoints for resources with pagination, search, filter, and sorting.
 */

import { faker } from './faker.js';

export class CrudResource {
  constructor(name, options = {}) {
    this.name = name;
    this.basePath = options.path || `/${name}`;
    if (!this.basePath.startsWith('/')) {
      this.basePath = `/${this.basePath}`;
    }
    this.initialItems = [];

    // Pre-populate if fixtures or generator specified
    if (Array.isArray(options.fixtures)) {
      this.initialItems = JSON.parse(JSON.stringify(options.fixtures));
    } else if (options.generate && options.generate.schema) {
      const count = options.generate.count || 5;
      const schema = options.generate.schema;
      const genFn = faker[schema];
      if (typeof genFn === 'function') {
        this.initialItems = [];
        for (let i = 0; i < count; i++) {
          this.initialItems.push(genFn());
        }
      }
    } else if (typeof faker[name] === 'function') {
      // Default to matching faker generator if exists (e.g. 'user', 'product', 'post', 'order')
      const count = options.count || 5;
      this.initialItems = [];
      for (let i = 0; i < count; i++) {
        this.initialItems.push(faker[name]());
      }
    }

    this.items = JSON.parse(JSON.stringify(this.initialItems));
  }

  reset() {
    this.items = JSON.parse(JSON.stringify(this.initialItems));
  }

  getAll(query = {}) {
    let result = [...this.items];

    // Filter by query parameters (excluding pagination and search reserved keys)
    const reserved = ['limit', 'offset', 'page', 'pageSize', 'q', 'sort', 'order'];
    for (const [key, val] of Object.entries(query)) {
      if (!reserved.includes(key) && val !== undefined) {
        result = result.filter(item => {
          if (item[key] === undefined) return false;
          return String(item[key]).toLowerCase() === String(val).toLowerCase();
        });
      }
    }

    // Full text search ?q=
    if (query.q) {
      const q = String(query.q).toLowerCase();
      result = result.filter(item => {
        return Object.values(item).some(v => {
          if (typeof v === 'string') return v.toLowerCase().includes(q);
          if (typeof v === 'number') return String(v).includes(q);
          return false;
        });
      });
    }

    // Sorting ?sort=fieldName&order=asc|desc
    if (query.sort) {
      const sortField = query.sort;
      const order = (query.order || 'asc').toLowerCase() === 'desc' ? -1 : 1;
      result.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal === bVal) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        return aVal > bVal ? order : -order;
      });
    }

    const total = result.length;

    // Pagination: limit/offset or page/pageSize
    let limit = query.limit !== undefined ? parseInt(query.limit, 10) : undefined;
    let offset = query.offset !== undefined ? parseInt(query.offset, 10) : 0;

    if (query.pageSize !== undefined) {
      limit = parseInt(query.pageSize, 10);
      const page = query.page !== undefined ? parseInt(query.page, 10) : 1;
      offset = (Math.max(1, page) - 1) * limit;
    }

    if (limit !== undefined && !isNaN(limit)) {
      result = result.slice(offset, offset + limit);
    }

    return {
      data: result,
      total,
      count: result.length,
      limit: limit !== undefined ? limit : total,
      offset
    };
  }

  getById(id) {
    return this.items.find(item => String(item.id) === String(id));
  }

  create(body = {}) {
    const newItem = {
      id: body.id || faker.uuid(),
      ...body,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.items.push(newItem);
    return newItem;
  }

  update(id, body = {}, replace = false) {
    const index = this.items.findIndex(item => String(item.id) === String(id));
    if (index === -1) return null;

    if (replace) {
      this.items[index] = {
        ...body,
        id: this.items[index].id,
        createdAt: this.items[index].createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } else {
      this.items[index] = {
        ...this.items[index],
        ...body,
        id: this.items[index].id,
        updatedAt: new Date().toISOString()
      };
    }

    return this.items[index];
  }

  delete(id) {
    const index = this.items.findIndex(item => String(item.id) === String(id));
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }

  registerRoutes(router) {
    const base = this.basePath;

    // GET /resource (list)
    router.addRoute({
      method: 'GET',
      path: base,
      description: `List ${this.name} items`,
      handler: (req) => {
        const responseData = this.getAll(req.query);
        return {
          status: 200,
          body: responseData
        };
      }
    });

    // GET /resource/:id
    router.addRoute({
      method: 'GET',
      path: `${base}/:id`,
      description: `Get ${this.name} by ID`,
      handler: (req) => {
        const item = this.getById(req.params.id);
        if (!item) {
          return {
            status: 404,
            body: { error: `${this.name} with id '${req.params.id}' not found` }
          };
        }
        return {
          status: 200,
          body: item
        };
      }
    });

    // POST /resource
    router.addRoute({
      method: 'POST',
      path: base,
      description: `Create new ${this.name}`,
      handler: (req) => {
        const created = this.create(req.body);
        return {
          status: 201,
          body: created
        };
      }
    });

    // PUT /resource/:id
    router.addRoute({
      method: 'PUT',
      path: `${base}/:id`,
      description: `Replace ${this.name} by ID`,
      handler: (req) => {
        const updated = this.update(req.params.id, req.body, true);
        if (!updated) {
          return {
            status: 404,
            body: { error: `${this.name} with id '${req.params.id}' not found` }
          };
        }
        return {
          status: 200,
          body: updated
        };
      }
    });

    // PATCH /resource/:id
    router.addRoute({
      method: 'PATCH',
      path: `${base}/:id`,
      description: `Update ${this.name} by ID`,
      handler: (req) => {
        const updated = this.update(req.params.id, req.body, false);
        if (!updated) {
          return {
            status: 404,
            body: { error: `${this.name} with id '${req.params.id}' not found` }
          };
        }
        return {
          status: 200,
          body: updated
        };
      }
    });

    // DELETE /resource/:id
    router.addRoute({
      method: 'DELETE',
      path: `${base}/:id`,
      description: `Delete ${this.name} by ID`,
      handler: (req) => {
        const deleted = this.delete(req.params.id);
        if (!deleted) {
          return {
            status: 404,
            body: { error: `${this.name} with id '${req.params.id}' not found` }
          };
        }
        return {
          status: 200,
          body: { success: true, message: `${this.name} deleted` }
        };
      }
    });
  }
}

export default CrudResource;
