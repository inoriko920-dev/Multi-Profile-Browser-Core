# STEP 05 — Multi-Profile Isolation

> **STATUS: BLOCKED oleh STEP 04 / Issue #13.** Dokumen ini hanya persiapan. Jangan mengaktifkan multi-profile isolation runtime sampai Profile Manager pada STEP 04 sudah PASS.

## Tujuan

Membuktikan bahwa beberapa profile persistent benar-benar terisolasi satu sama lain sehingga setiap profile selalu menggunakan session miliknya sendiri dan tidak terjadi kebocoran identitas akun, cookie, localStorage, cache, permission state, atau data browser lain antar profile.

STEP 05 bukan tahap scale test. Target awal cukup **3 profile** untuk membuktikan kontrak isolation sebelum launcher, resource management, dan pengujian 10/25/50/100 profile.

## Preconditions wajib

Sebelum implementasi STEP 05:

- STEP 00 PASS;
- STEP 01 PASS;
- STEP 02 PASS;
- STEP 03 PASS;
- STEP 04 PASS;
- registry profile stabil setelah restart;
- create/rename/archive/unarchive/delete pada STEP 04 sudah lolos regression;
- tidak ada secret pada registry/log/evidence.

Jika salah satu belum PASS, STEP 05 tetap BLOCKED.

## Kontrak identity profile

Contoh mapping:

```text
profile_001 -> persist:profile_001
profile_002 -> persist:profile_002
profile_003 -> persist:profile_003
```

Aturan:

1. `profileId` immutable setelah dibuat.
2. `partition` diturunkan dari immutable profile ID, bukan display name.
3. Display name boleh berubah tanpa mengubah partition.
4. Registry harus memiliki mapping satu-ke-satu profile ID -> partition.
5. Dua profile tidak boleh memiliki partition yang sama.
6. Partition tidak boleh dibentuk ulang secara acak saat startup.
7. Surface browser harus menerima session descriptor profile yang dipilih secara eksplisit.

## Definisi isolation

Isolation dianggap benar hanya bila seluruh lapisan berikut tidak bocor silang:

```text
Profile identity
Persistent partition
Cookies
Local storage
Session storage
IndexedDB
Cache
Service worker state
Permission state
Authentication session
Navigation history aktif
Download/temporary state yang profile-scoped bila nanti dipakai
```

STEP 05 tidak perlu mengekspor atau membaca isi secret untuk membuktikan isolation. Pengujian cukup menggunakan state aman dan observasi login manual.

## Scope STEP 05

Yang boleh dibuat:

- dukungan membuka Profile 001, 002, dan 003;
- binding surface -> profile ID -> partition;
- switching profile terkontrol;
- test helper non-secret untuk memverifikasi mapping;
- smoke test offline untuk memastikan tiga descriptor berbeda;
- manual test dengan akun berbeda;
- restart test;
- crash boundary test;
- diagnostic non-secret untuk profile mismatch.

Yang belum boleh dibuat:

- menjalankan puluhan profile aktif sekaligus;
- 10/25/50/100 profile stress test;
- AI Agent;
- website automation;
- auto-login password/OTP;
- CAPTCHA automation;
- user-agent spoofing;
- fingerprint spoofing;
- anti-detection;
- rotasi akun untuk menghindari limit layanan;
- import/export/copy cookie atau token antar profile.

## Model data yang disarankan

Contoh metadata non-secret:

```json
{
  "id": "profile_002",
  "displayName": "Profile 002",
  "partition": "persist:profile_002",
  "status": "active",
  "createdAt": "ISO-8601 timestamp",
  "updatedAt": "ISO-8601 timestamp"
}
```

Dilarang menaruh pada registry:

```text
password
otp
recoveryCode
cookieValue
accessToken
refreshToken
sessionToken
authorizationHeader
```

## BrowserSessionDescriptor

Kontrak yang disarankan:

```text
BrowserSessionDescriptor
├── profileId
├── partition
└── persistence
```

Contoh:

```text
Profile 001
profileId   = profile_001
partition   = persist:profile_001
persistence = persistent

Profile 002
profileId   = profile_002
partition   = persist:profile_002
persistence = persistent

Profile 003
profileId   = profile_003
partition   = persist:profile_003
persistence = persistent
```

Validator wajib menolak:

- profileId kosong;
- partition kosong;
- partition tanpa prefix `persist:` untuk profile persistent;
- profile ID yang tidak cocok dengan suffix partition;
- duplicate partition;
- profile archived yang dibuka tanpa flow yang mengizinkan unarchive/open.

## Lifecycle switching

Target flow sederhana:

```text
Open Profile 001
→ destroy/detach active surface secara aman
→ resolve descriptor Profile 002
→ validate mapping
→ create surface dengan persist:profile_002
→ navigate
```

Pada STEP 05 lebih aman memulai dengan **satu active surface pada satu waktu**. Jangan langsung membuat tiga WebContentsView aktif bersamaan bila belum dibutuhkan.

## Aturan switching

- switching tidak boleh mengubah registry;
- switching tidak boleh copy cookie/session;
- switching tidak boleh mengubah partition profile asal;
- switching harus menutup/detach surface lama dengan benar;
- surface baru harus dibuat memakai descriptor target sebelum navigation pertama;
- state UI aktif harus menunjukkan profile yang benar;
- jika descriptor invalid, navigation target harus diblokir.

## Manual test matrix

### T05-00 — Regression prerequisites

Jalankan seluruh gate sebelumnya.

PASS bila tidak ada regression pada STEP 00–04.

### T05-01 — Create three profiles

Siapkan:

```text
profile_001
profile_002
profile_003
```

PASS bila ketiganya memiliki ID dan partition unik.

### T05-02 — Offline descriptor isolation

Tanpa login akun:

- open Profile 001;
- verifikasi active descriptor `persist:profile_001`;
- switch Profile 002;
- verifikasi `persist:profile_002`;
- switch Profile 003;
- verifikasi `persist:profile_003`.

Tidak boleh ada duplicate mapping.

Target automated test setelah implementasi:

```bash
npm run smoke:step05
```

### T05-03 — Manual account isolation

Gunakan tiga akun uji yang pengguna berwenang kelola.

```text
Profile 001 -> Account A
Profile 002 -> Account B
Profile 003 -> Account C
```

Password/2FA/security challenge dilakukan manual.

PASS bila setiap profile hanya mengenali akun yang seharusnya.

### T05-04 — Cross-profile negative test

Setelah login:

1. buka Profile 001;
2. pastikan Account A aktif;
3. switch Profile 002;
4. pastikan bukan Account A;
5. switch Profile 003;
6. pastikan bukan Account A/B yang salah;
7. kembali ke Profile 001;
8. Account A harus tetap sama.

PASS bila tidak ada session leakage.

### T05-05 — Restart mapping

Tutup app normal, buka kembali.

PASS bila:

- profile_001 tetap memakai `persist:profile_001`;
- profile_002 tetap memakai `persist:profile_002`;
- profile_003 tetap memakai `persist:profile_003`;
- account identity tetap sesuai profile masing-masing.

Ulangi restart minimal dua kali.

### T05-06 — Rename isolation

Rename display name Profile 002.

PASS bila:

- ID tetap `profile_002`;
- partition tetap `persist:profile_002`;
- Account B tetap sama;
- Profile 001/003 tidak berubah.

### T05-07 — Archive/unarchive isolation

Archive Profile 002 lalu unarchive.

PASS bila:

- Profile 001/003 tetap normal;
- partition Profile 002 tidak berubah;
- session Profile 002 tidak berpindah ke profile lain.

### T05-08 — Delete boundary

Gunakan profile uji yang aman untuk dihapus.

PASS bila permanent delete hanya menghapus target profile dan tidak mengubah metadata/session profile lain.

Jangan gunakan akun/data penting untuk test delete.

### T05-09 — Local state sentinel

Gunakan halaman/local test fixture yang menyimpan value non-secret berbeda per profile, misalnya:

```text
profile_001 -> isolation-marker=A
profile_002 -> isolation-marker=B
profile_003 -> isolation-marker=C
```

PASS bila value tetap terpisah setelah switch dan restart.

Test ini lebih aman daripada membaca cookie autentikasi.

### T05-10 — Cache/service-worker boundary

Jika test fixture mendukung cache atau service worker:

- buat state berbeda pada masing-masing profile;
- reopen profile;
- pastikan state tidak silang.

Jangan mengandalkan service production untuk test ini.

### T05-11 — Crash one profile

Gunakan smoke/test fixture untuk mensimulasikan renderer failure pada satu surface.

PASS bila:

- registry profile lain tetap utuh;
- persistent partition profile lain tidak dihapus;
- app dapat membuka profile lain setelah recovery;
- tidak ada global reset seluruh profile.

### T05-12 — Navigation regression

Untuk setiap profile:

- Back;
- Forward;
- Reload;
- shortcut service yang diizinkan.

PASS bila history/navigation tidak membuat profile berpindah partition.

### T05-13 — Secret audit

Periksa log/evidence.

Tidak boleh ada:

```text
password
OTP value
recovery code
cookie value
access token
refresh token
authorization header
```

## Automated test yang harus ada saat implementasi

Minimal unit/smoke tests:

1. unique partition validator;
2. duplicate partition rejection;
3. profileId-partition mismatch rejection;
4. immutable ID test;
5. rename preserves partition;
6. archive preserves partition;
7. switching resolves target descriptor;
8. one active surface cleanup test;
9. registry restart determinism;
10. secret-redaction regression.

## Logging

Log hanya metadata aman, contoh:

```text
profile_open_requested profileId=profile_002
profile_descriptor_valid profileId=profile_002 partition=persist:profile_002
profile_surface_created profileId=profile_002
profile_switch_completed from=profile_001 to=profile_002
```

Jangan log:

- URL query sensitif;
- cookie;
- token;
- credential;
- isi halaman autentikasi.

## Error handling

### Duplicate partition

Jika registry memiliki dua profile dengan partition sama:

```text
BLOCK STARTUP PROFILE
LOG SAFE DIAGNOSTIC
DO NOT AUTO-MERGE
DO NOT AUTO-RENAME PARTITION
```

### Profile/partition mismatch

Jika `profile_002` menunjuk ke `persist:profile_003`, jangan mencoba memperbaiki diam-diam. Blok profile dan minta recovery eksplisit.

### Missing local data

Jika metadata ada tetapi data persistent hilang, tandai profile error. Jangan mengarahkan profile tersebut ke partition profile lain.

### Corrupted profile

Recovery satu profile tidak boleh melakukan global delete user-data seluruh aplikasi.

## Security baseline

Tetap wajib:

```text
nodeIntegration: false
contextIsolation: true
sandbox: true
webSecurity: true
webviewTag: false
```

Isolation bukan alasan untuk menurunkan security.

## Resource rule STEP 05

Walaupun ada tiga stored profile, default test tetap:

```text
stored profiles = 3
active surfaces = 1
```

Tujuannya memisahkan masalah isolation dari masalah RAM/resource concurrency. Banyak active surface baru diuji pada tahap resource management.

## Evidence aman

Catat:

```text
OS
commit SHA
Electron/Chromium/Node version
profile IDs
partition names
PASS/FAIL T05-xx
non-sensitive error message
```

Jangan upload screenshot yang menampilkan email pribadi, token, cookie, OTP, recovery code, atau data sensitif tanpa penyensoran.

## Acceptance gate

STEP 05 baru PASS bila:

- STEP 04 sudah PASS;
- minimal tiga profile persistent terpisah;
- account identity tidak bocor silang;
- local state tidak bocor silang;
- restart tidak mengubah mapping;
- rename/archive/unarchive tidak mengubah identity;
- crash satu profile tidak merusak profile lain;
- registry tetap konsisten;
- security baseline tetap aktif;
- regression STEP 00–04 PASS;
- secret audit PASS.

## STOP CONDITION

STOP dan jangan lanjut STEP 06 apabila:

- dua profile memakai partition yang sama;
- profile membuka akun profile lain;
- mapping berubah setelah restart;
- rename mengubah partition;
- archive/unarchive menyebabkan identity mismatch;
- delete satu profile merusak profile lain;
- renderer crash merusak seluruh registry;
- dibutuhkan cookie copy/injection atau anti-detection agar isolation bekerja.

## Definition of Done

Setelah seluruh gate PASS:

```text
STEP 05 = CLOSED
↓
baru mulai STEP 06 — Profile Launcher
```

STEP 06 kemudian fokus pada UX pemilihan/open profile yang aman, bukan membuktikan isolation dari nol lagi.
