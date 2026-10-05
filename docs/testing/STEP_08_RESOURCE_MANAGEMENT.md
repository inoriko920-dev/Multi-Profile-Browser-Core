# STEP 08 — Resource Management

> Status: **PREPARED ONLY — BLOCKED by STEP 07**
>
> Dokumen ini adalah kontrak implementasi dan pengujian. Jangan menambahkan runtime Resource Management sebelum STEP 07 — Shortcut / Workspace selesai dan PASS.

## 1. Tujuan

STEP 08 memastikan aplikasi tetap stabil saat registry menyimpan puluhan sampai 100+ profile tanpa menyalakan seluruh browser profile secara bersamaan.

Prinsip inti:

```text
100+ stored profiles != 100+ active browser runtimes
```

Profile adalah identity + metadata + persistent partition di disk. Runtime adalah instance sementara yang hidup ketika profile benar-benar dibuka.

Target baseline:

```text
stored profiles : 100+
active runtime cap : 1
active browser surface : 1
```

Cap 3 atau 5 boleh dipertimbangkan kemudian hanya jika ada kebutuhan nyata dan setelah cap 1 terbukti stabil.

## 2. Sumber kebenaran

Urutan ownership:

```text
Profile Registry
   ↓
Profile Manager
   ↓
Runtime Manager
   ↓
BrowserBackend
   ↓
WebContentsView
```

`RuntimeManager` adalah satu-satunya komponen yang boleh memutuskan runtime mana yang:

- dibuat;
- aktif;
- idle;
- ditutup;
- di-evict;
- direcover setelah crash.

UI, Shortcut Manager, dan renderer tidak boleh membuat runtime/session sendiri.

## 3. Kontrak profile vs runtime

Contoh profile:

```text
profile_001 -> persist:profile_001
profile_002 -> persist:profile_002
profile_003 -> persist:profile_003
```

Ketika Profile 001 ditutup dari runtime:

```text
runtime ditutup
WebContentsView ditutup
listener/timer dilepas
persistent partition tetap ada di disk
registry tetap ada
login/session profile tidak dihapus
```

Membuka ulang Profile 001 harus memakai partition yang sama.

## 4. Runtime state machine

State minimum:

```text
closed
  ↓
starting
  ↓
active
  ↓
idle
  ↓
closing
  ↓
closed
```

Crash path:

```text
active/idle -> crashed -> closing/cleanup -> closed
```

Aturan:

- satu runtime tidak boleh memiliki dua state sekaligus;
- `starting` tidak boleh dipanggil ulang untuk profile yang sama;
- `closing` tidak boleh dibuka ulang sebelum cleanup selesai;
- `crashed` tidak boleh dianggap masih sehat;
- transition harus dicatat dengan metadata aman.

## 5. Interface konseptual

Contoh:

```ts
interface ProfileRuntime {
  runtimeId: string;
  profileId: string;
  state: 'starting' | 'active' | 'idle' | 'closing' | 'closed' | 'crashed';
  createdAt: number;
  lastUsedAt: number;
}

interface RuntimeManager {
  open(profileId: string): Promise<ProfileRuntime>;
  close(profileId: string): Promise<void>;
  switchTo(profileId: string): Promise<ProfileRuntime>;
  closeAll(): Promise<void>;
  getActive(): ProfileRuntime | null;
  listLive(): readonly ProfileRuntime[];
}
```

Renderer tidak menerima `partition` atau raw Electron `Session`.

## 6. Hard cap

Konfigurasi minimum:

```text
maxActiveRuntimes = 1
```

Invariant:

```text
liveRuntimeCount <= maxActiveRuntimes
```

Jika cap = 1 dan Profile A aktif lalu user membuka Profile B:

```text
A active
↓
A closing
↓
A closed
↓
B starting
↓
B active
```

Dilarang membuka B terlebih dahulu lalu baru menutup A jika hal itu membuat cap terlewati.

## 7. Serialized switching

Semua open/close/switch harus memakai queue/mutex profile-runtime yang jelas.

Scenario:

```text
klik A
langsung klik B
langsung klik C
```

Hasil harus deterministic.

Future implementation boleh memilih:

1. queue berurutan A -> B -> C; atau
2. coalesce menjadi target terakhir C.

Yang dilarang:

- A/B/C aktif bersamaan tanpa disengaja;
- dua `WebContentsView` memakai profile yang sama;
- UI menunjukkan C sementara runtime sebenarnya B;
- race membuka partition yang salah.

## 8. Idempotency

Repeated open harus aman.

```text
open(profile_001)
open(profile_001)
open(profile_001)
```

Expected:

- tetap satu runtime;
- tetap satu surface;
- tidak membuat session baru;
- runtime ID tidak berubah tanpa lifecycle reason;
- tidak menambah listener/timer setiap klik.

## 9. Eviction policy

Dengan cap 1, eviction sederhana: runtime lama ditutup sebelum target baru dibuka.

Jika cap >1 nanti diperlukan, kandidat eviction harus deterministic.

Policy kandidat:

- jangan pernah evict runtime `active`;
- jangan evict `starting`/`closing`;
- utamakan `idle`;
- gunakan `lastUsedAt` untuk LRU jika dibutuhkan;
- satu runtime hanya boleh dipilih satu operasi eviction;
- cleanup harus selesai sebelum slot dianggap tersedia.

Eviction tidak boleh menghapus data profile persistent.

## 10. Lifecycle WebContentsView

Saat runtime ditutup:

1. blok request baru ke runtime;
2. detach surface dari host window;
3. unsubscribe event listener milik runtime;
4. clear timer/interval internal;
5. hentikan download/navigation callback yang profile-scoped dengan aman;
6. panggil cleanup `webContents`/surface sesuai API Electron yang berlaku;
7. hapus runtime dari live registry;
8. jangan menghapus partition/profile data.

Cleanup harus idempotent.

## 11. Listener leak prevention

Setiap listener yang dibuat runtime wajib mempunyai owner dan cleanup path.

Contoh kategori:

- navigation events;
- title/url update;
- render-process-gone;
- did-fail-load;
- permission callback;
- popup/window-open handler;
- download events;
- IPC subscription profile-scoped;
- timer/interval.

Test harus membuktikan jumlah listener tidak meningkat terus setelah switching berulang.

## 12. Background workload policy

Profile inactive tidak boleh diam-diam tetap menjalankan website background hanya agar terlihat cepat.

Baseline:

```text
inactive profile runtime = closed
persistent session = tetap tersimpan
```

Dilarang pada STEP 08:

- preload seluruh 100 profile;
- refresh semua akun di background;
- membuka hidden WebContentsView untuk semua profile;
- menjalankan polling website per profile;
- keep-alive semua akun tanpa kebutuhan eksplisit.

## 13. Memory dan process observation

Tujuan diagnostic hanya untuk mengamati kecenderungan resource.

Boleh dicatat secara aman:

```text
runtime count
surface count
profileId
state
process count
approx memory usage
switch count
runtime age
lastUsedAt
```

Jangan mencatat:

```text
password
OTP
cookie value
Authorization header
access token
refresh token
session token
recovery code
raw page content sensitif
```

## 14. Performance budget awal

Budget bukan angka absolut lintas semua PC, tetapi invariant berikut wajib:

- menambah profile registry tidak menambah browser runtime;
- 100 profile registry tetap hanya menghasilkan runtime sesuai cap;
- memory setelah banyak switch boleh berfluktuasi tetapi tidak tumbuh tanpa batas;
- process count harus kembali mendekati baseline setelah runtime lama benar-benar ditutup;
- startup tidak otomatis membuka seluruh profile.

## 15. Registry scale

STEP 08 harus sudah mendukung simulasi metadata:

```text
10 profile
25 profile
50 profile
100 profile
```

Tidak perlu login 100 akun nyata.

Test scale dapat memakai profile metadata dummy/non-secret untuk membuktikan:

- listing;
- lookup;
- deterministic partition mapping;
- selection;
- runtime cap.

Login nyata tetap hanya pada subset profile yang dibutuhkan untuk isolation/persistence test.

## 16. Shutdown application

Saat app keluar normal:

1. stop menerima open/switch baru;
2. mark manager sebagai shutting down;
3. close semua live runtime;
4. cleanup surfaces/listeners;
5. flush metadata/log aman;
6. tulis clean-shutdown marker;
7. quit.

`closeAll()` harus aman jika dipanggil lebih dari sekali.

## 17. Crash boundary

Jika satu renderer/runtime crash:

- tandai runtime `crashed`;
- jangan mengubah partition mapping;
- cleanup runtime target;
- profile lain tidak boleh ikut rusak;
- registry tidak boleh di-reset;
- tidak boleh fallback diam-diam ke session anonim/profile lain.

Recovery penuh dibahas lagi di STEP 09.

## 18. Configuration

Contoh config future:

```json
{
  "runtime": {
    "maxActiveRuntimes": 1,
    "evictionPolicy": "close-current",
    "openTimeoutMs": 30000,
    "closeTimeoutMs": 15000
  }
}
```

Config harus divalidasi.

Nilai invalid seperti 0, negatif, NaN, atau terlalu besar harus fallback/error terkontrol.

## 19. Test matrix

### T08-01 — Default cap

Expected:

```text
maxActiveRuntimes = 1
```

Tidak ada runtime kedua yang hidup bersamaan pada baseline.

### T08-02 — A -> B -> C -> A

Switch berulang minimal 20 siklus.

Expected:

- selalu satu runtime aktif;
- profile/session tidak tertukar;
- runtime lama benar-benar ditutup.

### T08-03 — Repeated same-profile open

Klik/open profile yang sama minimal 50 kali.

Expected:

- satu runtime;
- satu surface;
- tidak ada listener growth abnormal.

### T08-04 — Rapid switching

Sequence cepat:

```text
A -> B -> C -> A -> C -> B -> A
```

Expected:

- deterministic;
- cap tidak terlewati;
- UI/runtime tidak mismatch.

### T08-05 — Persistent-session survival

1. login manual pada Profile A sesuai gate sebelumnya;
2. close runtime A;
3. buka B;
4. kembali A.

Expected:

- session A tetap sama;
- close runtime tidak menghapus persistent partition.

### T08-06 — 10 profile registry

Expected:

- list/lookup normal;
- live runtime count tetap <= cap.

### T08-07 — 25 profile registry

Expected sama.

### T08-08 — 50 profile registry

Expected sama.

### T08-09 — 100 profile registry

Expected:

- registry dapat dimuat;
- startup tidak membuka 100 browser;
- live runtime count tetap <= cap.

### T08-10 — Listener leak check

Lakukan >=100 switch.

Expected:

- listener count tidak bertambah linear dengan jumlah switch;
- tidak muncul warning MaxListeners yang berasal dari leak aplikasi.

### T08-11 — Timer cleanup

Expected:

- runtime closed tidak memiliki timer internal profile-scoped yang terus berjalan.

### T08-12 — Process cleanup

Expected:

- process/surface lama dilepas setelah close sesuai lifecycle Electron;
- tidak terjadi akumulasi orphan runtime.

### T08-13 — Crash one runtime

Expected:

- target runtime ditandai crashed/cleaned;
- profile registry lain tetap sehat;
- tidak otomatis berpindah identity.

### T08-14 — Shutdown with active runtime

Expected:

- closeAll terkontrol;
- clean-shutdown marker tetap benar.

### T08-15 — Shutdown while switching

Expected:

- tidak corrupt registry;
- tidak meninggalkan ownership ambigu;
- next launch dapat memulai dari state konsisten.

### T08-16 — Invalid config

Uji:

```text
maxActiveRuntimes = 0
maxActiveRuntimes = -1
maxActiveRuntimes = "100"
maxActiveRuntimes sangat besar
```

Expected:

- validation gagal aman atau fallback eksplisit;
- tidak ada silent unlimited runtime.

### T08-17 — Shortcut regression

Switch profile lalu gunakan shortcut.

Expected:

- shortcut selalu menuju runtime/profile aktif yang benar;
- resource manager tidak memutus source-of-truth STEP 07.

### T08-18 — Secret audit

Audit log/diagnostic/resource metrics.

Expected:

- tidak ada password, OTP, cookie value, access token, refresh token, recovery code.

## 20. Automated gate yang direncanakan

Setelah implementasi STEP 08 nanti, tambahkan test seperti:

```text
npm run smoke:step08
```

Smoke wajib membuktikan tanpa akun nyata:

- create dummy profile registry;
- open/switch runtime mock atau offline surface;
- hard cap enforcement;
- repeated-open idempotency;
- close/eviction cleanup;
- 100-profile registry tidak menghasilkan 100 runtime;
- clean shutdown.

Regression wajib tetap PASS:

```text
npm ci
npm run typecheck
npm run lint
npm test
npm run smoke
npm run smoke:browser
npm run smoke:step02
```

Ditambah seluruh smoke STEP 03–07 setelah step-step tersebut sudah diimplementasikan.

## 21. Security gate

Tetap wajib:

```text
nodeIntegration: false
contextIsolation: true
sandbox: true
webSecurity: true
HTTP(S)-only remote navigation
no credential automation
no cookie injection/export
no UA spoofing/anti-detection
```

Resource pressure tidak pernah menjadi alasan untuk menurunkan security.

## 22. STOP CONDITION

STOP dan jangan lanjut STEP 09 jika salah satu terjadi:

- hard cap dapat terlewati;
- duplicate runtime/surface muncul untuk profile yang sama;
- runtime closed masih memegang workload yang seharusnya sudah mati;
- switching menyebabkan profile/session tertukar;
- eviction menghapus persistent session;
- 100 profile hanya bisa bekerja dengan preload seluruh runtime;
- memory/process/listener bertambah tanpa batas pada stress test;
- shutdown dapat meninggalkan registry/runtime ownership corrupt;
- security baseline perlu diturunkan.

## 23. Definition of Done

STEP 08 hanya boleh dianggap selesai jika:

- STEP 07 sudah PASS;
- `RuntimeManager` menjadi satu source of truth runtime;
- default hard cap 1 terbukti;
- open/switch/close serialized dan idempotent;
- runtime cleanup terbukti;
- persistent session survive runtime eviction;
- 100 profile registry dapat dimuat tanpa 100 runtime;
- stress switching tidak menunjukkan leak linear;
- crash/shutdown boundary terkontrol;
- regression STEP 00–07 PASS;
- secret audit PASS.

Setelah itu baru **STEP 09 — Recovery System** boleh dimulai.