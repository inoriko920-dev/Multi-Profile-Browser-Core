import { spawnSync } from 'node:child_process';

const dryRun = process.argv.includes('--dry-run');
const probeNpm = process.argv.includes('--probe-npm');

const steps = [
  ['Install dependencies', ['ci']],
  ['Typecheck', ['run', 'typecheck']],
  ['Lint', ['run', 'lint']],
  ['Unit tests', ['test']],
  ['STEP 00 clean-shutdown smoke', ['run', 'smoke']],
  ['STEP 01 browser-engine smoke', ['run', 'smoke:browser']],
  ['STEP 02 offline harness smoke', ['run', 'smoke:step02']],
  ['Create safe local evidence checklist', ['run', 'step02:evidence']],
  ['Open STEP 02 manual browser test', ['run', 'step02']],
];

function printHeader() {
  console.log('============================================================');
  console.log('Multi-Profile-Browser-Core - STEP 02 Manual Test Runner');
  console.log('============================================================');
  console.log('');
  console.log('Runner ini tidak membaca/menyimpan password, OTP, cookie, token,');
  console.log('atau recovery code. Login Google tetap dilakukan manual.');
  console.log('');
}

function resolveNpmInvocation(args) {
  // When this runner is started by an npm script, npm_execpath points to
  // npm-cli.js. Running it through the current Node executable avoids trying
  // to spawn npm.cmd directly on Windows, which can fail with EINVAL.
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      args: [process.env.npm_execpath, ...args],
    };
  }

  // Fallback for someone running this file directly with `node ...` instead
  // of through `npm run`. On Windows, route the .cmd shim through cmd.exe.
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec ?? process.env.COMSPEC ?? 'cmd.exe',
      args: ['/d', '/s', '/c', 'npm.cmd', ...args],
    };
  }

  return {
    command: 'npm',
    args,
  };
}

function spawnNpm(args) {
  const invocation = resolveNpmInvocation(args);
  return spawnSync(invocation.command, invocation.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
}

function assertSpawnResult(result, label) {
  if (result.error) {
    throw result.error;
  }

  if (result.signal) {
    throw new Error(`${label} terminated by signal ${result.signal}.`);
  }

  if (result.status !== 0) {
    throw new Error(`${label} gagal dengan exit code ${result.status}.`);
  }
}

function runStep(index, label, args) {
  const position = `${index + 1}/${steps.length}`;
  console.log(`\n[${position}] ${label}`);
  console.log(`> npm ${args.join(' ')}`);

  if (dryRun) {
    return;
  }

  assertSpawnResult(spawnNpm(args), label);
}

printHeader();

try {
  if (probeNpm) {
    console.log('[probe] Verifikasi invokasi npm Windows/cross-platform...');
    console.log('> npm --version');
    assertSpawnResult(spawnNpm(['--version']), 'npm invocation probe');
    console.log('[probe] PASS: npm child process dapat dijalankan.');
  }

  steps.forEach(([label, args], index) => runStep(index, label, args));

  if (dryRun) {
    console.log('\nDry-run PASS: urutan STEP 02 manual runner valid.');
  } else {
    console.log('\nSemua gate otomatis selesai dan browser STEP 02 sudah ditutup.');
    console.log('Isi checklist evidence lokal dengan PASS/FAIL hasil tes manual.');
  }
} catch (error) {
  console.error('\n[STOP] STEP 02 runner dihentikan.');
  console.error(error instanceof Error ? error.message : String(error));
  console.error('Perbaiki gate yang gagal sebelum melanjutkan login manual.');
  process.exitCode = 1;
}
