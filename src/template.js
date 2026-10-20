/**
 * mock-endpoint-runner - Response Template Interpolation
 * Resolves dynamic placeholders in mock responses like:
 * {{params.id}}, {{query.limit}}, {{faker.name}}, {{faker.integer(1, 50)}}, etc.
 */

import { faker } from './faker.js';

function getNestedValue(obj, path) {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.replace(/\[['"]?([^'"]+)['"]?\]/g, '.$1').split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function executeFakerExpression(expr) {
  // expr like: "name", "integer(1, 100)", "oneOf(['a', 'b'])"
  const callMatch = expr.match(/^([a-zA-Z0-9_]+)(?:\((.*)\))?$/);
  if (!callMatch) return undefined;

  const fnName = callMatch[1];
  const argsStr = callMatch[2];

  const fn = faker[fnName];
  if (typeof fn !== 'function') return undefined;

  if (argsStr === undefined || argsStr.trim() === '') {
    return fn();
  }

  // Parse simple comma-separated arguments: numbers, booleans, strings, JSON arrays
  try {
    // Safely wrap in an array bracket and parse as JSON if valid, or fall back to naive split
    const jsonAttempt = `[${argsStr}]`;
    const parsedArgs = JSON.parse(jsonAttempt.replace(/'/g, '"'));
    return fn(...parsedArgs);
  } catch {
    // Naive parse
    const rawArgs = argsStr.split(',').map((s) => {
      const trimmed = s.trim();
      if (!isNaN(trimmed)) return Number(trimmed);
      if (trimmed === 'true') return true;
      if (trimmed === 'false') return false;
      return trimmed.replace(/^['"]|['"]$/g, '');
    });
    return fn(...rawArgs);
  }
}

export function evaluateExpression(expr, context = {}) {
  const trimmed = expr.trim();

  // 1. Built-in shortcuts
  if (trimmed === 'timestamp') return Date.now();
  if (trimmed === 'isoDate' || trimmed === 'now') return new Date().toISOString();

  // 2. Faker expressions
  if (trimmed.startsWith('faker.')) {
    const fakerExpr = trimmed.slice(6);
    return executeFakerExpression(fakerExpr);
  }

  // 3. Request context variables: params.x, query.x, headers.x, body.x
  const value = getNestedValue(context, trimmed);
  if (value !== undefined) {
    return value;
  }

  return `{{${expr}}}`;
}

export function interpolateString(str, context = {}) {
  if (typeof str !== 'string') return str;

  // Check if string is EXACTLY a single expression token: "{{expression}}"
  const exactMatch = str.trim().match(/^\{\{([^{}]+)\}\}$/);
  if (exactMatch) {
    const val = evaluateExpression(exactMatch[1], context);
    // If evaluated successfully, return primitive type
    if (val !== `{{${exactMatch[1]}}}`) {
      return val;
    }
  }

  // Otherwise replace occurrences inside text
  return str.replace(/\{\{([^{}]+)\}\}/g, (match, expr) => {
    const val = evaluateExpression(expr, context);
    return val !== undefined ? String(val) : match;
  });
}

export function interpolate(value, context = {}) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return interpolateString(value, context);
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolate(item, context));
  }

  if (typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = interpolate(v, context);
    }
    return result;
  }

  return value;
}

export default {
  interpolate,
  interpolateString,
  evaluateExpression
};
