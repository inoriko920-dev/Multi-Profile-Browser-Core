import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const electronExecutable = require('electron');
const userDataDirectory = mkdtempSync(join(tmpdir(), 'mpbc-step02-smoke-'));

try {
  const result = spawnSync(electronExecutable, ['.', '--step02'], {
    stdio: 'inherit',
    timeout: 30000,
    env: {
      ...process.env,
      MPBC_STEP02_HARNESS_SMOKE: '1',
      MPBC_USER_DATA_DIR: userDataDirectory,
    },
  });

  if (result.error) {
    throw result.error;
  }

  assert.equal(result.signal, null, `Electron terminated by signal: ${result.signal}`);
  assert.equal(result.status, 0, `Electron exited with status: ${result.status}`);

  const logPath = join(userDataDirectory, 'logs', 'foundation.jsonl');
  const logEntries = readFileSync(logPath, 'utf8')
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const startEntry = logEntries.find((entry) => entry.event === 'app.start');
  assert.equal(startEntry?.context?.mode, 'step02-manual-compatibility');

  const passEntry = logEntries.find((entry) => entry.event === 'step02.harness_smoke_pass');
  assert.ok(passEntry, 'Expected step02.harness_smoke_pass log entry.');
  assert.equal(passEntry.context?.surfaceCount, 1);
  assert.equal(passEntry.context?.remoteLoginAttempted, false);

  console.log('STEP 02 offline compatibility harness smoke test passed.');
} finally {
  rmSync(userDataDirectory, { recursive: true, force: true });
}
