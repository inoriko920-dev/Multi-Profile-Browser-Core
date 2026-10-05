# STEP 09 — Recovery System

> Status: **PREPARED ONLY — BLOCKED by STEP 08**
>
> Dokumen ini adalah kontrak implementasi dan pengujian. Jangan menambahkan runtime Recovery System sebelum STEP 08 — Resource Management selesai dan PASS.

## 1. Tujuan

STEP 09 menambahkan recovery layer yang aman untuk menangani:

- renderer/runtime crash;
- unresponsive renderer;
- unclean application shutdown;
- startup setelah forced termination;
- GPU/utility child-process failure;
- repeated crash / crash loop;
- profile-specific degraded state;
- safe recreation of runtime tanpa mengubah identity profile.

Recovery tidak boleh menjadi mekanisme yang diam-diam membuat session baru, mengganti partition, menghapus profile data, atau melewati resource cap.

## 2. Dependency chain

Urutan arsitektur wajib:

```text
Profile Registry
   ↓
Profile Manager
   ↓
Runtime Manager
   ↓
BrowserBackend / WebContentsView
   ↓
Recovery Manager
   ↓
Logging & Diagnostics
```

Recovery Manager **tidak memiliki** profile/session sendiri.

Ia hanya boleh bekerja terhadap runtime yang sudah terdaftar pada Runtime Manager dan profile yang valid pada registry.

## 3. Source of truth

### 3.1 Profile identity

Tetap berasal dari Profile Manager/Registry.

```ts
interface RecoveryProfileContext {
  profileId: string;
  partition: string;
  runtimeId?: string;
}
```

`partition` tidak boleh dibentuk dari display name.

### 3.2 Runtime state

Runtime Manager tetap menjadi sumber state runtime:

```text
closed
starting
active
idle
closing
crashed
```

Recovery Manager menambah recovery state konseptual:

```text
healthy
recovering
degraded
blocked
```

Dua state set tersebut tidak boleh dicampur menjadi source of truth yang saling bertentangan.

## 4. Electron crash signals

Implementasi future harus memakai API Electron terbaru.

### Renderer

Gunakan:

```text
webContents: render-process-gone
```

Event ini memberikan detail reason/exit code dan dipakai saat renderer hilang karena crash, kill, OOM, dan kondisi lain yang relevan.

### GPU / utility / child process

Gunakan:

```text
app: child-process-gone
```

Jangan memakai API lama:

```text
renderer-process-crashed
crashed
gpu-process-crashed
```

karena API tersebut sudah deprecated/removed pada Electron modern.

## 5. Crash reason classification

Recovery harus mengklasifikasikan reason, bukan sekadar `crashed=true`.

Contoh reason yang mungkin:

```text
clean-exit
abnormal-exit
killed
crashed
oom
launch-failed
integrity-failure
memory-eviction
```

Policy dapat berbeda berdasarkan reason.

Contoh:

- `clean-exit`: bukan crash recovery normal;
- `killed`: dapat berasal dari explicit cleanup/test;
- `crashed`: candidate runtime recovery;
- `oom`: recovery harus lebih konservatif dan memperhatikan resource pressure;
- `launch-failed`: jangan infinite retry;
- `integrity-failure`: jangan mencoba bypass platform integrity;
- `memory-eviction`: jangan langsung membuka banyak runtime kembali.

## 6. Recovery invariants

Wajib selalu benar:

1. `profileId` tidak berubah karena crash.
2. `partition` tidak berubah karena crash.
3. registry tidak dihapus sebagai recovery default.
4. persistent browser data tidak di-reset otomatis.
5. Runtime Manager cap tidak boleh dilampaui.
6. recovery harus serialized.
7. crash loop harus bounded.
8. recovery satu profile tidak boleh menutup profile lain tanpa policy eksplisit.
9. recovery tidak membaca password/OTP/cookie/token.
10. recovery tidak menurunkan Electron security baseline.

## 7. Renderer crash flow

Flow minimum:

```text
renderer gone
   ↓
identify runtime
   ↓
mark runtime crashed
   ↓
record safe crash metadata
   ↓
detach invalid WebContentsView
   ↓
close/destroy invalid WebContents safely
   ↓
check retry budget
   ↓
if allowed -> recreate via Runtime Manager
if denied  -> degraded/blocked state
```

Runtime baru harus dibuat melalui path resmi yang sama seperti open profile normal.

Dilarang membuat WebContentsView darurat langsung dari crash handler jika itu melewati Runtime Manager.

## 8. Recovery retry budget

Tidak boleh infinite reload/recreate.

Baseline rekomendasi:

```text
window: 60 seconds
max automatic recovery attempts: 2 atau 3
```

Nilai final harus configurable.

Contoh state:

```text
first crash  -> auto recovery
second crash -> auto recovery + warning
third crash  -> degraded / stop auto recovery
```

Reset crash counter hanya setelah runtime terbukti stabil selama periode tertentu, bukan langsung setelah create berhasil.

## 9. Safe mode

Safe mode digunakan jika:

- repeated renderer crash;
- startup crash berulang;
- prior run unclean dan active profile terus gagal dibuka;
- recovery action sendiri gagal;
- resource pressure/OOM terus terjadi.

Safe mode minimum:

- shell lokal tetap dapat dibuka;
- registry dapat dibaca;
- tidak otomatis membuka remote profile runtime;
- user dapat memilih profile lain;
- profile bermasalah ditandai degraded/blocked sementara;
- tidak menghapus persistent data otomatis.

## 10. Unclean shutdown marker

STEP 00 sudah memiliki clean-shutdown marker.

STEP 09 harus menggunakannya sebagai input recovery.

Konsep:

```text
app launch
  ↓
read previous shutdown marker
  ↓
clean? -> normal startup
unclean? -> recovery startup policy
```

### Recovery startup policy

Jika previous run unclean:

1. boot local shell;
2. load registry;
3. validate registry consistency;
4. jangan mass-start profile;
5. jangan auto-open 100 profile;
6. hormati `maxActiveRuntimes`;
7. restore hanya target yang policy-nya aman;
8. jika target last-active profile bermasalah, masuk safe mode.

## 11. Last-active profile state

Jika app menyimpan last-active profile, yang disimpan hanya metadata non-secret:

```text
profileId
lastActiveAt
lastKnownUrl? (opsional, sanitized)
```

Jangan simpan:

```text
cookie value
Authorization header
access token
refresh token
password
OTP
recovery code
```

Last-known URL harus melewati redaction/sanitization sebelum log/evidence.

## 12. Recovery and persistent session

Closing/recreating runtime **bukan** menghapus persistent session.

Contoh:

```text
Profile A
partition persist:profile_001
renderer crash
runtime A destroyed
runtime A recreated
partition tetap persist:profile_001
```

Expected:

- browser session identity tetap profile A;
- user tidak dipindahkan ke anonymous in-memory partition;
- tidak ada fallback ke profile lain.

## 13. Isolation during recovery

Scenario:

```text
A aktif
B tersimpan
C tersimpan
A crash
```

Expected:

- hanya runtime A yang masuk recovery;
- B/C registry dan session data tetap untouched;
- jangan menggunakan B/C sebagai fallback runtime;
- jangan reuse partition B/C untuk A;
- launcher harus tetap menampilkan identity profile dengan benar.

## 14. Recovery under runtime cap

Jika:

```text
maxActiveRuntimes = 1
```

maka recovery profile A tidak boleh menyebabkan:

```text
old A runtime + new A runtime hidup bersamaan
```

Urutan wajib:

```text
mark old runtime invalid
→ release old surface/runtime ownership
→ confirm count below cap
→ recreate A
```

## 15. Recovery with cap >1

Jika future cap 3/5 digunakan:

- recovery tetap menghormati cap;
- active profile mendapat prioritas;
- jangan evict healthy runtime secara acak jika crash target dapat direcreate setelah cleanup;
- eviction decision tetap milik Runtime Manager.

## 16. Unresponsive handling

`unresponsive` bukan selalu crash.

Policy minimum:

- tandai status sementara;
- jangan langsung menghancurkan profile pada event pertama;
- izinkan timeout/grace policy;
- jika renderer kembali `responsive`, state kembali normal;
- jika kemudian `render-process-gone`, jalankan crash flow.

Jangan membuat aggressive kill loop yang justru menyebabkan profile restart terus-menerus.

## 17. Child-process failure

`child-process-gone` dapat mewakili GPU/utility/etc.

Recovery harus mencatat minimal:

```text
type
reason
exitCode
serviceName? (jika tersedia)
```

Tidak boleh mencatat credential/session secret.

### GPU failure

Policy awal:

- log safe event;
- jangan menghapus profile;
- jangan reset partition;
- jika browser surface ikut gagal, runtime recovery dilakukan melalui path resmi;
- repeated GPU failure dapat mendorong safe mode/app-level degraded state.

### Utility failure

- jangan otomatis menganggap semua profile rusak;
- recovery scoped sesuai dampak nyata;
- jika tidak berdampak pada active runtime, app dapat tetap berjalan sambil mencatat diagnostic.

## 18. Crash loop detection

Crash loop harus dideteksi per profile dan app-level.

Contoh record:

```ts
interface CrashBudgetState {
  profileId: string;
  windowStartedAt: number;
  attempts: number;
  lastReason: string;
  blockedUntil?: number;
}
```

Data ini adalah metadata non-secret.

Crash counter tidak boleh menjadi permanen selamanya; ada reset/decay policy.

## 19. Startup crash loop

Scenario:

```text
app starts
last active profile A auto-restored
A immediately crashes
app closes/restarts
A auto-restored again
... infinite
```

Dilarang.

Setelah threshold:

```text
startup -> shell only safe mode
```

User kemudian dapat memilih tindakan manual.

## 20. Recovery actions allowed

Diperbolehkan:

- recreate runtime dengan same profile/partition;
- reload halaman melalui BrowserBackend resmi;
- reopen last safe URL jika policy mengizinkan;
- kembali ke safe start URL profile;
- mark degraded;
- stop automatic recovery.

Tidak diperbolehkan:

- membuat random partition;
- clear cookies otomatis;
- clear storage otomatis;
- copy cookie dari profile lain;
- inject token;
- spoof user-agent untuk “memperbaiki” crash;
- disable sandbox/webSecurity;
- bypass CAPTCHA/2FA/security challenge.

## 21. Recovery of navigation state

Prioritas recovery adalah session identity, bukan memaksa exact page state.

Urutan preferensi:

1. recreate same profile runtime;
2. navigate ke sanitized last-known HTTP(S) URL jika aman;
3. fallback ke configured home URL profile/workspace;
4. jangan fallback ke arbitrary external protocol.

## 22. URL safety

Recovered URL harus melewati validator existing.

Hanya:

```text
http:
https:
```

Tidak boleh merecover:

```text
javascript:
data:
file:
about:
chrome:
intent:
shell:
```

## 23. Logging

Recovery logs boleh berisi:

```text
timestamp
profileId
runtimeId
process type
crash reason
exitCode
recovery attempt number
recovery result
safe-mode state
```

Jangan berisi:

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

## 24. Evidence

Manual/automated evidence dapat menyimpan:

- test ID;
- profile test alias;
- crash reason;
- recovery state transition;
- runtime count before/after;
- PASS/FAIL;
- sanitized log excerpt.

Evidence folder tetap local-only jika berpotensi menyimpan environment-specific data.

## 25. Error handling

### Unknown runtime crash event

Expected:

- record warning;
- jangan membuat runtime baru secara spekulatif;
- jangan memilih profile berdasarkan display name.

### Profile missing from registry

Expected:

- recovery blocked;
- error aman;
- jangan membuat registry entry baru diam-diam.

### Partition mapping invalid

Expected:

- recovery blocked;
- jangan fallback ke in-memory partition;
- user diberi status profile bermasalah.

### Recreate failure

Expected:

- increment recovery attempt;
- cleanup partial runtime;
- jika budget habis → degraded/blocked.

## 26. Test hooks

Automated test future dapat memakai Electron-supported crash hooks seperti forcefully crashing renderer, tetapi test harus memahami bahwa renderer process dapat dibagi oleh multiple WebContents.

Karena itu test STEP 09 harus memastikan surface isolation dan tidak mengandalkan asumsi satu WebContents = satu OS renderer process secara mutlak.

## 27. Test matrix

### T09-01 — Renderer crash detected

Precondition:

- STEP 08 PASS;
- Profile A active.

Procedure:

1. trigger test renderer crash;
2. observe event;
3. inspect recovery state.

Expected:

- `render-process-gone` terdeteksi;
- runtime A ditandai crashed;
- safe log dibuat.

### T09-02 — Automatic first recovery

1. crash A;
2. recovery budget masih tersedia.

Expected:

- old runtime cleaned;
- new runtime dibuat melalui Runtime Manager;
- same profileId/partition digunakan;
- cap tidak terlewati.

### T09-03 — Session identity after recovery

1. login manual pada A sebelumnya;
2. crash/recover;
3. buka situs yang mengenali session.

Expected:

- identity/session A tetap benar;
- tidak berubah ke B/C/anonymous.

### T09-04 — Isolation from B/C

1. A/B/C memiliki persistent profile masing-masing;
2. crash A;
3. verify B/C.

Expected:

- B/C tidak rusak/logout akibat recovery A.

### T09-05 — Crash loop threshold

Crash A berulang hingga melewati threshold.

Expected:

- automatic recovery berhenti;
- A masuk degraded/blocked;
- no infinite loop.

### T09-06 — Unclean shutdown detection

1. start app;
2. force terminate tanpa clean shutdown;
3. start kembali.

Expected:

- previous run terdeteksi unclean;
- app masuk recovery startup path.

### T09-07 — Unclean startup respects cap

Dengan banyak stored profile:

1. force unclean shutdown;
2. relaunch.

Expected:

- tidak mass-start semua profile;
- runtime count <= configured cap.

### T09-08 — Safe mode startup

Simulasikan repeated startup crash profile A.

Expected:

- shell dapat start tanpa auto-opening A;
- registry tetap tersedia;
- user dapat memilih profile lain.

### T09-09 — Unresponsive -> responsive

1. trigger/simulate unresponsive state;
2. renderer kembali responsive.

Expected:

- tidak ada unnecessary destructive recovery;
- state kembali healthy.

### T09-10 — Child process gone

Simulasikan/observe child-process failure sesuai test capability.

Expected:

- process type/reason dicatat;
- registry/profile tidak dihapus;
- tidak salah memakai renderer recovery path secara buta.

### T09-11 — OOM reason policy

Simulasikan reason `oom` pada test abstraction jika real OOM test tidak aman.

Expected:

- recovery lebih konservatif;
- no rapid infinite reopen;
- resource pressure state dapat dicatat.

### T09-12 — Launch-failed policy

Expected:

- bounded retry;
- setelah threshold masuk degraded;
- tidak spin terus.

### T09-13 — Runtime cap regression

Ulang crash/recover 20+ kali.

Expected:

- runtime count tidak pernah melebihi cap;
- no duplicate surface.

### T09-14 — Listener leak

Ulang recovery banyak kali.

Expected:

- listener count/timer count tidak meningkat monoton tanpa batas.

### T09-15 — Shutdown during recovery

1. recovery sedang berjalan;
2. user menutup app.

Expected:

- serialized cancellation/cleanup;
- tidak ada partial registry mutation;
- shutdown marker benar sesuai hasil.

### T09-16 — Archive/delete boundary

Jika profile masuk recovery lalu pengguna mencoba archive/delete:

Expected:

- operation diserialkan;
- tidak ada delete saat runtime masih memegang resource;
- profile lain tidak terkena.

### T09-17 — Invalid last URL

Persisted/simulated last URL non-HTTP(S).

Expected:

- recovery tidak menavigasi URL tersebut;
- fallback aman dipakai.

### T09-18 — Secret audit

Audit:

- recovery logs;
- evidence;
- crash metadata;
- diagnostics.

Expected:

- tidak ada secret value.

## 28. Regression gate

Semua gate lama tetap wajib PASS:

```text
STEP 00 clean shutdown
STEP 01 browser engine
STEP 02 compatibility harness
STEP 03 persistence
STEP 04 Profile Manager
STEP 05 isolation
STEP 06 launcher
STEP 07 shortcut/workspace
STEP 08 resource management
```

Setelah implementasi STEP 09, tambahkan automated smoke/test khusus recovery.

## 29. Security gate

Tetap wajib:

```text
nodeIntegration = false
contextIsolation = true
sandbox = true
webSecurity = true
```

Recovery tidak boleh menjadi alasan untuk mematikan security setting.

## 30. Acceptance gate

STEP 09 PASS hanya jika:

- STEP 08 sudah PASS;
- renderer crash terdeteksi dengan API resmi;
- runtime dapat direcreate dengan identity profile yang sama;
- persistent session tetap konsisten;
- profile lain tidak ikut rusak;
- unclean shutdown terdeteksi;
- startup recovery tidak mass-start profile;
- retry bounded;
- safe mode bekerja;
- runtime hard cap tetap dihormati;
- listener/timer cleanup stabil;
- child-process failure tidak corrupt registry;
- security baseline tetap utuh;
- secret audit PASS;
- regression STEP 00–08 PASS.

## 31. STOP CONDITION

STOP dan jangan lanjut STEP 10 jika salah satu terjadi:

- recovery membuka partition profile yang salah;
- session hilang karena recovery normal;
- crash satu profile merusak profile lain;
- infinite recovery loop;
- runtime count melebihi cap;
- unclean startup membuka banyak profile otomatis;
- recovery menghapus cookie/storage otomatis;
- fallback ke anonymous partition diam-diam;
- listener/timer/process leak meningkat terus;
- API Electron lama/usang digunakan;
- security baseline diturunkan.

## 32. Definition of Done

Issue STEP 09 hanya boleh ditutup setelah STEP 08 completed dan semua acceptance test recovery PASS.

Baru setelah itu proyek boleh lanjut ke:

```text
STEP 10 — Logging & Diagnostics
```

## 33. Referensi implementasi

Saat implementasi final, verifikasi kembali dokumentasi Electron terbaru untuk:

- `webContents` event `render-process-gone`;
- `app` event `child-process-gone`;
- `WebContentsView` lifecycle;
- crash reporting/recovery runtime guidance.

Jangan mengandalkan event lama/deprecated.
