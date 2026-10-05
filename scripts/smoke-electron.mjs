import assert from 'node:assert/strict';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const electronExecutable = require('electron');
const userDataDirectory = mkdtempSync(join(tmpdir(), 'mpbc-electron-smoke-'));

function runOnce() {
  const result = spawnSync(electronExecutable, ['.'], {
    stdio: 'inherit',
    timeout: 30000,
    env: {
      ...process.env,
      MPBC_SMOKE_TEST: '1',
      MPBC_USER_DATA_DIR: userDataDirectory,
    },
  });

  if (result.error) {
    throw result.error;
  }

  assert.equal(result.signal, null, `Electron terminated by signal: ${result.signal}`);
  assert.equal(result.status, 0, `Electron exited with status: ${result.status}`);
}

try {
  runOnce();

  const statePath = join(userDataDirectory, 'runtime', 'shutdown-state.json');
  const firstState = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(firstState.status, 'clean');

  runOnce();

  const secondState = JSON.parse(readFileSync(statePath, 'utf8'));
  assert.equal(secondState.status, 'clean');

  const logPath = join(userDataDirectory, 'logs', 'foundation.jsonl');
  const logEntries = readFileSync(logPath, 'utf8')
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const startEntries = logEntries.filter((entry) => entry.event === 'app.start');
  assert.ok(startEntries.length >= 2, 'Expected at least two app.start log entries.');
  assert.equal(startEntries.at(-1)?.context?.previousRun, 'clean');

  console.log('Electron two-run clean-shutdown smoke test passed.');
} finally {
  rmSync(userDataDirectory, { recursive: true, force: true });
}
