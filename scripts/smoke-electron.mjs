import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire(import.meta.url);
const electronExecutable = require('electron');

const child = spawn(electronExecutable, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MPBC_SMOKE_TEST: '1',
  },
});

const timeout = setTimeout(() => {
  console.error('Electron smoke test timed out.');
  child.kill();
  process.exit(1);
}, 30000);

timeout.unref();

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  clearTimeout(timeout);

  if (signal) {
    console.error(`Electron smoke test terminated by signal: ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
