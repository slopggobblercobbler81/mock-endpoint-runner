/**
 * mock-endpoint-runner - Multi-format Configuration Parser
 * Loads JSON, YAML, and JS configuration files and directories with zero external dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Lightweight Zero-Dependency YAML Parser
 * Parses standard YAML configurations for endpoints, resources, and responses.
 */
export function parseYaml(yamlString) {
  const lines = yamlString
    .split(/\r?\n/)
    .map(l => l.replace(/#.*$/, '')) // strip comments
    .filter(l => l.trim().length > 0);

  let index = 0;

  function getIndent(line) {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  function parseScalar(val) {
    const trimmed = val.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null' || trimmed === '~') return null;
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);

    // Strip outer quotes if present
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Inline JSON array or object
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        return JSON.parse(trimmed.replace(/'/g, '"'));
      } catch {
        // Fall back to string
      }
    }

    return trimmed;
  }

  function parseBlock(currentIndent) {
    let result = null;
    let isArray = false;

    while (index < lines.length) {
      const line = lines[index];
      const indent = getIndent(line);

      if (indent < currentIndent) {
        break;
      }

      const trimmed = line.trim();

      // Check if this line is an array item
      if (trimmed.startsWith('- ')) {
        if (result === null) {
          result = [];
          isArray = true;
        }

        const itemContent = trimmed.slice(2).trim();
        index++;

        if (itemContent === '') {
          // Nested block under array item
          const child = parseBlock(indent + 2);
          result.push(child);
        } else if (itemContent.includes(': ') || itemContent.endsWith(':')) {
          // Inline object starting on the same line as dash
          const obj = {};
          const colonIdx = itemContent.indexOf(':');
          const k = itemContent.slice(0, colonIdx).trim();
          const restVal = itemContent.slice(colonIdx + 1).trim();

          if (restVal !== '') {
            obj[k] = parseScalar(restVal);
          } else {
            index--; // re-evaluate for children
            lines[index] = ' '.repeat(indent + 2) + k + ':';
            obj[k] = parseBlock(indent + 4);
          }

          // Consume following keys at same item indent level
          while (index < lines.length && getIndent(lines[index]) === indent + 2 && !lines[index].trim().startsWith('- ')) {
            const nextLine = lines[index];
            const nextColon = nextLine.indexOf(':');
            if (nextColon !== -1) {
              const nextK = nextLine.slice(0, nextColon).trim();
              const nextV = nextLine.slice(nextColon + 1).trim();
              index++;
              if (nextV !== '') {
                obj[nextK] = parseScalar(nextV);
              } else {
                obj[nextK] = parseBlock(indent + 4);
              }
            } else {
              break;
            }
          }
          result.push(obj);
        } else {
          result.push(parseScalar(itemContent));
        }
      } else if (trimmed.includes(':')) {
        if (result === null) {
          result = {};
          isArray = false;
        }

        const colonIdx = trimmed.indexOf(':');
        const key = trimmed.slice(0, colonIdx).trim();
        const valueStr = trimmed.slice(colonIdx + 1).trim();
        index++;

        if (valueStr === '') {
          // Child block
          const childIndent = index < lines.length ? getIndent(lines[index]) : indent + 2;
          if (childIndent > indent) {
            result[key] = parseBlock(childIndent);
          } else {
            result[key] = null;
          }
        } else {
          result[key] = parseScalar(valueStr);
        }
      } else {
        index++;
      }
    }

    return result;
  }

  return parseBlock(0);
}

/**
 * Load file content according to its extension
 */
export async function loadConfigFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  if (ext === '.json') {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    return JSON.parse(raw);
  }

  if (ext === '.yaml' || ext === '.yml') {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    return parseYaml(raw);
  }

  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    const fileUrl = pathToFileURL(absolutePath).href;
    const mod = await import(fileUrl);
    return mod.default || mod;
  }

  throw new Error(`Unsupported config format '${ext}'. Supported: .json, .yaml, .yml, .js`);
}

/**
 * Recursively find all config files in a directory
 */
export function findConfigFiles(dirPath) {
  const validExts = new Set(['.json', '.yaml', '.yml', '.js', '.mjs']);
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && validExts.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }

  walk(path.resolve(dirPath));
  return files;
}

/**
 * Normalizes any loaded structure into a standard configuration object:
 * {
 *   prefix: string,
 *   globalDelay: number,
 *   routes: Array<RouteDef>,
 *   resources: Array<ResourceDef>
 * }
 */
export function normalizeConfig(rawConfig, filePath = '') {
  const result = {
    prefix: '',
    globalDelay: 0,
    routes: [],
    resources: []
  };

  if (!rawConfig) return result;

  // Case 1: Raw array of routes
  if (Array.isArray(rawConfig)) {
    result.routes = rawConfig.map(r => normalizeRoute(r, filePath));
    return result;
  }

  // Case 2: Object configuration
  if (typeof rawConfig === 'object') {
    if (rawConfig.prefix) {
      result.prefix = rawConfig.prefix;
    }
    if (typeof rawConfig.globalDelay === 'number') {
      result.globalDelay = rawConfig.globalDelay;
    }

    const routeList = rawConfig.routes || rawConfig.endpoints || [];
    if (Array.isArray(routeList)) {
      result.routes = routeList.map(r => normalizeRoute(r, filePath));
    }

    const resourceList = rawConfig.resources || [];
    if (Array.isArray(resourceList)) {
      result.resources = resourceList.map(r => normalizeResource(r));
    }

    // Direct single route definition in file
    if (!rawConfig.routes && !rawConfig.endpoints && !rawConfig.resources) {
      if (rawConfig.path || rawConfig.response !== undefined || rawConfig.status) {
        result.routes = [normalizeRoute(rawConfig, filePath)];
      }
    }
  }

  return result;
}

function normalizeRoute(route, filePath = '') {
  let routePath = route.path;

  // Infer path from filename if not specified
  if (!routePath && filePath) {
    const base = path.basename(filePath, path.extname(filePath));
    routePath = `/${base}`;
  }

  return {
    method: (route.method || 'GET').toUpperCase(),
    path: routePath || '/',
    status: route.status || 200,
    headers: route.headers || {},
    response: route.response !== undefined ? route.response : (route.body !== undefined ? route.body : null),
    delay: route.delay || 0,
    errorRate: route.errorRate || 0,
    errorStatus: route.errorStatus || 500,
    errorResponse: route.errorResponse || { error: 'Internal Server Error' },
    match: route.match || {},
    handler: typeof route.handler === 'function' ? route.handler : null,
    description: route.description || ''
  };
}

function normalizeResource(res) {
  return {
    name: res.name || 'item',
    path: res.path || `/${res.name}`,
    count: res.count || 5,
    fixtures: res.fixtures || null,
    generate: res.generate || null
  };
}

/**
 * Load complete configuration from file or directory
 */
export async function loadConfig(targetPath) {
  const resolved = path.resolve(targetPath);
  const stat = fs.statSync(resolved);

  if (stat.isDirectory()) {
    const files = findConfigFiles(resolved);
    const combined = {
      prefix: '',
      globalDelay: 0,
      routes: [],
      resources: []
    };

    for (const f of files) {
      const content = await loadConfigFile(f);
      const normalized = normalizeConfig(content, f);
      combined.routes.push(...normalized.routes);
      combined.resources.push(...normalized.resources);
      if (normalized.prefix && !combined.prefix) combined.prefix = normalized.prefix;
      if (normalized.globalDelay && !combined.globalDelay) combined.globalDelay = normalized.globalDelay;
    }

    return combined;
  }

  const content = await loadConfigFile(resolved);
  return normalizeConfig(content, resolved);
}

export default {
  parseYaml,
  loadConfigFile,
  findConfigFiles,
  normalizeConfig,
  loadConfig
};
