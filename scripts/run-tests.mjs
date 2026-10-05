import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function collectTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTests(path)));
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(path);
    }
  }

  return files.sort();
}

const compiledTestsDirectory = fileURLToPath(new URL('../dist/tests', import.meta.url));
const testFiles = await collectTests(compiledTestsDirectory);

if (testFiles.length === 0) {
  console.error('No compiled test files found.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...testFiles], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
