import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, '../bin/mock-endpoint-runner.js');

describe('CLI execution tests', () => {
  test('prints version with --version', async () => {
    const { stdout } = await execFileAsync(process.execPath, [cliPath, '--version']);
    assert.match(stdout, /mock-endpoint-runner v\d+\.\d+\.\d+/);
  });

  test('prints help with --help', async () => {
    const { stdout } = await execFileAsync(process.execPath, [cliPath, '--help']);
    assert.match(stdout, /Usage:/);
    assert.match(stdout, /serve/);
    assert.match(stdout, /generate/);
    assert.match(stdout, /validate/);
  });

  test('generates fixture data to stdout', async () => {
    const { stdout } = await execFileAsync(process.execPath, [cliPath, 'generate', 'user', '--count', '3']);
    const parsed = JSON.parse(stdout);
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed.length, 3);
    assert.ok(parsed[0].name);
    assert.ok(parsed[0].email);
  });

  test('validates example endpoint configurations', async () => {
    const examplePath = path.resolve(__dirname, '../examples/basic-endpoints.json');
    const { stdout } = await execFileAsync(process.execPath, [cliPath, 'validate', examplePath]);
    assert.match(stdout, /is valid!/);
    assert.match(stdout, /Custom Routes:/);
  });

  test('scaffolds sample configuration with init command', async () => {
    const tempDir = path.resolve(__dirname, '../test-temp-init');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    try {
      const { stdout } = await execFileAsync(process.execPath, [cliPath, 'init', tempDir]);
      assert.match(stdout, /Created sample configuration/);
      assert.ok(fs.existsSync(path.join(tempDir, 'mocks.json')));
    } finally {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });
});
