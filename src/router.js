/**
 * mock-endpoint-runner - URL & Request Router
 * Handles path patterns, parameter extraction, query/header matching, and route dispatch.
 */

function pathToRegex(pathPattern) {
  const paramNames = [];

  // Escape special regex characters except : and *
  let regexStr = pathPattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    // Parameter :name
    .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    })
    // Wildcard *
    .replace(/\*/g, () => {
      paramNames.push('wildcard');
      return '(.*)';
    });

  // Ensure trailing slash is optional
  regexStr = `^${regexStr}/?$`;
  return {
    regex: new RegExp(regexStr),
    paramNames
  };
}

export class Router {
  constructor() {
    this.routes = [];
  }

  addRoute(routeDef) {
    const {
      method = 'GET',
      path,
      response,
      status = 200,
      headers = {},
      delay = 0,
      errorRate = 0,
      errorStatus = 500,
      errorResponse = { error: 'Simulated server error' },
      match = {},
      handler = null,
      description = ''
    } = routeDef;

    if (!path) {
      throw new Error('Route definition must have a "path"');
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const normalizedMethod = (method || 'GET').toUpperCase();
    const { regex, paramNames } = pathToRegex(normalizedPath);

    // Compute specificity score:
    // exact static path = 100, parameterized = 50 - numParams, wildcard = 10
    const isExact = !normalizedPath.includes(':') && !normalizedPath.includes('*');
    const isWildcard = normalizedPath.includes('*');
    const specificity = isExact ? 100 : isWildcard ? 10 : 50 - paramNames.length;

    const route = {
      id: `${normalizedMethod} ${normalizedPath}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      method: normalizedMethod,
      path: normalizedPath,
      regex,
      paramNames,
      specificity,
      status,
      headers,
      response,
      delay,
      errorRate,
      errorStatus,
      errorResponse,
      match,
      handler,
      description
    };

    this.routes.push(route);
    // Sort so higher specificity routes are matched first
    this.routes.sort((a, b) => b.specificity - a.specificity);
    return route;
  }

  match(method, pathname, query = {}, headers = {}) {
    const upperMethod = method.toUpperCase();
    const cleanPath = pathname.split('?')[0];

    for (const route of this.routes) {
      // 1. Method check
      if (route.method !== 'ALL' && route.method !== upperMethod) {
        continue;
      }

      // 2. Path regex check
      const match = cleanPath.match(route.regex);
      if (!match) {
        continue;
      }

      // 3. Optional query parameter matching
      if (route.match && route.match.query) {
        let queryMatches = true;
        for (const [key, val] of Object.entries(route.match.query)) {
          if (query[key] === undefined || String(query[key]) !== String(val)) {
            queryMatches = false;
            break;
          }
        }
        if (!queryMatches) continue;
      }

      // 4. Optional header matching
      if (route.match && route.match.headers) {
        let headersMatch = true;
        const lowerReqHeaders = {};
        for (const [k, v] of Object.entries(headers)) {
          lowerReqHeaders[k.toLowerCase()] = v;
        }
        for (const [key, val] of Object.entries(route.match.headers)) {
          const reqVal = lowerReqHeaders[key.toLowerCase()];
          if (reqVal === undefined || String(reqVal).toLowerCase() !== String(val).toLowerCase()) {
            headersMatch = false;
            break;
          }
        }
        if (!headersMatch) continue;
      }

      // Extract params
      const params = {};
      route.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(match[index + 1] || '');
      });

      return {
        route,
        params
      };
    }

    return null;
  }

  clear() {
    this.routes = [];
  }

  getRoutes() {
    return this.routes.map(r => ({
      method: r.method,
      path: r.path,
      status: r.status,
      delay: r.delay,
      description: r.description
    }));
  }
}

export default Router;
