import { copyFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = new URL('../dist/src/renderer/index.html', import.meta.url);
await mkdir(dirname(fileURLToPath(target)), { recursive: true });
await copyFile(new URL('../src/renderer/index.html', import.meta.url), target);
