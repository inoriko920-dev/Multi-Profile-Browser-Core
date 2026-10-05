# STEP 07 — Shortcut / Workspace

> Status: **PREPARED ONLY — BLOCKED by STEP 06**
>
> Dokumen ini adalah kontrak implementasi dan pengujian. Jangan menambahkan runtime Shortcut/Workspace sebelum STEP 06 — Profile Launcher selesai dan PASS.

## 1. Tujuan

STEP 07 menambahkan lapisan shortcut/workspace sederhana di atas Profile Launcher yang sudah stabil. Fitur ini tidak membuat session, tidak memilih partition secara mandiri, dan tidak menyimpan credential. Ia hanya membantu pengguna membuka target layanan pada browser surface milik profile yang sedang aktif.

Contoh target awal:

- Google
- YouTube
- YouTube Studio
- Google Drive
- Google Flow
- Gemini
- ChatGPT
- Claude
- Custom URL

## 2. Prinsip arsitektur wajib

Urutan sumber kebenaran tidak boleh dibalik:

```text
Profile Registry
   ↓
Profile Manager
   ↓
Profile Launcher
   ↓
Active Profile Runtime
   ↓
Workspace / Shortcut Manager
   ↓
BrowserBackend.navigate(targetUrl)
```

Shortcut Manager **tidak boleh**:

- membuat `Session` Electron sendiri;
- membentuk nama partition;
- memilih profile berdasarkan display name;
- membaca cookie/token;
- memindahkan session antar profile;
- membuat `WebContentsView` baru tanpa Runtime Manager;
- mengganti user-agent untuk kompatibilitas;
- melakukan login otomatis;
- mengisi password/OTP;
- mengatasi CAPTCHA/security challenge;
- menggunakan anti-detection atau fingerprint spoofing.

## 3. Source of truth

### 3.1 Profile aktif

Satu-satunya sumber profile aktif adalah state resmi Profile Launcher/Runtime Manager.

Contoh konseptual:

```ts
interface ActiveProfileContext {
  profileId: string;
  runtimeId: string;
  surfaceId: string;
}
```

Shortcut tidak menerima `partition` dari UI.

UI hanya mengirim:

```text
shortcutId
```

atau:

```text
customUrl
```

Main process kemudian:

1. resolve active profile dari state resmi;
2. validasi active runtime;
3. resolve shortcut ID menjadi URL;
4. validasi URL;
5. navigasi browser surface aktif.

## 4. Shortcut registry

Registry menyimpan metadata non-secret.

Contoh struktur:

```ts
interface ShortcutDefinition {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
  builtin: boolean;
  sortOrder: number;
}
```

Contoh preset:

```text
google             https://www.google.com/
youtube            https://www.youtube.com/
youtube_studio     https://studio.youtube.com/
google_drive       https://drive.google.com/
google_flow        https://labs.google/fx/tools/flow/
gemini             https://gemini.google.com/
chatgpt            https://chatgpt.com/
claude             https://claude.ai/
```

URL aktual preset harus dapat direvisi melalui registry/config tanpa mengubah lifecycle profile.

## 5. Aturan Custom URL

Custom URL harus melewati validator yang sama dengan URL bar/browser navigation policy.

### Diizinkan

```text
https://example.com/
http://localhost:3000/
```

### Ditolak

```text
file://...
javascript:...
data:...
about:...
chrome:...
chrome-extension:...
ftp:...
intent:...
shell:...
```

Policy minimum:

- parse dengan URL parser, bukan regex saja;
- hanya protocol `http:` dan `https:`;
- normalisasi URL sebelum navigation;
- panjang input memiliki batas masuk akal;
- whitespace/control character ditolak/dinormalisasi aman;
- invalid input menghasilkan error terkontrol;
- invalid input tidak menutup app;
- invalid input tidak membuat surface baru.

## 6. Workspace model

Workspace pada STEP 07 dibuat sesederhana mungkin.

Konsep:

```text
Active Profile
  ├─ shortcut bar
  ├─ URL bar
  └─ 1 active browser surface
```

Tidak ada tab multi-window pada STEP 07.

Tidak ada multi-service surface yang hidup paralel.

Shortcut hanya mengganti halaman pada surface profile aktif.

## 7. UI minimum

```text
┌──────────────────────────────────────────────────────────┐
│ Multi Profile Browser                      [+ PROFILE]    │
├───────────────┬──────────────────────────────────────────┤
│ Profiles      │ ← → ⟳   URL                              │
│               ├──────────────────────────────────────────┤
│ ● Profile 01  │ [Google] [YouTube] [Studio] [Drive]      │
│ ○ Profile 02  │ [Flow] [Gemini] [ChatGPT] [Claude]       │
│ ○ Profile 03  ├──────────────────────────────────────────┤
│               │                                          │
│               │               WEBSITE                    │
│               │                                          │
└───────────────┴──────────────────────────────────────────┘
```

UI boleh lebih sederhana. Yang penting identity profile aktif selalu terlihat dan shortcut tidak menutupi browser content.

## 8. IPC boundary

Renderer tidak boleh menerima primitive berbahaya seperti:

```text
openArbitraryPartition(partition)
createSession(partition)
getCookies()
setCookie()
executeJavaScriptRemote(...)
```

IPC yang diizinkan sebaiknya sempit:

```text
workspace:listShortcuts
workspace:openShortcut(shortcutId)
workspace:openCustomUrl(url)
```

Main process melakukan validasi penuh.

## 9. Idempotency

Repeated click harus aman.

Contoh:

```text
Profile A aktif
klik YouTube
klik YouTube
klik YouTube
```

Hasil yang benar:

- tetap 1 active runtime;
- tetap 1 browser surface;
- tetap partition Profile A;
- tidak membuat duplicate session;
- navigation boleh reload/navigate ke URL target sesuai policy.

## 10. Switching profile + shortcut

Urutan wajib diuji:

```text
Profile A -> YouTube
Profile B -> YouTube
Profile C -> YouTube Studio
Profile A -> Drive
Profile B -> Gemini
Profile A -> YouTube
```

Pada setiap tahap:

- profile aktif di UI harus benar;
- browser surface harus memakai runtime profile yang benar;
- session yang tampil harus sesuai profile tersebut;
- shortcut tidak boleh memengaruhi mapping profile -> partition.

## 11. Shortcut registry persistence

Built-in shortcut dapat berasal dari source/config default.

Jika custom shortcut nantinya diizinkan, yang boleh disimpan hanya metadata seperti:

```text
id
label
url
sort order
enabled
created_at
updated_at
```

Jangan menyimpan:

```text
password
OTP
cookie value
Authorization header
access token
refresh token
session token
recovery code
```

## 12. Service compatibility

Shortcut hanyalah navigasi ke website resmi.

Jika website:

- logout;
- meminta login ulang;
- menampilkan CAPTCHA;
- meminta 2FA;
- menolak embedded/browser environment;

maka hasil tersebut diperlakukan sebagai kondisi layanan/browser compatibility, bukan alasan untuk menambahkan bypass.

## 13. Navigation history

Shortcut harus memakai navigation path resmi sehingga:

- Back bekerja;
- Forward bekerja;
- Reload bekerja;
- URL bar tersinkron;
- navigation events tetap masuk logger yang sudah ada;
- controlled navigation failure tetap terkontrol.

## 14. Error handling

### Shortcut ID tidak dikenal

Expected:

- navigation tidak dijalankan;
- UI menerima error aman;
- app tidak crash.

### Tidak ada active profile

Expected:

- shortcut disabled atau request ditolak;
- tidak dibuat anonymous/in-memory session sebagai fallback diam-diam.

### Runtime profile sedang switching

Expected:

- shortcut action diserialkan atau ditolak sementara;
- tidak boleh menavigasi surface lama setelah active profile berganti.

### URL invalid

Expected:

- ditolak sebelum BrowserBackend.navigate;
- log hanya mencatat informasi aman.

## 15. Race-condition policy

Scenario penting:

```text
User klik Profile B
segera klik YouTube
```

Implementation future harus memilih salah satu behavior deterministik:

1. shortcut menunggu switch Profile B selesai lalu membuka YouTube pada B; atau
2. shortcut disabled selama switching dan pengguna klik ulang setelah selesai.

Dilarang behavior ambigu yang kadang membuka YouTube pada A dan kadang pada B.

## 16. Test matrix

### T07-01 — Registry loads

Precondition:

- STEP 06 PASS;
- minimal 3 profile tersedia.

Procedure:

1. buka app;
2. lihat shortcut bar;
3. verifikasi setiap built-in shortcut.

Expected:

- ID unik;
- label benar;
- URL valid HTTP(S);
- urutan stabil.

### T07-02 — Open shortcut on Profile A

1. aktifkan Profile A;
2. klik Google;
3. klik YouTube;
4. klik YouTube Studio.

Expected:

- semua target terbuka pada surface Profile A;
- identity/session tetap Profile A;
- tidak ada runtime tambahan.

### T07-03 — Profile switching isolation

1. A -> YouTube;
2. B -> YouTube;
3. C -> YouTube;
4. kembali A.

Expected:

- masing-masing profile mempertahankan identity/session sendiri;
- shortcut tidak menyebabkan cross-session.

### T07-04 — Repeated click

Klik shortcut yang sama minimal 20 kali.

Expected:

- tidak ada duplicate surface;
- tidak ada duplicate runtime;
- memory/process count tidak bertambah tanpa alasan.

### T07-05 — Mixed rapid actions

Sequence cepat:

```text
A -> Google -> YouTube -> B -> Studio -> C -> Drive -> A -> Gemini
```

Expected:

- deterministic;
- active profile dan surface tidak mismatch.

### T07-06 — Invalid custom URL

Uji:

```text
javascript:alert(1)
file:///C:/Windows/System32/
data:text/html,test
about:blank
chrome://settings
not a url
```

Expected:

- semua ditolak;
- app tidak crash;
- tidak ada privileged navigation.

### T07-07 — Valid custom URL

Uji beberapa HTTP(S) URL normal.

Expected:

- terbuka pada active profile;
- browser history normal.

### T07-08 — No active profile

Simulasikan kondisi launcher belum memiliki active runtime.

Expected:

- shortcut tidak bisa menavigasi;
- tidak membuat fallback session.

### T07-09 — Archive boundary

1. aktifkan Profile A;
2. pindah B;
3. archive A melalui Profile Manager;
4. gunakan shortcut pada B.

Expected:

- shortcut tetap pada B;
- archived A tidak bisa menjadi target implisit.

### T07-10 — Rename boundary

Rename Profile B.

Expected:

- shortcut tetap mengikuti immutable `profileId`;
- partition/session tidak berubah.

### T07-11 — Restart consistency

1. close app normal;
2. reopen;
3. pilih setiap profile;
4. gunakan shortcut.

Expected:

- registry/profile mapping konsisten;
- shortcut config konsisten.

### T07-12 — Navigation regression

Uji Back/Forward/Reload setelah beberapa shortcut.

Expected:

- semua tetap bekerja.

### T07-13 — Crash boundary

Jika surface profile crash lalu direcover sesuai lifecycle resmi:

Expected:

- shortcut tidak diam-diam membuka profile lain;
- setelah recovery, action kembali memakai profile target yang benar.

### T07-14 — Secret audit

Audit:

- app logs;
- shortcut registry;
- diagnostics;
- evidence test.

Expected:

Tidak ada password, OTP, cookie value, access token, refresh token, recovery code.

## 17. Automated tests future

Setelah STEP 07 diimplementasikan, target script:

```text
npm run smoke:step07
```

Smoke tidak membutuhkan login nyata.

Ia minimal membuktikan:

- shortcut registry valid;
- unknown shortcut ditolak;
- valid URL diproses;
- invalid protocol ditolak;
- no-active-profile ditolak;
- repeated action tidak membuat runtime baru;
- active profile context tidak dapat diubah oleh shortcut payload.

## 18. Regression gate

Sebelum STEP 07 dianggap PASS, semua gate sebelumnya tetap wajib PASS:

```text
npm ci
npm run typecheck
npm run lint
npm test
npm run smoke
npm run smoke:browser
npm run smoke:step02
```

Dan setelah STEP 03–06 benar-benar diimplementasikan, seluruh smoke/test tahap tersebut juga wajib tetap PASS.

## 19. Security gate

Tetap wajib:

- remote `nodeIntegration: false`;
- `contextIsolation: true`;
- `sandbox: true`;
- `webSecurity: true`;
- HTTP(S)-only remote navigation;
- validated IPC;
- no credential automation;
- no cookie injection/export;
- no UA spoofing/anti-detection;
- no direct privileged Electron API exposure to remote content.

## 20. Acceptance gate STEP 07

STEP 07 hanya PASS jika semua berikut terpenuhi:

- STEP 06 sudah PASS;
- shortcut registry deterministic;
- semua built-in target menggunakan HTTP(S);
- shortcut selalu memakai profile aktif yang benar;
- switching + shortcut tidak pernah mencampur session;
- repeated click tidak membuat duplicate runtime/surface;
- invalid protocol ditolak;
- no-active-profile tidak membuat fallback session;
- Back/Forward/Reload tetap normal;
- rename/archive tidak memutus identity mapping;
- restart konsisten;
- no secret leakage;
- regression STEP 00–06 PASS.

## 21. STOP CONDITION

STOP dan jangan lanjut STEP 08 bila ditemukan salah satu:

- shortcut membuka website pada profile/partition yang salah;
- shortcut mempunyai logika session sendiri;
- shortcut membuat `WebContentsView` baru di luar Runtime Manager;
- custom URL dapat melewati HTTP(S)-only policy;
- race profile-switch + shortcut menghasilkan target nondeterministik;
- session/cookie/token perlu dibaca untuk menjalankan shortcut;
- security baseline harus diturunkan agar service bisa dibuka.

## 22. Definition of Done

Issue STEP 07 hanya boleh ditutup setelah:

1. STEP 06 completed;
2. runtime Shortcut/Workspace diimplementasikan sesuai kontrak;
3. test T07-01 s.d. T07-14 PASS;
4. automated smoke STEP 07 PASS;
5. regression seluruh tahap sebelumnya PASS;
6. evidence aman dicatat;
7. tidak ada blocker isolation/security.

Setelah itu baru **STEP 08 — Resource Management** boleh dimulai.