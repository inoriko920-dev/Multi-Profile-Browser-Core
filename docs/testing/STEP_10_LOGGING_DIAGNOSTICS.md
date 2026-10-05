# STEP 10 — Logging & Diagnostics

> Status: **PREPARED ONLY — BLOCKED by STEP 09**
>
> Dokumen ini adalah kontrak implementasi dan pengujian. Jangan mengaktifkan Logging & Diagnostics penuh sebelum STEP 09 — Recovery System selesai dan PASS.

## 1. Tujuan

STEP 10 membangun lapisan observability yang membuat bug dapat dilacak tanpa membuka credential/session rahasia milik pengguna. Sistem harus membantu menjawab pertanyaan seperti:

- profile mana yang aktif saat bug terjadi;
- runtime mana yang crash;
- berapa jumlah runtime hidup;
- apakah hard cap runtime pernah terlewati;
- apakah app sebelumnya shutdown clean/unclean;
- berapa CPU/memory process Electron saat kejadian;
- recovery attempt keberapa yang sedang berjalan;
- event mana yang terjadi sebelum crash;
- apakah ada indikasi listener/timer leak;
- apakah diagnostic bundle aman untuk dibagikan kepada developer.

Logging tidak boleh berubah menjadi sistem pengumpulan isi browser.

## 2. Dependency gate

STEP 10 hanya boleh mulai setelah:

```text
STEP 08 Resource Management PASS
        ↓
STEP 09 Recovery System PASS
        ↓
STEP 10 Logging & Diagnostics
```

Alasannya:

- RuntimeManager harus sudah menjadi source of truth runtime;
- RecoveryManager harus sudah memiliki event/recovery state yang stabil;
- logger/diagnostics harus mengamati sistem yang sudah benar, bukan membentuk behavior baru.

## 3. Prinsip arsitektur wajib

### 3.1 Observability tidak boleh menjadi authority

Logger dan DiagnosticsService hanya membaca state aman dari module resmi.

```text
Profile Registry ─┐
RuntimeManager ───┼─> DiagnosticsService ─> safe snapshot
RecoveryManager ─┤
App Lifecycle ────┘

All modules ─> StructuredLogger ─> redaction ─> sinks
```

Diagnostics tidak boleh:

- membuat profile;
- membuka runtime;
- memilih partition;
- membaca cookie;
- membaca localStorage/sessionStorage;
- mengeksekusi JavaScript pada website remote;
- mengambil DOM;
- menyimpan password/OTP/token;
- mengubah navigation;
- melakukan auto-login;
- mengubah recovery state kecuali melalui API resmi yang memang didesain untuk itu.

### 3.2 Redaction before persistence

Aturan paling penting:

```text
raw event
  ↓
normalize
  ↓
redact
  ↓
truncate / sanitize
  ↓
serialize
  ↓
write / export
```

Tidak boleh:

```text
raw secret -> file -> redact saat export
```

Jika secret sudah pernah ditulis ke disk, gate dianggap gagal.

## 4. StructuredLogger contract

Contoh interface konseptual:

```ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEvent {
  timestamp: string;
  level: LogLevel;
  category: string;
  eventName: string;
  profileId?: string;
  runtimeId?: string;
  recoveryAttempt?: number;
  safeContext?: Record<string, unknown>;
}
```

Logger harus mempunyai satu jalur tulis utama.

Dilarang setiap module membuat file log sendiri tanpa melewati policy redaction yang sama.

## 5. Event category minimum

Baseline categories:

```text
app.lifecycle
browser.navigation
profile.lifecycle
runtime.lifecycle
workspace.navigation
recovery
security.policy
diagnostics
storage.registry
error
```

Contoh event name:

```text
app.started
app.clean_shutdown
app.previous_shutdown_unclean
profile.created
profile.archived
runtime.open_requested
runtime.started
runtime.closed
runtime.crashed
runtime.cap_reached
navigation.started
navigation.completed
navigation.blocked
recovery.started
recovery.succeeded
recovery.degraded
recovery.blocked
diagnostics.snapshot_created
diagnostics.bundle_exported
```

Event name harus stabil supaya bisa dibandingkan antar versi.

## 6. Data classification

### 6.1 SAFE — boleh dicatat

```text
app version
Electron version
Chromium version
Node version
OS platform
architecture
app uptime
profileId
runtimeId
surfaceId yang non-secret
number of stored profiles
number of active runtimes
maxActiveRuntimes
runtime state
recovery state
crash count
clean / unclean marker
process PID
process type
process creation time
CPU metric
memory metric
safe error class
safe error code
HTTP status class bila relevan
sanitized origin/hostname bila policy mengizinkan
```

### 6.2 SENSITIVE — default harus disanitasi

```text
full URL
query string
fragment
profile display name
local file path
userData path
email address yang tampil pada UI remote
error message yang berasal dari website
external protocol payload
```

Rule:

- simpan origin/hostname jika cukup;
- hilangkan query/fragment;
- jangan simpan path rumah pengguna bila tidak perlu;
- error text eksternal harus di-normalize/truncate.

### 6.3 FORBIDDEN — tidak boleh masuk log/bundle

```text
password
PIN
OTP
2FA code
recovery code
cookie value
Set-Cookie
Authorization header
Bearer token
OAuth access token
OAuth refresh token
session token
CSRF token bila berupa secret
localStorage content
sessionStorage content
request body
response body
DOM content
form input value
clipboard content
saved password
Google credential
browser profile data file
raw SQLite profile/session file
screenshot otomatis website remote
```

## 7. Redaction strategy

Redaction harus berlapis.

### 7.1 Key-name redaction

Jika object memiliki key seperti:

```text
password
passwd
passcode
otp
2fa
authorization
cookie
set-cookie
access_token
refresh_token
session_token
recovery_code
secret
api_key
```

value diganti dengan marker:

```text
[REDACTED]
```

### 7.2 Pattern redaction

Tambahkan regex/pattern defensif untuk synthetic token/common bearer patterns.

Pattern bukan satu-satunya defense karena secret bisa tidak mengikuti pola umum.

### 7.3 URL sanitization

Contoh:

```text
INPUT:
https://example.com/callback?code=ABC123&state=XYZ#token=SECRET

SAFE:
https://example.com/callback
```

Atau hanya:

```text
origin = https://example.com
pathname = /callback
```

### 7.4 Length limit

Setiap string log harus memiliki batas.

Contoh baseline:

```text
max string field: 2 KB
max safeContext serialized: 16 KB
max single event: 32 KB
```

Nilai final boleh berubah berdasarkan test, tetapi harus bounded.

## 8. Log format

Rekomendasi baseline: JSON Lines.

Contoh:

```json
{"timestamp":"2026-10-05T00:00:00.000Z","level":"info","category":"runtime.lifecycle","eventName":"runtime.started","profileId":"profile_001","runtimeId":"runtime_abc","safeContext":{"activeRuntimeCount":1,"maxActiveRuntimes":1}}
```

Keuntungan:

- mudah di-parse;
- satu event per line;
- gampang untuk secret scan;
- bisa diproses oleh script otomatis;
- partial file corruption lebih mudah ditoleransi.

## 9. Log location

Gunakan path resmi aplikasi, bukan folder repo.

Electron menyediakan `app.setAppLogsPath()` dan path app logs pada Windows/Linux dapat ditempatkan di area aplikasi/userData. Implementasi harus memastikan:

- log tidak masuk Git;
- log tidak bercampur dengan persistent profile/session directory;
- permission error menghasilkan fallback aman;
- logger failure tidak crash app.

Contoh logical structure:

```text
userData/
├─ profiles/
├─ registry/
├─ recovery/
├─ logs/
│  ├─ app-current.jsonl
│  ├─ app-2026-10-04.jsonl
│  └─ ...
└─ diagnostics/
```

## 10. Rotation and retention

Log tidak boleh tumbuh tanpa batas.

Baseline policy yang diuji:

```text
rotate by size atau daily
max single file: configurable
max retained files: configurable
max retained age: configurable
```

Contoh baseline awal:

```text
max file size: 10 MB
max files: 10
max age: 14 days
```

Angka ini bukan final requirement; implementasi harus punya config dan test bounded storage.

## 11. Write failure policy

Jika disk penuh/read-only/path error:

- aplikasi tetap berjalan bila mungkin;
- logger jangan recursive-crash;
- error logger tidak masuk infinite logging loop;
- dapat fallback ke bounded in-memory ring buffer;
- UI/diagnostics boleh menunjukkan `logging_degraded`;
- jangan menghapus profile/session untuk membuat ruang.

## 12. In-memory ring buffer

Untuk event terakhir sebelum crash, boleh ada bounded ring buffer non-secret.

Contoh:

```text
last 200–1000 safe events
```

Ring buffer tetap harus menerima event setelah redaction.

Tidak boleh menyimpan raw event sebelum redaction.

## 13. DiagnosticsService contract

Contoh interface konseptual:

```ts
interface DiagnosticsSnapshot {
  generatedAt: string;
  app: AppDiagnostics;
  runtime: RuntimeDiagnostics;
  profiles: ProfileDiagnostics;
  recovery: RecoveryDiagnostics;
  processes: ProcessDiagnostics[];
  logging: LoggingDiagnostics;
}
```

DiagnosticsService membaca data melalui interface module, bukan menyentuh internal file secara langsung bila tidak perlu.

## 14. App diagnostics

Minimum:

```text
appName
appVersion
Electron version
Chromium version
Node version
platform
arch
system version
app uptime
previous shutdown state
current safe/degraded mode
```

Hindari hardware fingerprint detail yang tidak dibutuhkan untuk troubleshooting.

## 15. Profile diagnostics

Boleh:

```text
storedProfileCount
activeProfileCount
archivedProfileCount
errorProfileCount
activeProfileId
```

Opsional per-profile safe summary:

```text
profileId
state
hasActiveRuntime
lastRuntimeState
lastRecoveryState
```

Jangan sertakan:

```text
cookie count bila membutuhkan secret inspection
account email dari website
login token
session data size dengan membuka internal cookie DB
```

## 16. Runtime diagnostics

Minimum:

```text
activeRuntimeCount
maxActiveRuntimes
runtimeId
profileId
state
createdAt
lastStateChangeAt
surfaceCount
```

Invariant penting:

```text
activeRuntimeCount <= maxActiveRuntimes
```

Jika snapshot menemukan pelanggaran invariant, severity harus tinggi.

## 17. Electron process metrics

Electron menyediakan `app.getAppMetrics()` yang mengembalikan statistik process terkait app, termasuk process type, PID, creation time, CPU dan memory. Gunakan API resmi ini sebagai baseline observability process. CPU percentage bersifat interval-based: setiap call memulai interval baru untuk pengukuran berikutnya, jadi jangan sampling terlalu rapat atau dari banyak caller berbeda. 

Snapshot aman dapat menyimpan:

```text
pid
creationTime
process type
service name bila aman
CPU percentage
cumulative CPU bila tersedia
memory working set/private bytes
sandboxed state bila tersedia
```

Jangan menambahkan command line process yang mungkin mengandung secret.

## 18. Sampling policy

Diagnostics tidak boleh polling sangat sering tanpa alasan.

Baseline:

```text
on-demand snapshot
plus optional low-frequency health sampling
```

Jika periodic sampling dipakai:

- satu scheduler saja;
- configurable;
- default konservatif;
- timer dibersihkan saat shutdown;
- jangan satu timer per profile;
- jangan satu timer per WebContentsView bila global snapshot sudah cukup.

## 19. Health state

Konsep status global:

```text
healthy
degraded
attention_required
```

Contoh `degraded`:

- logging path unavailable;
- repeated renderer crash;
- recovery safe mode;
- runtime cap invariant hampir/sempat dilanggar;
- registry read error non-fatal;
- diagnostics exporter gagal.

Health status bukan alasan untuk otomatis menghapus data.

## 20. Diagnostic bundle

Diagnostic bundle harus eksplisit dibuat pengguna/developer saat perlu.

Contoh isi:

```text
diagnostics_<timestamp>/
├─ manifest.json
├─ app.json
├─ runtime.json
├─ profiles_safe.json
├─ recovery.json
├─ processes.json
├─ logging.json
├─ recent_events.jsonl
└─ README.txt
```

Tidak perlu ZIP pada implementasi pertama jika folder lebih mudah dites. ZIP dapat ditambahkan kemudian.

## 21. Bundle manifest

Manifest minimum:

```text
bundleVersion
appVersion
generatedAt
schemaVersion
files
redactionPolicyVersion
secretScanPassed
```

Bundle harus self-describing supaya developer tahu schema-nya.

## 22. Diagnostic export safety

Sebelum export dianggap selesai:

1. data dikumpulkan dari safe sources;
2. redaction layer dijalankan;
3. files ditulis ke temp/output;
4. automated secret scan dijalankan;
5. jika scan gagal, bundle tidak dianggap valid;
6. tampilkan warning yang jelas;
7. jangan otomatis upload ke internet.

## 23. No automatic upload

STEP 10 hanya membuat local diagnostic bundle.

Tidak ada:

- auto upload ke server;
- telemetry cloud wajib;
- silent diagnostics transmission;
- account data upload.

Future telemetry harus menjadi keputusan terpisah dan eksplisit.

## 24. Error normalization

Raw `Error` dapat berisi path/URL/data sensitif.

Normalize menjadi:

```ts
interface SafeError {
  name: string;
  code?: string;
  message: string; // sanitized + truncated
  stack?: string;  // optional, sanitized, dev mode only
}
```

Stack production perlu policy karena dapat mengandung local path.

## 25. Navigation logging policy

Jangan log full URL mentah secara default.

Contoh event aman:

```json
{
  "category": "browser.navigation",
  "eventName": "navigation.completed",
  "profileId": "profile_001",
  "safeContext": {
    "origin": "https://www.youtube.com",
    "pathname": "/",
    "status": "success"
  }
}
```

Query/fragment default dihapus.

## 26. Profile correlation

Untuk debugging cross-profile bug, `profileId` boleh digunakan karena merupakan ID internal non-secret.

Jangan gunakan email akun sebagai correlation ID.

Dilarang:

```text
alice@gmail.com -> runtime
```

Gunakan:

```text
profile_001 -> runtime_abc
```

## 27. Runtime/recovery correlation

Setiap recovery event sebaiknya membawa:

```text
profileId
runtimeId lama
runtimeId baru bila recreate
recoveryAttempt
reason enum
result
```

Tetap tanpa cookie/token/session data.

## 28. Crash evidence

Untuk renderer crash:

safe context boleh:

```text
reason
exitCode
profileId
runtimeId
recoveryAttempt
activeRuntimeCount
maxActiveRuntimes
process metrics sekitar event bila tersedia
```

Tidak perlu snapshot halaman remote.

## 29. Clean/unclean shutdown evidence

Startup event harus dapat mencatat:

```text
previousRun = clean | unclean | unknown
currentRunId
startupTime
safeMode
```

Run ID boleh UUID/random local correlation ID, bukan credential.

## 30. Run/session correlation ID

Boleh ada `runId` untuk satu launch aplikasi.

```text
app launch #1 -> runId A
app launch #2 -> runId B
```

Ini membantu menghubungkan startup, runtime, crash, recovery, shutdown.

Run ID tidak sama dengan browser session/token.

## 31. Secret scanner

Tambahkan automated scanner untuk output:

- test secret strings;
- bearer pattern;
- cookie-like synthetic values;
- authorization header;
- OAuth-like synthetic token;
- known test password;
- known test OTP;
- query parameter secret.

Jika synthetic secret muncul di logs/bundle => FAIL.

## 32. Synthetic secret test fixture

Test menggunakan dummy, bukan credential real.

Contoh:

```text
password = TEST_PASSWORD_SHOULD_NEVER_APPEAR
access_token = TEST_ACCESS_TOKEN_SHOULD_NEVER_APPEAR
otp = 654321
cookie = SID=TEST_COOKIE_SHOULD_NEVER_APPEAR
```

Kemudian scan seluruh output.

## 33. Diagnostic bundle path

Output lokal harus berada di folder yang jelas dan tidak bercampur dengan session.

Contoh:

```text
userData/diagnostics/exports/<bundle-id>/
```

Atau user-chosen folder jika export dilakukan melalui save dialog.

Jika user memilih folder sendiri, jangan sertakan profile data file.

## 34. Production vs development logging

Development boleh memiliki verbosity lebih tinggi, tetapi policy forbidden data tetap sama.

```text
dev: debug/info/warn/error
prod: info/warn/error/fatal
```

Jangan pernah membuat "debug mode" yang mematikan redaction.

## 35. PII minimization

Logging harus menggunakan prinsip minimization.

Jika problem dapat didiagnosis dengan `profileId`, jangan log email/display name.

Jika origin cukup, jangan log full URL.

Jika error code cukup, jangan log response body.

## 36. Performance budget

Logger dan diagnostics harus ringan.

Target test:

- async/buffered write bila aman;
- tidak block UI untuk event biasa;
- no synchronous large file write di navigation path;
- bounded queue;
- backpressure/drop policy eksplisit untuk debug spam;
- error/fatal event memiliki prioritas lebih tinggi.

## 37. Logging queue overflow

Jika queue penuh:

- jangan gunakan unbounded memory;
- drop debug/info lebih dulu bila policy memerlukan;
- warn/error/fatal diprioritaskan;
- catat aggregated `events_dropped` setelah kondisi pulih;
- jangan recursive-log setiap dropped event.

## 38. File corruption handling

Jika log terakhir corrupt/truncated akibat crash:

- app tetap startup;
- file lama jangan dianggap registry source;
- mulai log baru jika perlu;
- diagnostic exporter boleh menyertakan file corrupt hanya setelah sanitization/size limit atau mengabaikannya;
- corruption tidak boleh memicu deletion profile.

## 39. Schema versioning

Log/diagnostics perlu version field.

Contoh:

```text
logSchemaVersion = 1
diagnosticsSchemaVersion = 1
redactionPolicyVersion = 1
```

Perubahan incompatible harus bump schema version.

## 40. Test matrix

### T10-01 — Structured event format

Procedure:

1. jalankan app;
2. trigger startup/navigation/runtime event;
3. parse file JSONL.

Expected:

- setiap line valid JSON;
- required fields tersedia;
- eventName/category stabil.

### T10-02 — Key redaction

Inject synthetic object dengan field password/token/cookie.

Expected:

- value tidak muncul;
- marker `[REDACTED]` muncul bila field dicatat.

### T10-03 — Pattern redaction

Inject synthetic bearer/token string dalam error/context.

Expected:

- secret tidak muncul pada sink.

### T10-04 — URL sanitization

Uji URL:

```text
https://example.com/callback?code=SECRET&token=ABC#frag=XYZ
```

Expected:

- query/fragment tidak muncul;
- origin/path aman boleh muncul.

### T10-05 — Long payload truncation

Kirim synthetic string sangat besar.

Expected:

- event bounded;
- logger tidak OOM;
- truncation marker tersedia.

### T10-06 — Log rotation

Generate event sampai threshold test.

Expected:

- file rotate;
- jumlah file bounded;
- file aktif valid.

### T10-07 — Retention

Simulasikan old log files.

Expected:

- retention menghapus hanya logs yang eligible;
- tidak menyentuh profile/session/registry.

### T10-08 — Disk/write failure

Simulasikan sink gagal.

Expected:

- app tidak crash;
- logger masuk degraded mode;
- no recursive failure loop.

### T10-09 — Runtime snapshot

Dengan beberapa profile stored dan runtime cap 1:

Expected:

- snapshot menunjukkan stored count benar;
- activeRuntimeCount benar;
- cap benar;
- tidak menyalakan inactive profile.

### T10-10 — Electron process metrics

Ambil `app.getAppMetrics()`.

Expected:

- process list dapat dicatat sebagai safe metrics;
- tidak ada command line/secret;
- sampling bounded.

### T10-11 — Repeated sampling

Ambil snapshot berkali-kali.

Expected:

- timer/listener count tidak bertambah;
- memory tidak tumbuh tanpa batas;
- sampling semantics konsisten.

### T10-12 — Recovery correlation

Trigger recovery test dari STEP 09.

Expected:

- crash/recovery events dapat dikorelasikan profileId/runtimeId;
- tidak ada credential.

### T10-13 — Unclean shutdown diagnostics

Force kill app sesuai test harness.

Expected:

- startup berikutnya mencatat previous run unclean;
- diagnostic snapshot tersedia;
- tidak membuka semua profile.

### T10-14 — Corrupt log file

Corrupt line terakhir.

Expected:

- app tetap startup;
- logger membuat file/sink sehat;
- registry tidak terganggu.

### T10-15 — Bundle export

Generate diagnostic bundle.

Expected:

- manifest lengkap;
- safe files tersedia;
- bundle dapat dibuka;
- profile/session raw files tidak ada.

### T10-16 — Secret scan

Masukkan synthetic secret pada input event, lalu export bundle.

Expected:

- scan seluruh log/bundle tidak menemukan secret;
- PASS hanya jika zero leakage.

### T10-17 — Profile identity minimization

Login test account secara manual pada profile.

Expected:

- log menggunakan profileId;
- email/account name tidak otomatis dicatat.

### T10-18 — Navigation regression

Gunakan Back/Forward/Reload + shortcut setelah logging aktif.

Expected:

- behavior browser tidak berubah;
- logger tidak menghambat navigation.

### T10-19 — Runtime stress + logs

Lakukan rapid profile switching/stress dari STEP 08.

Expected:

- log tetap bounded;
- no duplicate logger listener;
- diagnostics mencerminkan cap dengan benar.

### T10-20 — Crash loop + logs

Trigger bounded crash loop dari STEP 09.

Expected:

- recovery attempts tercatat;
- safe mode tercatat;
- logging tidak memperparah loop.

### T10-21 — Logger shutdown flush

Close app normal.

Expected:

- bounded flush selesai;
- app tidak hang tanpa batas;
- clean shutdown marker tetap benar.

### T10-22 — Forced kill durability

Kill app saat log aktif.

Expected:

- paling banyak tail event terakhir yang partial/corrupt;
- startup berikutnya tetap sehat.

### T10-23 — Diagnostic exporter failure

Simulasikan path export tidak writable.

Expected:

- error aman;
- tidak crash;
- tidak membuat partial bundle dianggap valid.

### T10-24 — Forbidden data audit

Audit code + output terhadap:

```text
password
otp
cookie
authorization
access_token
refresh_token
sessionStorage
localStorage
executeJavaScript untuk scraping diagnostic
```

Expected:

- tidak ada forbidden flow.

## 41. Acceptance gate

STEP 10 PASS hanya jika seluruh poin berikut benar:

- STEP 09 sudah PASS;
- structured logs valid;
- redaction terpusat;
- synthetic secret scan = zero leakage;
- URL sanitization PASS;
- file size/retention bounded;
- logger failure tidak menjatuhkan app;
- diagnostics tidak membaca cookie/token/DOM;
- app metrics aman dapat dikumpulkan;
- repeated sampling tidak leak;
- crash/recovery correlation tersedia;
- diagnostic bundle valid + secret scan PASS;
- corrupted log handling PASS;
- clean/unclean shutdown evidence PASS;
- runtime/profile counts akurat;
- regression STEP 00–09 tetap PASS.

## 42. STOP CONDITION

STOP dan jangan lanjut STEP 11 bila salah satu terjadi:

1. password/OTP/cookie/token muncul pada output;
2. full URL query/fragment dengan secret muncul;
3. diagnostic bundle berisi raw profile/session files;
4. logging menyebabkan significant UI stall/crash;
5. logger menggunakan unbounded memory/queue;
6. log files tumbuh tanpa retention;
7. diagnostics mengubah profile/session state;
8. diagnostics membuka runtime inactive hanya untuk mengukur;
9. logger/recovery interaction menciptakan crash loop;
10. secret redaction dapat dimatikan melalui debug mode biasa;
11. observability dipakai untuk anti-detection/fingerprint spoofing.

## 43. Definition of Done

Issue STEP 10 hanya boleh ditutup setelah:

- STEP 09 completed;
- seluruh T10 test wajib PASS;
- Windows CI regression PASS;
- synthetic secret scan PASS;
- diagnostic bundle manual inspection PASS;
- storage growth bounded;
- documentation sesuai implementasi final;
- evidence aman dicatat.

Setelah itu baru STEP 11 — 3 Account Stability Test boleh dimulai.

## 44. Catatan implementasi untuk SOL

Urutan implementasi yang direkomendasikan setelah unblock:

```text
1. freeze event schema
2. build redaction + sanitization pure functions
3. exhaustive unit tests redaction
4. StructuredLogger single sink
5. file rotation + retention
6. safe error normalization
7. DiagnosticsService snapshot model
8. Electron app/process metrics adapter
9. recovery/runtime/profile adapters
10. bundle generator
11. secret scanner
12. stress/leak tests
13. crash/unclean-shutdown tests
14. final regression
```

Jangan mulai dari dashboard UI. Observability backend + safety harus stabil lebih dulu.

## 45. Referensi Electron saat dokumen dibuat

Electron saat ini mendokumentasikan:

- `app.getAppMetrics()` untuk statistik CPU/memory process yang terkait dengan aplikasi;
- `process.getProcessMemoryInfo()` untuk memory info process;
- `process.getCPUUsage()` untuk CPU process;
- CPU percentage bersifat average sejak pemanggilan sebelumnya dan pemanggilan berikutnya me-reset interval pengukuran untuk API tersebut;
- `app.setAppLogsPath()` tersedia untuk menetapkan lokasi log aplikasi.

Implementasi final tetap wajib memeriksa dokumentasi Electron terbaru sebelum coding karena API software dapat berubah.