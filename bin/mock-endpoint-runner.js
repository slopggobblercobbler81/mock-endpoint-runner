#!/usr/bin/env node

/**
 * mock-endpoint-runner CLI
 * Zero-dependency local mock server and fixture generator
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockServer } from '../src/server.js';
import { loadConfig } from '../src/parser.js';
import { faker, seed } from '../src/faker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

function printBanner() {
  console.log(`
\x1b[36m   __  __            _      _____           _             _       _
  |  \\/  |          | |    |  ___|         | |           (_)     | |
  | \\  / | ___   ___| | __ | |__ _ __   __| |_ __   ___  _ _ __ | |_
  | |\\/| |/ _ \\ / __| |/ / |  __| '_ \\ / _\` | '_ \\ / _ \\| | '_ \\| __|
  | |  | | (_) | (__|   <  | |__| | | | (_| | |_) | (_) | | | | | |_
  |_|  |_|\\___/ \\___|_|\\_\\ |____|_| |_|\\__,_| .__/ \\___/|_|_| |_|\\__|
                                            | |
                                            |_| \x1b[32mv${pkg.version}\x1b[0m
`);
}

function printHelp() {
  printBanner();
  console.log(`
Usage:
  mock-endpoint-runner <command> [options]

Commands:
  serve [file|dir]       Start the mock HTTP server (default: mocks.json or ./mocks)
  generate <type>        Generate realistic JSON fixtures (user, product, post, order, etc.)
  validate [file]        Validate endpoint configuration file syntax and paths
  init [dir]             Scaffold an example mocks.json configuration
  help                   Show this help message
  version                Show version

Options for 'serve':
  -p, --port <port>      Server port (default: 3000 or $PORT)
  -H, --host <host>      Server host (default: 0.0.0.0)
  -d, --delay <ms>       Artificial global response delay in milliseconds
  --prefix <prefix>      Global route prefix (e.g. /api/v1)
  --no-cors              Disable CORS response headers
  -w, --watch            Watch configuration file/dir and reload on change
  -q, --quiet            Silence per-request access logs

Options for 'generate':
  -c, --count <num>      Number of items to generate (default: 10)
  -o, --output <file>    Output JSON file path (default: stdout)
  -s, --seed <num>       Seed number for reproducible pseudo-random data

Examples:
  mock-endpoint-runner serve mocks.json --port 8080 --delay 100
  mock-endpoint-runner serve ./mocks --watch
  mock-endpoint-runner generate user --count 25 -o users.json
  mock-endpoint-runner generate product --count 50
  mock-endpoint-runner validate endpoints.yaml
  mock-endpoint-runner init
`);
}

function parseCliArgs(args) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--version' || arg === '-v') {
      flags.version = true;
    } else if (arg === '--no-cors') {
      flags.cors = false;
    } else if (arg === '--watch' || arg === '-w') {
      flags.watch = true;
    } else if (arg === '--quiet' || arg === '-q') {
      flags.quiet = true;
    } else if (arg === '-p' || arg === '--port') {
      flags.port = parseInt(args[++i], 10);
    } else if (arg === '-H' || arg === '--host') {
      flags.host = args[++i];
    } else if (arg === '-d' || arg === '--delay') {
      flags.delay = parseInt(args[++i], 10);
    } else if (arg === '--prefix') {
      flags.prefix = args[++i];
    } else if (arg === '-c' || arg === '--count') {
      flags.count = parseInt(args[++i], 10);
    } else if (arg === '-o' || arg === '--output') {
      flags.output = args[++i];
    } else if (arg === '-s' || arg === '--seed') {
      flags.seed = parseInt(args[++i], 10);
    } else if (arg.startsWith('-')) {
      console.warn(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

async function findDefaultTarget() {
  const defaults = ['mocks.json', 'mocks.yaml', 'mocks.yml', 'endpoints.json', 'endpoints.yaml', 'mocks'];
  for (const d of defaults) {
    if (fs.existsSync(path.resolve(d))) {
      return d;
    }
  }
  return null;
}

async function runServe(target, flags) {
  let configTarget = target;
  if (!configTarget) {
    configTarget = await findDefaultTarget();
  }

  let serverInstance = null;
  const port = flags.port || parseInt(process.env.PORT || '3000', 10);
  const host = flags.host || '0.0.0.0';

  async function startServer() {
    let config = { routes: [], resources: [] };

    if (configTarget && fs.existsSync(path.resolve(configTarget))) {
      try {
        config = await loadConfig(configTarget);
      } catch (err) {
        console.error(`\x1b[31mError loading configuration from ${configTarget}:\x1b[0m ${err.message}`);
        return;
      }
    } else {
      console.log(`\x1b[33mNo mock config specified or found. Starting with default sample routes.\x1b[0m`);
      config = {
        routes: [
          {
            method: 'GET',
            path: '/api/status',
            response: { status: 'ok', uptime: '{{timestamp}}', server: 'mock-endpoint-runner' }
          },
          {
            method: 'GET',
            path: '/api/users/:id',
            response: { id: '{{params.id}}', name: '{{faker.name}}', email: '{{faker.email}}' }
          }
        ],
        resources: [
          { name: 'items', path: '/api/items', count: 3 }
        ]
      };
    }

    if (flags.delay !== undefined) {
      config.globalDelay = flags.delay;
    }
    if (flags.prefix !== undefined) {
      config.prefix = flags.prefix;
    }
    if (flags.cors !== undefined) {
      config.cors = flags.cors;
    }
    if (flags.quiet !== undefined) {
      config.quiet = flags.quiet;
    }

    serverInstance = createMockServer(config, { port, host });
    await serverInstance.listen(port, host);

    printBanner();
    console.log(`\x1b[32m Mock Server running at:\x1b[0m http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
    if (configTarget) {
      console.log(`\x1b[36m Config source:\x1b[0m ${path.resolve(configTarget)}`);
    }
    if (config.prefix) {
      console.log(`\x1b[36m Global prefix:\x1b[0m ${config.prefix}`);
    }
    if (config.globalDelay) {
      console.log(`\x1b[36m Artificial delay:\x1b[0m ${config.globalDelay}ms`);
    }

    console.log(`\n\x1b[1mRegistered Routes:\x1b[0m`);
    const routes = serverInstance.router.getRoutes();
    for (const r of routes) {
      const desc = r.description ? `\x1b[2m - ${r.description}\x1b[0m` : '';
      console.log(`  \x1b[33m${r.method.padEnd(7)}\x1b[0m \x1b[37m${r.path}\x1b[0m \x1b[2m(-> ${r.status})\x1b[0m${desc}`);
    }

    console.log(`\n\x1b[1mInspector Endpoints:\x1b[0m`);
    console.log(`  \x1b[36mGET  http://localhost:${port}/__mock/requests\x1b[0m \x1b[2m(Request history log)\x1b[0m`);
    console.log(`  \x1b[36mGET  http://localhost:${port}/__mock/routes\x1b[0m   \x1b[2m(List active endpoints)\x1b[0m`);
    console.log(`  \x1b[36mPOST http://localhost:${port}/__mock/reset\x1b[0m    \x1b[2m(Reset state & history)\x1b[0m`);
    console.log(`\n\x1b[2mReady for incoming requests. Press Ctrl+C to stop.\x1b[0m\n`);
  }

  await startServer();

  // Watch mode
  if (flags.watch && configTarget && fs.existsSync(path.resolve(configTarget))) {
    const watchTarget = path.resolve(configTarget);
    let debounceTimer = null;
    fs.watch(watchTarget, { recursive: true }, () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        console.log(`\n\x1b[33mConfiguration changed. Reloading server...\x1b[0m`);
        try {
          if (serverInstance) {
            await serverInstance.close();
          }
          await startServer();
        } catch (err) {
          console.error(`Error reloading server: ${err.message}`);
        }
      }, 200);
    });
    console.log(`\x1b[35m[Watch]\x1b[0m Watching for changes in ${watchTarget}...`);
  }
}

async function runGenerate(type, flags) {
  if (!type) {
    console.error('\x1b[31mError:\x1b[0m Missing type for generate. Available types: user, product, post, order, or any faker function.');
    process.exit(1);
  }

  if (flags.seed !== undefined) {
    seed(flags.seed);
  }

  const count = flags.count || 10;
  const genFn = faker[type];

  let data;
  if (typeof genFn === 'function') {
    data = [];
    for (let i = 0; i < count; i++) {
      data.push(genFn());
    }
  } else {
    console.error(`\x1b[31mError:\x1b[0m Unknown generator type "${type}". Available: user, product, post, order, company, address`);
    process.exit(1);
  }

  const jsonStr = JSON.stringify(data, null, 2);

  if (flags.output) {
    const outPath = path.resolve(flags.output);
    fs.writeFileSync(outPath, jsonStr, 'utf8');
    console.log(`\x1b[32mSuccessfully generated ${count} "${type}" records to ${outPath}\x1b[0m`);
  } else {
    console.log(jsonStr);
  }
}

async function runValidate(target) {
  let configTarget = target;
  if (!configTarget) {
    configTarget = await findDefaultTarget();
  }

  if (!configTarget || !fs.existsSync(path.resolve(configTarget))) {
    console.error(`\x1b[31mError:\x1b[0m Configuration file not found.`);
    process.exit(1);
  }

  try {
    const config = await loadConfig(configTarget);
    console.log(`\x1b[32mConfiguration "${configTarget}" is valid!\x1b[0m`);
    console.log(`  - Prefix: ${config.prefix || 'none'}`);
    console.log(`  - Global Delay: ${config.globalDelay || 0}ms`);
    console.log(`  - Custom Routes: ${config.routes.length}`);
    console.log(`  - REST Resources: ${config.resources.length}`);

    if (config.routes.length > 0) {
      console.log(`\nRoutes:`);
      for (const r of config.routes) {
        console.log(`  ${r.method.padEnd(7)} ${r.path} -> ${r.status}`);
      }
    }

    if (config.resources.length > 0) {
      console.log(`\nResources:`);
      for (const res of config.resources) {
        console.log(`  ${res.name} (path: ${res.path || '/' + res.name}, count: ${res.count || 5})`);
      }
    }
  } catch (err) {
    console.error(`\x1b[31mConfiguration validation failed:\x1b[0m ${err.message}`);
    process.exit(1);
  }
}

async function runInit(targetDir) {
  const destDir = path.resolve(targetDir || '.');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const sampleConfigPath = path.join(destDir, 'mocks.json');
  if (fs.existsSync(sampleConfigPath)) {
    console.log(`\x1b[33mFile already exists: ${sampleConfigPath}\x1b[0m`);
    return;
  }

  const sampleConfig = {
    prefix: '/api',
    globalDelay: 50,
    routes: [
      {
        method: 'GET',
        path: '/health',
        response: {
          status: 'ok',
          uptime: '{{timestamp}}',
          date: '{{isoDate}}'
        }
      },
      {
        method: 'GET',
        path: '/users/:id',
        response: {
          id: '{{params.id}}',
          name: '{{faker.name}}',
          email: '{{faker.email}}',
          role: 'developer',
          avatar: '{{faker.avatar}}'
        }
      },
      {
        method: 'POST',
        path: '/auth/login',
        status: 200,
        response: {
          token: 'jwt_{{faker.uuid}}',
          expiresIn: 3600,
          user: {
            username: '{{body.username}}'
          }
        }
      }
    ],
    resources: [
      {
        name: 'products',
        path: '/products',
        generate: {
          schema: 'product',
          count: 5
        }
      }
    ]
  };

  fs.writeFileSync(sampleConfigPath, JSON.stringify(sampleConfig, null, 2), 'utf8');
  console.log(`\x1b[32mCreated sample configuration: ${sampleConfigPath}\x1b[0m`);
  console.log(`Run it with: \x1b[36mnpx mock-endpoint-runner serve mocks.json\x1b[0m\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const { flags, positional } = parseCliArgs(args);

  if (flags.version || positional[0] === 'version') {
    console.log(`mock-endpoint-runner v${pkg.version}`);
    return;
  }

  if (flags.help || positional.length === 0 || positional[0] === 'help') {
    printHelp();
    return;
  }

  const command = positional[0];

  switch (command) {
    case 'serve':
      await runServe(positional[1], flags);
      break;
    case 'generate':
      await runGenerate(positional[1], flags);
      break;
    case 'validate':
      await runValidate(positional[1]);
      break;
    case 'init':
      await runInit(positional[1]);
      break;
    default:
      // If positional[0] is an existing file or directory, default to serve
      if (fs.existsSync(path.resolve(command))) {
        await runServe(command, flags);
      } else {
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
      }
      break;
  }
}

main().catch(err => {
  console.error('\x1b[31mFatal error:\x1b[0m', err);
  process.exit(1);
});
