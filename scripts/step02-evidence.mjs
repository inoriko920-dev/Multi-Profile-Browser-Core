import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { arch, platform, release, type } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const ciMode = args.has('--ci');

function safeExec(command, commandArgs) {
  try {
    return execFileSync(command, commandArgs, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

function readPackageJson() {
  return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/gu, '-');
}

const pkg = readPackageJson();
const electronVersion = pkg.devDependencies?.electron ?? 'unknown';
const commitSha = safeExec('git', ['rev-parse', 'HEAD']);
const branchName = safeExec('git', ['branch', '--show-current']);
const generatedAt = new Date().toISOString();

const report = `# STEP 02 — Manual Google Login Compatibility Evidence\n\n> SAFE EVIDENCE ONLY. Jangan menulis email akun, password, OTP, recovery code, cookie, access token, refresh token, atau credential lain di file ini.\n\n## Environment\n\n- Generated: ${generatedAt}\n- OS: ${type()} ${release()}\n- Platform: ${platform()}\n- Architecture: ${arch()}\n- Node: ${process.version}\n- Electron package: ${electronVersion}\n- Git branch: ${branchName || 'unknown'}\n- Commit SHA: ${commitSha}\n\n## Automated preflight\n\nJalankan sebelum test manual:\n\n- [ ] npm ci\n- [ ] npm run typecheck\n- [ ] npm run lint\n- [ ] npm test\n- [ ] npm run smoke\n- [ ] npm run smoke:browser\n- [ ] npm run smoke:step02\n\n## Manual gate\n\nJalankan: \`npm run step02\`\n\n### T02-01 — Google login page\n- [ ] PASS\n- [ ] FAIL/BLOCKED\n- Catatan non-sensitif:\n\n### T02-02 — Manual login\n- [ ] PASS\n- [ ] FAIL/BLOCKED\n- Password/2FA/CAPTCHA diselesaikan manual: [ ] YA\n- Tidak menggunakan spoofing/bypass: [ ] YA\n- Catatan non-sensitif:\n\n### T02-03 — Service access dalam session yang sama\n- [ ] Google PASS\n- [ ] YouTube PASS\n- [ ] YouTube Studio PASS\n- Catatan non-sensitif:\n\n### T02-04 — Navigation regression\n- [ ] Back PASS\n- [ ] Forward PASS\n- [ ] Reload PASS\n- [ ] YouTube -> YouTube Studio -> YouTube PASS\n- Catatan non-sensitif:\n\n## Security review setelah test\n\n- [ ] Tidak ada password/OTP/cookie/token di evidence.\n- [ ] Tidak ada password/OTP/cookie/token di log aplikasi.\n- [ ] Tidak menurunkan webSecurity/sandbox/contextIsolation.\n- [ ] Tidak menambahkan user-agent spoofing, anti-detection, atau CAPTCHA bypass.\n\n## Final result\n\n- [ ] STEP 02 PASS — boleh lanjut STEP 03.\n- [ ] STEP 02 FAIL/BLOCKED — STOP dan evaluasi kompatibilitas.\n\nError non-sensitif bila ada:\n`;

if (ciMode) {
  process.stdout.write(report);
  process.exit(0);
}

const outputDirectory = join(process.cwd(), 'evidence', 'step02');
mkdirSync(outputDirectory, { recursive: true });
const outputPath = join(outputDirectory, `STEP_02_EVIDENCE_${nowStamp()}.md`);
writeFileSync(outputPath, report, 'utf8');

console.log(`Safe STEP 02 evidence template created: ${outputPath}`);
console.log('Do not add passwords, OTPs, cookies, tokens, or recovery codes to this file.');
