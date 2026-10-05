# STEP 03 — Persistent Single Profile

> **STATUS: BLOCKED oleh STEP 02 / Issue #5.** Dokumen ini hanya persiapan. Jangan mengaktifkan persistent partition sampai login Google manual pada STEP 02 sudah PASS dan Issue #5 ditutup sebagai completed.

## Tujuan

Membuktikan bahwa satu browser profile dapat menyimpan session secara persisten sehingga login manual tetap tersedia setelah aplikasi ditutup dan dibuka kembali.

STEP 03 hanya menangani **satu profile**. Profile Manager, switching banyak profile, isolation antarakun, dan skala 100 profile belum dikerjakan di tahap ini.

## Keputusan arsitektur yang dikunci

```text
Profile ID      : profile_001
Partition       : persist:profile_001
Mode            : persistent
Jumlah profile  : 1
Jumlah surface  : 1 aktif
Login           : manual
Password/2FA    : tidak disimpan aplikasi
Cookie/token    : dikelola Chromium/Electron, tidak dicopy manual
```

Electron mendefinisikan partition yang diawali `persist:` sebagai persistent session. Partition tanpa prefix tersebut tetap in-memory. Session/partition harus dipilih ketika `WebContentsView` dibuat, sebelum navigation pertama.

## Scope STEP 03

Yang **boleh** dibuat:

- session descriptor untuk browser surface;
- persistent partition `persist:profile_001`;
- metadata non-secret profile tunggal;
- launcher `step03`;
- recovery/diagnostic dasar untuk profile tunggal;
- automated offline smoke test untuk memastikan descriptor persistent dipakai;
- manual test login -> close -> reopen -> masih login.

Yang **belum boleh** dibuat:

- create/delete banyak profile;
- switching Profile 001 -> 002 -> 003;
- import/export cookie;
- auto-login email/password;
- auto-2FA;
- CAPTCHA/security challenge automation;
- user-agent spoofing;
- anti-detection;
- quota rotation;
- AI agent;
- automation website.

## Kontrak data minimal

Metadata profile tidak boleh berisi credential.

Contoh:

```json
{
  "id": "profile_001",
  "displayName": "Profile 001",
  "partition": "persist:profile_001",
  "persistence": "persistent",
  "status": "active",
  "createdAt": "ISO-8601 timestamp"
}
```

Dilarang menambahkan field seperti:

```text
password
otp
recoveryCode
cookieValue
accessToken
refreshToken
sessionToken
```

## Kontrak BrowserBackend yang disarankan

`createSurface()` sebaiknya tidak lagi mengandalkan constant partition internal. Surface menerima session descriptor eksplisit.

Konsep:

```text
BrowserSessionDescriptor
├── partition
├── persistence
└── profileId

BrowserSurfaceDescriptor
├── surfaceId
├── session
└── bounds
```

Contoh STEP 01 / test memory-only:

```text
partition: step01-browser-session
persistence: memory
```

Contoh STEP 03:

```text
partition: persist:profile_001
persistence: persistent
```

Dengan pola ini STEP 04–05 nanti dapat menambahkan banyak profile tanpa membongkar browser engine.

## Lifecycle wajib

### Launch pertama

```text
App start
→ load profile_001 metadata
→ validate partition = persist:profile_001
→ create WebContentsView dengan partition tersebut
→ baru navigate
→ user login manual
→ normal close
```

### Launch berikutnya

```text
App start
→ load profile_001 metadata yang sama
→ create WebContentsView dengan partition yang sama
→ navigate Google/YouTube
→ Chromium membaca session persistent sebelumnya
```

Aplikasi **tidak boleh** membaca cookie lalu menyuntikkannya kembali.

## Security baseline

Remote surface tetap wajib:

```text
nodeIntegration: false
contextIsolation: true
sandbox: true
webSecurity: true
webviewTag: false
```

Selain itu:

- URL policy tetap HTTP(S)-only;
- popup tetap controlled;
- permission tidak boleh dilonggarkan hanya agar login bekerja;
- logger tidak boleh merekam query/fragment sensitif atau credential;
- tidak ada DevTools hack untuk menyalin session;
- tidak ada cookie export/import.

## Error handling

### Invalid partition descriptor

Jika `profile_001` mempunyai partition kosong, tidak valid, atau bukan `persist:profile_001`, app harus FAIL secara terkontrol sebelum membuka remote page.

### Metadata mismatch

Jika metadata mengatakan `profile_001` tetapi partition berubah menjadi profile lain, jangan silently lanjut. Catat diagnostic non-secret dan blok startup profile.

### Renderer crash

Crash renderer tidak boleh menghapus profile persistent. Recreate surface boleh dilakukan menggunakan descriptor profile yang sama.

### Corrupted local data

Jangan otomatis menghapus folder session. Tampilkan status profile bermasalah dan minta recovery flow terpisah di tahap recovery nanti.

## Test matrix

### T03-00 — Regression prerequisites

Wajib PASS sebelum test persistence:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run smoke
npm run smoke:browser
npm run smoke:step02
```

### T03-01 — Persistent descriptor offline smoke

Automated test tanpa akun:

- launch mode STEP 03;
- pastikan surface memakai `persist:profile_001`;
- surface count = 1;
- tidak melakukan credential automation;
- clean shutdown PASS.

Target script setelah implementasi:

```bash
npm run smoke:step03
```

### T03-02 — First manual login

1. Jalankan mode STEP 03.
2. Login akun uji secara manual.
3. Verifikasi Google.
4. Verifikasi YouTube.
5. Verifikasi YouTube Studio.
6. Tutup aplikasi secara normal.

PASS bila seluruh layanan mengenali akun yang sama sebelum app ditutup.

### T03-03 — Restart #1

1. Buka aplikasi kembali dengan profile_001.
2. Jangan login ulang.
3. Buka Google, YouTube, YouTube Studio.

**PASS:** account session tetap dikenali.

### T03-04 — Restart #2

Ulangi close/open sekali lagi.

**PASS:** hasil tetap konsisten dan tidak membuat identity/session baru.

### T03-05 — Navigation regression

Saat persistent session aktif:

- Back;
- Forward;
- Reload;
- YouTube -> YouTube Studio -> Google.

PASS bila history dan login tetap normal.

### T03-06 — Clean shutdown

Tutup app normal lalu buka lagi.

PASS bila previous-run marker tetap clean dan profile masih dapat digunakan.

### T03-07 — Renderer failure boundary

Gunakan test/smoke yang tidak memerlukan credential untuk memastikan renderer failure tidak menghapus persistent profile data.

### T03-08 — Secret audit

Periksa log dan evidence.

Tidak boleh ada:

```text
password
OTP value
recovery code
cookie value
authorization header
access token
refresh token
```

## Evidence manual

Catat hanya informasi aman:

```text
OS
commit SHA
Electron version
Chromium version
Node version
profile id = profile_001
partition name = persist:profile_001
T03-02 PASS/FAIL
T03-03 PASS/FAIL
T03-04 PASS/FAIL
T03-05 PASS/FAIL
T03-06 PASS/FAIL
error non-sensitif bila ada
```

Jangan upload isi cookie, token, email/password, OTP, recovery code, atau screenshot yang mengekspos data sensitif.

## Acceptance gate

STEP 03 baru PASS jika:

- STEP 02 sudah PASS lebih dulu;
- `persist:profile_001` digunakan konsisten;
- login bertahan setelah restart aplikasi pertama;
- login bertahan setelah restart aplikasi kedua;
- Google, YouTube, dan YouTube Studio tetap konsisten;
- regression STEP 00–02 tetap PASS;
- tidak ada secret di log/evidence;
- security baseline tidak diturunkan.

## STOP CONDITION

STOP dan jangan lanjut STEP 04 apabila salah satu terjadi:

- login hilang setelah restart;
- app membuat partition baru secara tidak sengaja;
- profile_001 membuka session akun yang berbeda karena bug;
- renderer/view leak muncul;
- persistent session mengganggu mode memory-only test;
- log berisi secret;
- perlu menurunkan security atau memakai anti-detection agar bekerja.

## Definition of Done

Setelah semua gate PASS:

```text
STEP 03 = CLOSED
↓
baru buka implementasi STEP 04 — Profile Manager
```

Jangan melompat langsung ke 10/100 profile. STEP 04 harus membangun lifecycle profile terlebih dahulu, lalu STEP 05 membuktikan isolation.