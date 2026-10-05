import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { ShutdownState } from '../../src/main/recovery/shutdown-state';

test('tracks first-run, unclean, and clean lifecycle states', () => {
  const directory = mkdtempSync(join(tmpdir(), 'mpbc-shutdown-state-'));
  const statePath = join(directory, 'runtime', 'shutdown-state.json');

  try {
    const firstInstance = new ShutdownState(statePath);
    assert.equal(firstInstance.inspectPreviousRun(), 'first-run');

    firstInstance.markRunning('session-1');

    const afterRunning = new ShutdownState(statePath);
    assert.equal(afterRunning.inspectPreviousRun(), 'unclean');

    firstInstance.markClean();

    const afterClean = new ShutdownState(statePath);
    assert.equal(afterClean.inspectPreviousRun(), 'clean');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
