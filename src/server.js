/**
 * mock-endpoint-runner - Core HTTP Mock Server
 * High performance, zero-dependency HTTP server for mocking endpoints and integration testing.
 */

import http from 'node:http';
import { URL } from 'node:url';
import { Router } from './router.js';
import { CrudResource } from './crud.js';
import { Logger } from './logger.js';
import { interpolate } from './template.js';

export class MockServer {
  constructor(options = {}) {
    this.port = options.port || 3000;
    this.host = options.host || '0.0.0.0';
    this.cors = options.cors !== false; // Enabled by default
    this.prefix = options.prefix || '';
    if (this.prefix && !this.prefix.startsWith('/')) {
      this.prefix = `/${this.prefix}`;
    }
    this.globalDelay = options.globalDelay || 0;
    this.logger = new Logger({ quiet: options.quiet });

    this.router = new Router();
    this.resources = new Map();
    this.httpServer = null;

    // Apply initial configuration if provided
    if (options.routes) {
      for (const route of options.routes) {
        this.addRoute(route);
      }
    }

    if (options.resources) {
      for (const res of options.resources) {
        this.addResource(res);
      }
    }
  }

  addRoute(routeDef) {
    const prefixedDef = { ...routeDef };
    if (this.prefix && prefixedDef.path && !prefixedDef.path.startsWith(this.prefix)) {
      const cleanPath = prefixedDef.path.startsWith('/') ? prefixedDef.path : `/${prefixedDef.path}`;
      prefixedDef.path = `${this.prefix}${cleanPath}`;
    }
    return this.router.addRoute(prefixedDef);
  }

  addResource(resourceConfig) {
    const config = { ...resourceConfig };
    if (this.prefix && config.path && !config.path.startsWith(this.prefix)) {
      const cleanPath = config.path.startsWith('/') ? config.path : `/${config.path}`;
      config.path = `${this.prefix}${cleanPath}`;
    } else if (this.prefix && !config.path) {
      config.path = `${this.prefix}/${config.name}`;
    }

    const resource = new CrudResource(config.name, config);
    resource.registerRoutes(this.router);
    this.resources.set(config.name, resource);
    return resource;
  }

  reset() {
    this.logger.tracker.clear();
    for (const resource of this.resources.values()) {
      resource.reset();
    }
  }

  async parseRequestBody(req) {
    return new Promise((resolve) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) {
          resolve({});
          return;
        }

        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            resolve(JSON.parse(raw));
            return;
          } catch {
            resolve({ raw });
            return;
          }
        }

        if (contentType.includes('application/x-www-form-urlencoded')) {
          try {
            const params = new URLSearchParams(raw);
            const obj = {};
            for (const [k, v] of params.entries()) {
              obj[k] = v;
            }
            resolve(obj);
            return;
          } catch {
            resolve({ raw });
            return;
          }
        }

        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({ raw });
        }
      });
      req.on('error', () => resolve({}));
    });
  }

  handleCors(req, res) {
    if (!this.cors) return false;

    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }
    return false;
  }

  async handleSpecialMockRoutes(req, res, pathname, query, body) {
    // 1. GET /__mock/requests
    if (pathname === '/__mock/requests' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.logger.tracker.getRequests(), null, 2));
      return true;
    }

    // 2. GET /__mock/routes
    if (pathname === '/__mock/routes' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.router.getRoutes(), null, 2));
      return true;
    }

    // 3. POST /__mock/reset
    if (pathname === '/__mock/reset' && req.method === 'POST') {
      this.reset();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Mock state and request logs reset' }));
      return true;
    }

    // 4. POST /__mock/override (dynamic route addition)
    if (pathname === '/__mock/override' && req.method === 'POST') {
      try {
        const route = this.addRoute(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, routeId: route.id, path: route.path, method: route.method }));
        return true;
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
        return true;
      }
    }

    return false;
  }

  async requestHandler(req, res) {
    const startTime = Date.now();

    // CORS preflight check
    if (this.handleCors(req, res)) {
      this.logger.logRequest(req.method, req.url, 204, Date.now() - startTime);
      return;
    }

    const hostHeader = req.headers.host || `localhost:${this.port}`;
    const parsedUrl = new URL(req.url, `http://${hostHeader}`);
    const pathname = parsedUrl.pathname;
    const query = Object.fromEntries(parsedUrl.searchParams.entries());

    const body = await this.parseRequestBody(req);

    // Check special inspector endpoints
    const handledSpecial = await this.handleSpecialMockRoutes(req, res, pathname, query, body);
    if (handledSpecial) {
      this.logger.logRequest(req.method, req.url, res.statusCode || 200, Date.now() - startTime);
      return;
    }

    // Match route in router
    const matchResult = this.router.match(req.method, pathname, query, req.headers);

    if (!matchResult) {
      const status = 404;
      const duration = Date.now() - startTime;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Not Found',
        message: `No mock route matched for ${req.method} ${pathname}`,
        availableRoutes: this.router.getRoutes().map(r => `${r.method} ${r.path}`)
      }, null, 2));

      this.logger.tracker.record({
        method: req.method,
        url: req.url,
        path: pathname,
        query,
        headers: req.headers,
        body,
        status,
        durationMs: duration
      });
      this.logger.logRequest(req.method, req.url, status, duration);
      return;
    }

    const { route, params } = matchResult;

    // Determine latency delay
    let totalDelay = this.globalDelay;
    if (Array.isArray(route.delay) && route.delay.length === 2) {
      const [minD, maxD] = route.delay;
      totalDelay += Math.floor(Math.random() * (maxD - minD + 1)) + minD;
    } else if (typeof route.delay === 'number') {
      totalDelay += route.delay;
    }

    if (totalDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }

    // Determine simulated error
    if (route.errorRate > 0 && Math.random() < route.errorRate) {
      const status = route.errorStatus || 500;
      const duration = Date.now() - startTime;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(route.errorResponse || { error: 'Simulated failure' }));

      this.logger.tracker.record({
        method: req.method,
        url: req.url,
        path: pathname,
        query,
        headers: req.headers,
        body,
        status,
        durationMs: duration
      });
      this.logger.logRequest(req.method, req.url, status, duration);
      return;
    }

    // Execute response handler or static response
    let finalStatus = route.status || 200;
    let finalHeaders = { 'Content-Type': 'application/json', ...(route.headers || {}) };
    let finalBody = route.response;

    const requestContext = {
      params,
      query,
      headers: req.headers,
      body,
      method: req.method,
      path: pathname,
      url: req.url
    };

    if (typeof route.handler === 'function') {
      try {
        const handlerResult = await route.handler(requestContext, res);
        if (res.writableEnded) {
          // Handled manually by route
          return;
        }
        if (handlerResult) {
          if (handlerResult.status) finalStatus = handlerResult.status;
          if (handlerResult.headers) finalHeaders = { ...finalHeaders, ...handlerResult.headers };
          if (handlerResult.body !== undefined) finalBody = handlerResult.body;
        }
      } catch (err) {
        finalStatus = 500;
        finalBody = { error: 'Handler error', details: err.message };
      }
    }

    // Template interpolation for body
    const interpolatedBody = interpolate(finalBody, requestContext);

    // Format output
    let payload;
    const ct = (finalHeaders['Content-Type'] || finalHeaders['content-type'] || 'application/json').toLowerCase();

    if (ct.includes('application/json')) {
      payload = typeof interpolatedBody === 'string' ? interpolatedBody : JSON.stringify(interpolatedBody, null, 2);
    } else {
      payload = typeof interpolatedBody === 'object' ? JSON.stringify(interpolatedBody) : String(interpolatedBody ?? '');
    }

    res.writeHead(finalStatus, finalHeaders);
    res.end(payload);

    const duration = Date.now() - startTime;
    this.logger.tracker.record({
      method: req.method,
      url: req.url,
      path: pathname,
      query,
      headers: req.headers,
      body,
      status: finalStatus,
      durationMs: duration
    });
    this.logger.logRequest(req.method, req.url, finalStatus, duration);
  }

  listen(port = this.port, host = this.host) {
    return new Promise((resolve, reject) => {
      this.port = port;
      this.host = host;

      this.httpServer = http.createServer((req, res) => {
        this.requestHandler(req, res).catch(err => {
          this.logger.error(`Unhandled request error: ${err.message}`);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error' }));
          }
        });
      });

      this.httpServer.on('error', reject);
      this.httpServer.listen(this.port, this.host, () => {
        resolve(this);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      if (!this.httpServer) {
        resolve();
        return;
      }
      this.httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  address() {
    return this.httpServer ? this.httpServer.address() : null;
  }
}

export function createMockServer(config = {}, options = {}) {
  const mergedOptions = {
    ...config,
    ...options,
    routes: [...(config.routes || []), ...(options.routes || [])],
    resources: [...(config.resources || []), ...(options.resources || [])]
  };
  return new MockServer(mergedOptions);
}

export default MockServer;
