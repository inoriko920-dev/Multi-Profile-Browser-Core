# 00 — MASTER PLAN MULTI-PROFILE BROWSER CORE

> **Status:** Baseline implementasi pondasi  
> **Target awal:** Windows 11 desktop  
> **Fokus:** login manual, profile isolation, session persistence, stability  
> **Bukan fokus v1:** AI agent, automation, anti-detection, bypass CAPTCHA/anti-bot, rotasi akun untuk menghindari limit layanan

## 1. Tujuan proyek

Membangun satu pondasi browser desktop yang mampu menyimpan dan membuka banyak profile browser secara terisolasi. Setiap profile harus mempunyai session/cookies/storage sendiri dan tetap login setelah aplikasi ditutup lalu dibuka kembali.

Pondasi ini nantinya dapat dipakai ulang oleh aplikasi lain seperti workspace YouTube Studio, Google Drive, Google Flow, Gemini, ChatGPT, Claude, atau layanan web lain yang memang dikelola pengguna.

Prinsip inti:

- 100 profile tersimpan **bukan** berarti 100 browser aktif bersamaan.
- Login dilakukan manual pada situs resmi.
- Password, recovery code, 2FA, token sensitif, atau cookie hasil pencurian tidak disimpan oleh aplikasi.
- Session browser dikelola oleh Chromium/Electron, bukan dipindah-pindahkan secara manual.
- STEP berikutnya dilarang dimulai sebelum acceptance gate STEP sebelumnya PASS.

## 2. Keputusan teknologi baseline

### Desktop shell

- Electron.
- Chromium bawaan Electron.
- `WebContentsView` untuk remote web content.
- Hindari `BrowserView` untuk implementasi baru.
- Hindari `<webview>` sebagai arsitektur inti.

### Session model

Satu profile = satu persistent partition.

Contoh:

```text
profile_001 -> persist:profile_001
profile_002 -> persist:profile_002
profile_003 -> persist:profile_003
```

Jangan berbagi partition antar-profile.

### Registry

Gunakan registry lokal sederhana, direkomendasikan SQLite, untuk metadata profile. Registry hanya menyimpan metadata aplikasi, bukan password akun.

Contoh data:

```text
id            profile_001
name          YouTube Utama
partition     persist:profile_001
homepage      https://studio.youtube.com
status        active
created_at    ...
updated_at    ...
```

## 3. Arsitektur tingkat tinggi

```text
Application Shell
│
├── UI Minimal
│   ├── Profile List
│   ├── Add Profile
│   ├── Rename / Archive
│   ├── URL Bar
│   └── Back / Forward / Reload
│
├── Profile Manager
│   ├── Registry
│   ├── Lifecycle
│   └── Validation
│
├── Browser Backend
│   └── ElectronBrowserBackend
│       ├── createView
│       ├── attachView
│       ├── detachView
│       ├── navigate
│       ├── reload
│       ├── goBack / goForward
│       └── destroyView
│
├── Session Manager
│   ├── persistent partition
│   ├── permissions
│   └── per-profile isolation
│
├── Workspace / Shortcut
│   ├── YouTube Studio
│   ├── Google Drive
│   ├── Google Flow
│   ├── Gemini
│   ├── ChatGPT
│   ├── Claude
│   └── Custom URL
│
├── Diagnostics
│   ├── structured logging
│   ├── crash report
│   └── health state
│
└── Agent Bridge (interface only, belum diaktifkan)
```

## 4. BrowserBackend wajib dipisahkan

Jangan menempelkan seluruh aplikasi langsung ke API Electron. Semua operasi browser utama harus melalui abstraction `BrowserBackend`.

Kontrak minimum:

```text
createProfileSession(profileId)
openProfile(profileId)
closeProfile(profileId)
navigate(profileId, url)
reload(profileId)
goBack(profileId)
goForward(profileId)
getCurrentUrl(profileId)
getPageTitle(profileId)
destroyView(profileId)
```

Versi awal hanya mempunyai `ElectronBrowserBackend`. Tujuannya supaya profile manager, registry, dan UI tidak perlu ditulis ulang bila suatu hari browser engine diganti.

## 5. Profile lifecycle

State minimum:

```text
CREATED
  -> READY
  -> OPEN
  -> CLOSED
  -> ARCHIVED
  -> DELETED
```

Aturan:

- profile ID immutable;
- nama tampilan boleh diubah;
- partition tidak boleh berubah diam-diam;
- Archive lebih dahulu sebelum permanent delete;
- satu profile rusak tidak boleh merusak registry atau profile lain;
- operasi delete harus eksplisit dan tervalidasi.

## 6. Resource management

Target registry dapat 100+ profile, tetapi jumlah renderer aktif harus dibatasi.

Default yang disarankan:

```text
stored profiles: 100+
active profiles: 1
optional limit: 2 / 3 / 5
```

Saat profile tidak dipakai:

- detach/destroy view sesuai lifecycle;
- jangan meninggalkan renderer tanpa pemilik;
- jangan membuat timer/background loop per profile yang tidak aktif;
- lepaskan event listener;
- jangan menggandakan handler setiap profile dibuka ulang.

## 7. Security baseline — NON-NEGOTIABLE

Remote website dianggap tidak tepercaya.

Wajib:

- `nodeIntegration: false` untuk remote content;
- `contextIsolation: true`;
- sandbox diaktifkan jika kompatibel dengan arsitektur;
- jangan menonaktifkan `webSecurity` untuk menyelesaikan bug;
- validasi IPC sender dan payload;
- permission handler eksplisit;
- batasi navigation/open-window sesuai kebutuhan;
- jangan expose filesystem/Node API kepada halaman remote;
- jangan log password, token, cookie value, recovery code, atau isi credential.

Dilarang menjadikan solusi berikut sebagai workaround produksi:

```text
webSecurity: false
nodeIntegration: true
sandbox: false tanpa alasan tervalidasi
menyalin cookie antar-profile
menyimpan password plaintext
```

## 8. Compatibility Gate Google

Sebelum membangun multi-profile skala besar, implementasi harus membuktikan 1 profile terlebih dahulu.

Urutan wajib:

```text
Browser minimal
-> buka Google
-> login manual
-> buka YouTube/YouTube Studio
-> tutup aplikasi
-> buka kembali
-> session masih aktif?
```

Jika login tidak kompatibel dengan engine/flow yang dipilih, STOP dan evaluasi browser backend. Jangan melanjutkan pembuatan 100 profile sambil menyembunyikan masalah dengan spoofing, anti-detection, atau bypass keamanan.

## 9. Logging

Log minimum:

```text
app_started
profile_created
profile_open_requested
profile_session_ready
navigation_started
navigation_completed
navigation_failed
renderer_crashed
profile_closed
app_shutdown
```

Setiap event idealnya mempunyai:

```text
timestamp
level
event_name
profile_id (jika relevan)
url/domain aman (jika relevan)
error_code
error_message yang sudah disanitasi
```

Credential dan cookie value tidak boleh masuk log.

## 10. Struktur folder baseline

```text
src/
├── main/
│   ├── app/
│   ├── browser/
│   │   ├── BrowserBackend.*
│   │   └── ElectronBrowserBackend.*
│   ├── profiles/
│   ├── sessions/
│   ├── registry/
│   ├── diagnostics/
│   ├── security/
│   └── ipc/
├── preload/
└── renderer/
    ├── profile-list/
    ├── browser-toolbar/
    └── app-shell/

tests/
├── unit/
├── integration/
├── regression/
└── fixtures/

docs/
├── planning/
└── adr/
```

Data runtime jangan dicampur dengan source code.

```text
userData/
├── registry/
├── profiles/
├── logs/
├── recovery/
└── backups/
```

## 11. Error handling

Kategori error minimum:

- profile registry error;
- partition/session initialization error;
- navigation failure;
- renderer crash;
- browser-process crash;
- invalid profile state;
- corrupt metadata;
- failed cleanup;
- disk/storage error.

Prinsip:

- fail satu profile, bukan seluruh aplikasi;
- jangan swallow exception tanpa log;
- error UI harus memberikan tindakan jelas: retry, close profile, inspect log;
- recovery tidak boleh menghapus profile otomatis;
- write registry harus atomic atau transactional.

## 12. Roadmap implementasi STEP 00–16

### STEP 00 — Project Foundation

Setup Electron project, dependency lock, folder structure, config, logging dasar, crash handling, coding convention.

**PASS:** app dapat start/close bersih dan log lifecycle tersedia.

### STEP 01 — Browser Engine Minimal

Satu window + satu `WebContentsView`, navigation dasar, URL bar minimal.

**PASS:** situs umum dapat dibuka tanpa error arsitektur.

### STEP 02 — Google Login Compatibility Gate

Uji login manual 1 akun Google pada browser yang dipilih.

**PASS:** login berhasil secara normal dan halaman target dapat digunakan.

**FAIL:** jangan lanjut ke STEP 03 sebelum akar masalah kompatibilitas selesai.

### STEP 03 — Persistent Single Profile

Implementasikan persistent partition dan restart test.

**PASS:** login masih ada setelah app restart dan restart Windows.

### STEP 04 — Profile Registry & Manager

Create, rename, archive, restore, delete permanen dengan lifecycle tervalidasi.

### STEP 05 — Multi-Profile Isolation

Minimal 3 akun berbeda.

**PASS:** cookies/storage/login tidak bocor antar-profile.

### STEP 06 — Profile Launcher

Klik profile harus selalu membuka partition yang tepat.

### STEP 07 — Workspace/Shortcut

Shortcut hanyalah navigation preset; tidak ada automation khusus.

### STEP 08 — Resource Management

Batasi active renderer; cleanup listener/view; ukur RAM dan handle leak.

### STEP 09 — Recovery System

Uji renderer crash, app crash, registry recovery, abnormal shutdown.

### STEP 10 — Logging & Diagnostics

Structured logs, sanitization, export diagnostics, error correlation.

### STEP 11 — 3 Profile Stability Gate

Tiga profile login nyata harus stabil melalui open/close/restart cycle.

### STEP 12 — 10 Profile Gate

Registry dan switching tetap benar; tidak perlu 10 renderer aktif.

### STEP 13 — 25 Profile Gate

Validasi startup time, search/list performance, registry integrity.

### STEP 14 — 50 Profile Gate

Validasi lifecycle berulang dan tidak ada degradasi fatal.

### STEP 15 — 100 Profile Registry Gate

100 profile dapat diregistrasikan, dicari, dibuka secara bergantian, ditutup, dan dipersist tanpa merusak isolation.

### STEP 16 — Foundation v1.0 Freeze

Freeze pondasi setelah seluruh acceptance gate dan regression suite PASS.

## 13. Agent Bridge untuk masa depan

AI agent **tidak diimplementasikan pada pondasi awal**, tetapi boundary boleh disiapkan.

Interface masa depan dapat mencakup:

```text
getCurrentUrl()
getPageTitle()
getDomSnapshot()
screenshot()
click()
type()
scroll()
navigate()
```

Agent tidak boleh mempunyai akses credential store secara otomatis. Login/password/2FA/CAPTCHA harus menjadi human-controlled boundary.

## 14. Definition of Done pondasi

Foundation v1.0 hanya boleh dinyatakan selesai bila:

- satu profile dapat login dan session persistent;
- minimal tiga profile nyata terisolasi;
- restart app tidak menghilangkan session yang valid;
- registry tahan restart/abnormal shutdown;
- profile switch tidak salah partition;
- 100 profile registry test PASS;
- resource cleanup PASS;
- security regression PASS;
- tidak ada workaround `webSecurity: false` atau credential handling tidak aman;
- seluruh acceptance criteria di `01_TEST_PLAN_MULTI_PROFILE_BROWSER_CORE.md` PASS.

## 15. Aturan untuk SOL

1. Kerjakan satu STEP pada satu waktu.
2. Jangan memperluas scope UI sebelum core stabil.
3. Jangan menambahkan AI/automation sebelum Foundation v1.0 freeze.
4. Jika acceptance test FAIL, perbaiki akar masalah dan jalankan regression lagi.
5. Jangan mengubah session/partition strategy tanpa ADR.
6. Jangan membuat solusi anti-detection/bypass untuk memaksa login.
7. Setiap bug reproduktif harus mempunyai log/evidence.
8. Commit harus menyebut STEP atau bug yang diselesaikan.

---

Dokumen ini adalah pasangan Markdown untuk master plan DOCX. Untuk implementasi, baca bersama `01_TEST_PLAN_MULTI_PROFILE_BROWSER_CORE.md`.
