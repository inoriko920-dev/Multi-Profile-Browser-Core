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

Versi DOCX adalah master untuk dibaca manusia dan disimpan sebagai arsip proyek. Versi Markdown adalah sumber yang mudah dibaca GitHub, dicari, dibandingkan melalui Git, dan digunakan implementer/AI.

## Roadmap implementasi

- STEP 00 — Project Foundation
- STEP 01 — Minimal Browser Engine
- STEP 02 — Google Login Compatibility Gate
- STEP 03 — Persistent Profile
- STEP 04 — Profile Manager
- STEP 05 — Multi-Profile Isolation
- STEP 06 — Profile Launcher
- STEP 07 — Shortcut / Workspace
- STEP 08 — Resource Management
- STEP 09 — Recovery System
- STEP 10 — Logging & Diagnostics
- STEP 11 — 3 Account Stability Test
- STEP 12 — 10 Profile Test
- STEP 13 — 25 Profile Test
- STEP 14 — 50 Profile Test
- STEP 15 — 100 Profile Registry Test
- STEP 16 — Foundation v1.0 Freeze

**Aturan keras:** STEP berikutnya tidak boleh dianggap selesai bila acceptance test STEP sebelumnya masih gagal.

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
  ├─ BrowserBackend
  │    └─ Electron / Chromium
  ├─ Persistent Session Manager
  ├─ Workspace / Shortcut Manager
  ├─ Logging & Diagnostics
  ├─ Recovery Manager
  └─ AgentBridge (interface saja, implementasi nanti)
```

Setiap profile menggunakan persistent partition sendiri. Session/cookie tidak dipindahkan manual antar profile.

## Status

**Fase saat ini: Planning / Foundation Preparation**

Implementasi source code belum boleh dianggap dimulai sebelum STEP 00 mengikuti Master Plan dan Test Plan.