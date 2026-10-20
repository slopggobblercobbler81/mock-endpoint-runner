/**
 * mock-endpoint-runner
 * A lightweight zero-dependency local HTTP API mock server and fixture generator
 * for frontend and integration testing.
 */

export { MockServer, createMockServer } from './server.js';
export { Router } from './router.js';
export { CrudResource } from './crud.js';
export { faker, seed, resetSeed } from './faker.js';
export { interpolate, interpolateString, evaluateExpression } from './template.js';
export { loadConfig, loadConfigFile, parseYaml, normalizeConfig } from './parser.js';
export { Logger, RequestTracker } from './logger.js';

import { createMockServer } from './server.js';
export default createMockServer;
