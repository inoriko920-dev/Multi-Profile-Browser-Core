import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const electronExecutable = require('electron');
const userDataDirectory = mkdtempSync(join(tmpdir(), 'mpbc-step01-smoke-'));

try {
  const result = spawnSync(electronExecutable, ['.'], {
    stdio: 'inherit',
    timeout: 60000,
    env: {
      ...process.env,
      MPBC_STEP01_SMOKE: '1',
      MPBC_USER_DATA_DIR: userDataDirectory,
    },
  });

  if (result.error) {
    throw result.error;
  }

  assert.equal(result.signal, null, `Electron terminated by signal: ${result.signal}`);
  assert.equal(result.status, 0, `Electron exited with status: ${result.status}`);

  const logPath = join(userDataDirectory, 'logs', 'foundation.jsonl');
  const events = readFileSync(logPath, 'utf8')
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  assert.ok(events.some((entry) => entry.event === 'browser.navigation_completed'));
  assert.ok(events.some((entry) => entry.event === 'browser.navigation_failed'));
  assert.ok(events.some((entry) => entry.event === 'browser.surface_destroyed'));
  assert.ok(events.some((entry) => entry.event === 'step01.smoke_passed'));

  console.log('STEP 01 real Electron browser-engine smoke test passed.');
} finally {
  rmSync(userDataDirectory, { recursive: true, force: true });
}
