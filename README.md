# Multi-Profile-Browser-Core

Pondasi browser multi-profile yang dirancang untuk menyimpan banyak sesi login secara terpisah dan stabil. Repo ini **bukan** aplikasi akhir untuk YouTube, Google Drive, Google Flow, ChatGPT, Gemini, Claude, atau layanan tertentu. Semua aplikasi tersebut nantinya dapat dibangun sebagai modul/produk di atas core ini.

## Goal utama

Membangun browser core yang mampu:

- membuat banyak browser profile terisolasi;
- menjaga cookies, local storage, cache, dan session tetap terpisah antar profile;
- mempertahankan login setelah aplikasi ditutup dan dibuka kembali;
- membuka website normal seperti browser biasa;
- menangani crash/recovery tanpa merusak profile lain;
- menyimpan 100+ profile tanpa harus menjalankan semuanya sekaligus;
- menyediakan pondasi yang nantinya dapat diberi AI Agent/automation layer tanpa mengubah core session manager.

## Prioritas proyek

Urutan prioritas tidak boleh dibalik:

1. Stabilitas browser engine.
2. Login compatibility.
3. Persistent session.
4. Isolation antar profile.
5. Recovery dan logging.
6. Resource management.
7. Scale test.
8. Baru fitur tambahan.

UI pada fase pondasi dibuat sesederhana mungkin.

## Dokumen wajib

Sebelum implementasi, baca:

- [`00_MASTER_PLAN_MULTI_PROFILE_BROWSER_CORE.md`](docs/planning/00_MASTER_PLAN_MULTI_PROFILE_BROWSER_CORE.md)
- [`01_TEST_PLAN_MULTI_PROFILE_BROWSER_CORE.md`](docs/planning/01_TEST_PLAN_MULTI_PROFILE_BROWSER_CORE.md)
- [`docs/planning/README.md`](docs/planning/README.md)
- [`STEP_02_GOOGLE_LOGIN_COMPATIBILITY.md`](docs/testing/STEP_02_GOOGLE_LOGIN_COMPATIBILITY.md)
- [`STEP_03_PERSISTENT_SINGLE_PROFILE.md`](docs/testing/STEP_03_PERSISTENT_SINGLE_PROFILE.md) — **persiapan saja; BLOCKED sampai STEP 02 PASS**
- [`STEP_04_PROFILE_MANAGER.md`](docs/testing/STEP_04_PROFILE_MANAGER.md) — **persiapan saja; BLOCKED sampai STEP 03 PASS**
- [`STEP_05_MULTI_PROFILE_ISOLATION.md`](docs/testing/STEP_05_MULTI_PROFILE_ISOLATION.md) — **persiapan saja; BLOCKED sampai STEP 04 PASS**
- [`STEP_06_PROFILE_LAUNCHER.md`](docs/testing/STEP_06_PROFILE_LAUNCHER.md) — **persiapan saja; BLOCKED sampai STEP 05 PASS**
- [`STEP_07_SHORTCUT_WORKSPACE.md`](docs/testing/STEP_07_SHORTCUT_WORKSPACE.md) — **persiapan saja; BLOCKED sampai STEP 06 PASS**
- [`STEP_08_RESOURCE_MANAGEMENT.md`](docs/testing/STEP_08_RESOURCE_MANAGEMENT.md) — **persiapan saja; BLOCKED sampai STEP 07 PASS**
- [`STEP_09_RECOVERY_SYSTEM.md`](docs/testing/STEP_09_RECOVERY_SYSTEM.md) — **persiapan saja; BLOCKED sampai STEP 08 PASS**
- [`STEP_10_LOGGING_DIAGNOSTICS.md`](docs/testing/STEP_10_LOGGING_DIAGNOSTICS.md) — **persiapan saja; BLOCKED sampai STEP 09 PASS**
- [`STEP_11_3_ACCOUNT_STABILITY_TEST.md`](docs/testing/STEP_11_3_ACCOUNT_STABILITY_TEST.md) — **persiapan saja; BLOCKED sampai STEP 10 PASS**
- [`STEP_12_10_PROFILE_TEST.md`](docs/testing/STEP_12_10_PROFILE_TEST.md) — **persiapan saja; BLOCKED sampai STEP 11 PASS**
- [`STEP_13_25_PROFILE_TEST.md`](docs/testing/STEP_13_25_PROFILE_TEST.md) — **persiapan saja; BLOCKED sampai STEP 12 PASS**
- [`STEP_14_50_PROFILE_TEST.md`](docs/testing/STEP_14_50_PROFILE_TEST.md) — **persiapan saja; BLOCKED sampai STEP 13 PASS**

Versi DOCX adalah master untuk dibaca manusia dan disimpan sebagai arsip proyek. Versi Markdown adalah sumber yang mudah dibaca GitHub, dicari, dibandingkan melalui Git, dan digunakan implementer/AI.

## Roadmap implementasi

- ✅ STEP 00 — Project Foundation
- ✅ STEP 01 — Minimal Browser Engine
- ⏳ STEP 02 — Google Login Compatibility Gate
- ⛔ STEP 03 — Persistent Profile (**prepared, blocked by STEP 02**)
- ⛔ STEP 04 — Profile Manager (**prepared, blocked by STEP 03**)
- ⛔ STEP 05 — Multi-Profile Isolation (**prepared, blocked by STEP 04**)
- ⛔ STEP 06 — Profile Launcher (**prepared, blocked by STEP 05**)
- ⛔ STEP 07 — Shortcut / Workspace (**prepared, blocked by STEP 06**)
- ⛔ STEP 08 — Resource Management (**prepared, blocked by STEP 07**)
- ⛔ STEP 09 — Recovery System (**prepared, blocked by STEP 08**)
- ⛔ STEP 10 — Logging & Diagnostics (**prepared, blocked by STEP 09**)
- ⛔ STEP 11 — 3 Account Stability Test (**prepared, blocked by STEP 10**)
- ⛔ STEP 12 — 10 Profile Test (**prepared, blocked by STEP 11**)
- ⛔ STEP 13 — 25 Profile Test (**prepared, blocked by STEP 12**)
- ⛔ STEP 14 — 50 Profile Test (**prepared, blocked by STEP 13**)
- STEP 15 — 100 Profile Registry Test
- STEP 16 — Foundation v1.0 Freeze

**Aturan keras:** STEP berikutnya tidak boleh dianggap selesai bila acceptance test STEP sebelumnya masih gagal.

## Local development

Baseline memakai Node.js 24 dan dependency yang dipin exact di `package.json` / `package-lock.json`.

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run smoke
npm run smoke:browser
npm run smoke:step02
npm run step02:manual:ci
npm start
```

`npm run smoke` membuktikan bootstrap + clean-shutdown STEP 00.

`npm run smoke:browser` membuktikan browser engine STEP 01 pada real Electron: HTTPS navigation, Back, Forward, Reload, controlled navigation failure, dan cleanup `WebContentsView`.

`npm run smoke:step02` membuktikan harness STEP 02 dapat start dengan flag khusus, membuat tepat satu browser surface, mengenali mode manual compatibility, lalu quit bersih tanpa mencoba login atau mengakses credential.

`npm run step02:manual:ci` hanya memvalidasi urutan one-click runner tanpa membuka login Google.

## Cara termudah menjalankan STEP 02 di Windows

Setelah `git pull`, cukup double-click:

```text
RUN_STEP02_TEST.bat
```

Launcher tersebut akan menjalankan secara berurutan:

```text
npm ci
→ typecheck
→ lint
→ unit tests
→ STEP 00 smoke
→ STEP 01 browser smoke
→ STEP 02 offline smoke
→ membuat evidence lokal
→ membuka STEP 02 untuk login Google manual
```

Jika satu gate gagal, launcher **STOP** dan tidak melanjutkan ke login. Password, OTP, cookie, token, dan recovery code tidak dibaca atau disimpan oleh launcher.

Alternatif melalui terminal:

```bash
npm run step02:manual
```

## Menjalankan STEP 02 secara langsung

Jika semua regression gate sudah PASS dan hanya ingin membuka browser test:

```bash
npm run step02
```

Mode STEP 02 langsung membuka halaman Login Google dan menampilkan shortcut lokal:

```text
Login Google
Google
YouTube
YouTube Studio
```

Login, password, 2FA, CAPTCHA/security challenge tetap dilakukan manual oleh pengguna. Mode ini masih memakai session **memory-only**; jangan mengharapkan login bertahan setelah aplikasi ditutup. Persistence baru boleh dibuat di STEP 03 setelah compatibility gate PASS.

## Yang sudah tersedia

Browser core saat ini mempunyai:

- `BrowserBackend` abstraction;
- `ElectronBrowserBackend` berbasis `WebContentsView`;
- URL bar;
- Back / Forward / Reload;
- HTTP(S)-only URL policy;
- validated shell IPC;
- sandboxed remote surface;
- structured navigation logging;
- explicit browser-surface cleanup;
- shortcut STEP 02 untuk Google/YouTube targets;
- one-click Windows runner untuk STEP 02;
- session **in-memory/non-persistent** untuk compatibility test.

Persistent partition **belum diaktifkan**. STEP 03 baru disiapkan sebagai dokumen/issue dan tetap diblokir sampai Google Login Compatibility Gate PASS.

## Non-goals fase pondasi

Belum dikerjakan pada fase ini:

- AI Agent;
- automation website;
- auto login password/2FA;
- anti-detection atau bypass keamanan layanan;
- dashboard kompleks;
- UI mewah;
- aplikasi khusus Google Flow/Drive/YouTube;
- rotasi akun untuk mengakali kuota atau pembatasan layanan.

## Arsitektur target ringkas

```text
App Shell
  ├─ Profile Manager
  ├─ Runtime Manager
  ├─ BrowserBackend
  │    └─ Electron / Chromium
  ├─ Persistent Session Manager
  ├─ Workspace / Shortcut Manager
  ├─ Recovery Manager
  ├─ Structured Logger
  ├─ Diagnostics Service
  └─ AgentBridge (interface saja, implementasi nanti)
```

Setiap profile nantinya menggunakan persistent partition sendiri. Session/cookie tidak dipindahkan manual antar profile. Banyak profile boleh tersimpan, tetapi jumlah runtime hidup dibatasi oleh Runtime Manager.

## Status

**STEP 00: PASS.** Repository foundation, logging, recovery marker, strict toolchain, unit test, dan real Electron clean-shutdown smoke sudah lolos Windows CI.

**STEP 01: PASS.** Minimal `WebContentsView` browser engine, navigation, history, URL validation, security boundary, dan cleanup sudah lolos Windows CI. PR #4 sudah di-merge.

**Fase saat ini: STEP 02 — Google Login Compatibility Gate.**

Harness manual STEP 02 sudah disiapkan. Issue #5 tetap OPEN sampai satu login Google manual, Google, YouTube, YouTube Studio, serta Back/Forward/Reload terbukti PASS tanpa bypass/anti-detection hack.

**STEP 03 sudah dipersiapkan, tetapi belum diimplementasikan.** Issue implementasinya harus tetap BLOCKED sampai Issue #5 ditutup sebagai completed.

**STEP 04 sudah dipersiapkan sebagai kontrak Profile Manager.** Issue implementasinya tetap BLOCKED sampai STEP 03 selesai dan persistent session terbukti stabil.

**STEP 05 sudah dipersiapkan sebagai kontrak Multi-Profile Isolation.** Issue implementasinya tetap BLOCKED sampai STEP 04 selesai.

**STEP 06 sudah dipersiapkan sebagai kontrak Profile Launcher.** Issue implementasinya tetap BLOCKED sampai STEP 05 selesai.

**STEP 07 sudah dipersiapkan sebagai kontrak Shortcut / Workspace.** Issue implementasinya tetap BLOCKED sampai STEP 06 selesai.

**STEP 08 sudah dipersiapkan sebagai kontrak Resource Management.** Issue implementasinya tetap BLOCKED sampai STEP 07 selesai. Baseline targetnya menyimpan 100+ profile tanpa menjalankan semuanya bersamaan, dengan `maxActiveRuntimes = 1` terlebih dahulu.

**STEP 09 sudah dipersiapkan sebagai kontrak Recovery System.** Issue implementasinya tetap BLOCKED sampai STEP 08 selesai. Recovery wajib memakai `render-process-gone` untuk renderer, `child-process-gone` untuk GPU/utility process, bounded retry, unclean-shutdown detection, dan safe mode tanpa mengganti profile/partition.

**STEP 10 sudah dipersiapkan sebagai kontrak Logging & Diagnostics.** Issue implementasinya tetap BLOCKED sampai STEP 09 selesai. Fokusnya adalah structured logging, centralized secret redaction, bounded retention, Electron process metrics, safe diagnostic bundle, dan secret scan tanpa membaca cookie/token/DOM.

**STEP 11 sudah dipersiapkan sebagai 3 Account Stability Test.** Issue implementasinya tetap BLOCKED sampai STEP 10 selesai. Gate ini memakai tiga profile/account nyata untuk membuktikan persistence, isolation, switching, runtime cap, recovery, unclean-shutdown handling, dan diagnostics end-to-end sebelum scale test 10/25/50/100 profile.

**STEP 12 sudah dipersiapkan sebagai 10 Profile Test.** Issue implementasinya tetap BLOCKED sampai STEP 11 selesai. Gate ini memakai tiga real-account profile dari STEP 11 ditambah tujuh test profile, menguji 10-profile registry persistence, 100+ deterministic switches, lifecycle operations, hard runtime cap, recovery, diagnostics, resource behavior, dan secret scan tanpa mewajibkan 10 akun nyata.

**STEP 13 sudah dipersiapkan sebagai 25 Profile Test.** Issue implementasinya tetap BLOCKED sampai STEP 12 selesai. Gate ini memakai tiga real-account profile sebagai canary dan 22 test profile, menguji 25-profile registry persistence, 250+ deterministic switches, lifecycle mutation lintas rentang, hard runtime cap, background inactivity, recovery, diagnostics, resource trends, registry invariants, dan secret scan tanpa mewajibkan 25 akun nyata.

**STEP 14 sudah dipersiapkan sebagai 50 Profile Test.** Issue implementasinya tetap BLOCKED sampai STEP 13 selesai. Gate ini memakai tiga real-account profile sebagai isolation canary dan 47 test profile, menguji 50-profile registry persistence, 500+ deterministic switches, registry load/reload latency, lifecycle mutation lintas rentang, repeated restart, hard runtime cap, background inactivity, recovery, diagnostics, resource trends, registry corruption boundary, dan secret scan tanpa mewajibkan 50 akun nyata.
