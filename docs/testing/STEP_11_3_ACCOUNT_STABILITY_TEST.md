# STEP 11 — 3 Account Stability Test

> Status: **PREPARED ONLY — BLOCKED by STEP 10**
>
> Dokumen ini adalah kontrak pengujian. Jangan menjalankan STEP 11 sebagai gate resmi sebelum STEP 10 — Logging & Diagnostics selesai dan PASS.

## 1. Tujuan

STEP 11 adalah stability gate pertama yang menggunakan beberapa profile persistent dan beberapa akun nyata secara bersamaan dalam satu aplikasi. Tujuannya bukan menguji jumlah profile yang besar, tetapi membuktikan bahwa fondasi yang dibangun dari STEP 03–10 benar-benar bekerja pada kondisi multi-account yang realistis.

Yang harus dibuktikan:

- tiga profile mempunyai identity dan persistent partition yang berbeda;
- login setiap account bertahan setelah restart;
- switching tidak pernah menyebabkan session silang;
- runtime cap tetap dihormati;
- rename/archive/unarchive tidak merusak identity;
- renderer crash pada satu profile dapat dipulihkan tanpa merusak dua profile lain;
- unclean shutdown tidak menukar profile/account;
- logging/diagnostics cukup untuk mencari bug tetapi tidak membocorkan secret;
- repeated switching tidak menyebabkan resource leak tak terbatas.

STEP 11 bukan benchmark performa besar dan bukan test 100 akun.

## 2. Dependency gate

Urutan wajib:

```text
STEP 03 Persistent Session
        ↓
STEP 04 Profile Manager
        ↓
STEP 05 Multi-Profile Isolation
        ↓
STEP 06 Profile Launcher
        ↓
STEP 07 Shortcut / Workspace
        ↓
STEP 08 Resource Management
        ↓
STEP 09 Recovery System
        ↓
STEP 10 Logging & Diagnostics
        ↓
STEP 11 3 Account Stability Test
```

STEP 11 hanya boleh mulai setelah seluruh STEP 00–10 PASS.

## 3. Test identity

Gunakan tiga profile persistent:

```text
profile_001 -> persist:profile_001 -> Account A
profile_002 -> persist:profile_002 -> Account B
profile_003 -> persist:profile_003 -> Account C
```

Account A/B/C harus berbeda.

Tidak perlu mencatat alamat email ke evidence. Cukup:

```text
Account A
Account B
Account C
```

atau `profileId`.

### 3.1 Data yang tidak boleh dicatat

- password;
- OTP;
- recovery code;
- cookie value;
- Authorization header;
- OAuth code;
- access token;
- refresh token;
- session token;
- raw localStorage/sessionStorage;
- screenshot halaman account tanpa explicit user action.

## 4. Test environment baseline

Minimum:

```text
OS: Windows 11
maxActiveRuntimes: 1
stored profiles: 3
active browser surface: <= 1
network: normal internet connection
login: manual
```

Catat versi aman:

- app version/commit SHA;
- Electron version;
- Chromium version;
- Node version;
- Windows build bila relevan;
- test run ID.

## 5. Precondition

Sebelum test:

1. STEP 10 PASS.
2. Registry sehat.
3. Tidak ada migration pending.
4. `profile_001`, `profile_002`, `profile_003` mempunyai partition immutable masing-masing.
5. `maxActiveRuntimes = 1` untuk baseline.
6. Logging redaction aktif.
7. Diagnostics secret scan aktif.
8. Recovery crash budget aktif.
9. Evidence directory bersifat lokal / ignored dari Git.

Jika salah satu precondition gagal, test tidak valid.

## 6. Initial account setup

### T11-01 — Profile identity check

Untuk masing-masing profile:

- resolve profile dari registry;
- verify profileId unik;
- verify partition unik;
- verify display name bukan sumber partition.

PASS jika:

```text
profile_001 != profile_002 != profile_003
persist:profile_001 != persist:profile_002 != persist:profile_003
```

### T11-02 — Manual login Account A/B/C

Login manual:

```text
Profile 01 -> Account A
Profile 02 -> Account B
Profile 03 -> Account C
```

Password, 2FA, CAPTCHA/security challenge tetap dilakukan pengguna.

PASS jika setiap account hanya terlihat di profile miliknya.

### T11-03 — Immediate isolation verification

Sesudah login ketiganya:

- buka Profile A;
- verify Account A;
- pindah ke B;
- verify Account B;
- pindah ke C;
- verify Account C;
- kembali A.

Tidak boleh ada cross-session.

## 7. Persistence tests

### T11-04 — Clean restart persistence

1. Buka A dan verify identity.
2. Tutup aplikasi normal.
3. Start app kembali.
4. Buka A/B/C satu per satu.

PASS:

- A tetap A;
- B tetap B;
- C tetap C;
- tidak diminta login ulang kecuali provider sendiri memang melakukan challenge sah;
- mapping partition tidak berubah.

### T11-05 — Repeated clean restart

Ulangi restart minimal 5 kali.

Setiap restart verify A/B/C.

PASS bila mapping dan session tetap konsisten.

## 8. Switching stability tests

### T11-06 — Baseline switching loop

Sequence:

```text
A -> B -> C -> A
```

Satu cycle = empat target di atas.

Lakukan minimal 25 cycle.

Record:

- active profileId;
- active runtime count;
- peak runtime count;
- surface count;
- navigation result;
- safe memory/process snapshot pada interval yang ditentukan.

PASS bila:

- tidak ada account mismatch;
- tidak ada duplicate runtime;
- active runtime <= cap;
- surface lama ditutup/detach benar;
- history/nav tetap bekerja.

### T11-07 — Mixed switching stress loop

Sequence:

```text
A -> B -> A -> C -> B -> C -> A
```

Ulangi minimal 10 cycle.

Tujuan: menemukan race yang tidak terlihat pada sequence linear.

### T11-08 — Rapid repeated click

Klik profile target yang sama berulang cepat.

Contoh:

```text
A, A, A, A
B, B, B
C, C
```

PASS jika open bersifat idempotent dan tidak membuat runtime/surface duplikat.

### T11-09 — Rapid cross-profile request

Input cepat:

```text
A -> B -> C -> B -> A
```

Switch queue harus serialized.

Final surface harus sesuai target terakhir yang diterima secara valid.

## 9. Workspace / shortcut tests

### T11-10 — Shortcut follows active profile

Untuk setiap profile:

- pilih profile;
- klik Google/YouTube/Drive atau target preset yang aman untuk test;
- verify target dibuka pada runtime/profile aktif.

Shortcut tidak boleh membuat partition sendiri.

### T11-11 — Shortcut during profile switching

Saat switch in-progress:

- shortcut harus disabled atau menunggu queue;
- tidak boleh menavigasi profile lama secara tidak deterministik.

## 10. Profile lifecycle stability

### T11-12 — Rename Profile B

Rename display name Profile B.

PASS:

- profileId sama;
- partition sama;
- Account B tetap sama;
- A/C tidak berubah.

### T11-13 — Archive / unarchive Profile C

1. Archive C.
2. Pastikan C tidak dapat dibuka dari launcher normal.
3. Unarchive C.
4. Buka kembali.

PASS jika Account C/session tetap profile C dan A/B tidak terpengaruh.

### T11-14 — Restart after rename/archive lifecycle

Restart app setelah lifecycle operation.

Verify registry dan session mapping tetap konsisten.

## 11. Runtime management tests

### T11-15 — Hard cap enforcement

Dengan baseline:

```text
maxActiveRuntimes = 1
```

Selama seluruh test, `activeRuntimeCount` tidak boleh > 1.

Jika >1 tanpa policy explicit, FAIL blocker.

### T11-16 — Close/reopen runtime without deleting session

- buka A;
- close/evict runtime A;
- buka B;
- kembali A.

Persistent session A harus tetap tersedia.

### T11-17 — 100+ switch cleanup observation

Akumulasi total minimal 100 switch request yang valid.

Bandingkan:

- process count awal/akhir;
- active runtime count;
- listener counters bila tersedia;
- timer counters bila tersedia;
- memory trend.

Test tidak mensyaratkan memory identik, tetapi tidak boleh ada pertumbuhan monoton tak terbatas yang menunjukkan leak jelas.

## 12. Crash and recovery tests

### T11-18 — Renderer crash Profile B

Simulasikan renderer/runtime crash melalui test hook yang aman.

PASS jika:

1. event crash dideteksi;
2. B masuk recovery policy;
3. surface invalid dibersihkan;
4. retry tetap bounded;
5. B dibuka lagi dengan `profile_002` / `persist:profile_002`;
6. Account B tetap B;
7. A/C tetap sehat.

### T11-19 — Repeated crash -> degraded/safe mode

Paksa crash B sampai melewati retry budget.

PASS jika recovery berhenti pada state `degraded`/`blocked`, bukan infinite loop.

### T11-20 — Crash A then switch C

Sesudah A crash, user memilih C.

Recovery A tidak boleh mengambil ownership surface dari C secara tidak terkendali.

Runtime cap tetap dihormati.

## 13. Unclean shutdown tests

### T11-21 — Forced app termination

1. Buka salah satu profile.
2. Force-kill app melalui test procedure.
3. Start kembali.

PASS:

- previous shutdown terdeteksi unclean;
- registry tetap sehat;
- app tidak mass-restore A/B/C sekaligus;
- profile mapping tetap benar;
- user dapat membuka A/B/C dan identity tetap sesuai.

### T11-22 — Unclean shutdown during switch

Force termination saat switch A -> B sedang berlangsung.

Setelah restart, app harus memilih state aman dan tidak menganggap dua profile aktif bersamaan.

## 14. Diagnostics and logging tests

### T11-23 — Health snapshot

Snapshot minimum harus menunjukkan:

- stored profile count = 3;
- active runtime count;
- maxActiveRuntimes;
- recovery counters;
- clean/unclean state;
- safe process metrics;
- app/runtime version.

Tidak perlu membaca cookie/token untuk menghasilkan snapshot.

### T11-24 — Diagnostic bundle

Buat bundle setelah:

- normal switching run;
- renderer crash/recovery;
- unclean shutdown recovery.

Bundle harus dapat dibuka dan mempunyai manifest.

### T11-25 — Synthetic secret scan

Masukkan synthetic secret melalui jalur test logger yang resmi.

Verify output bundle/log hanya menyimpan `[REDACTED]` atau nilai aman.

FAIL blocker bila synthetic secret muncul mentah.

## 15. Navigation/history tests

### T11-26 — Back/Forward/Reload after switching

Untuk setiap profile:

- navigate minimal dua URL;
- Back;
- Forward;
- Reload.

History harus milik current runtime/profile dan tidak diwariskan dari profile lain.

### T11-27 — Invalid URL / blocked protocol

Test input seperti non-HTTP(S) yang tidak diizinkan.

Policy harus tetap sama pada A/B/C dan tidak memengaruhi session.

## 16. Long-run stability

### T11-28 — 30 minute endurance baseline

Jalankan penggunaan normal minimal 30 menit dengan switching berkala.

Observasi:

- memory trend;
- CPU idle/active behavior;
- process count;
- runtime count;
- log size;
- crash count.

### T11-29 — 60 minute extended run

Disarankan sebelum menutup STEP 11.

Tidak wajib menjalankan tiga runtime bersamaan. Justru baseline tetap cap=1.

## 17. Session isolation verification matrix

| Scenario | A | B | C | Expected |
|---|---|---|---|---|
| Login | Account A | Account B | Account C | berbeda |
| Restart | A | B | C | tetap |
| Rename B | A | B | C | B identity tetap |
| Archive C | A | B | hidden | session C tidak hilang |
| Unarchive C | A | B | C | identity kembali sama |
| Crash B | A | recovering B | C | A/C sehat |
| Unclean shutdown | A | B | C | mapping tetap |

## 18. Resource stability acceptance

Tidak gunakan satu angka RAM absolut sebagai satu-satunya gate karena penggunaan memory Chromium tergantung website dan OS.

Gunakan kombinasi:

- active runtime count bounded;
- process count tidak meningkat tanpa batas;
- switching cycle tidak menambah permanent listener/timer per cycle;
- memory dapat naik/turun tetapi tidak menunjukkan leak monoton jelas;
- closed runtime tidak tetap dianggap active;
- renderer process lama benar-benar release setelah lifecycle selesai.

Jika ditemukan growth trend, lakukan repeat test dengan halaman lokal/blank untuk memisahkan leak app vs website.

## 19. Evidence format

Simpan evidence lokal, misalnya:

```text
evidence/
└─ step11/
   ├─ run-<timestamp>/
   │  ├─ summary.md
   │  ├─ stability-results.json
   │  ├─ diagnostics-manifest.json
   │  └─ secret-scan.txt
```

Evidence folder harus masuk `.gitignore`.

### summary.md minimum

```text
Run ID:
Commit:
App version:
Electron version:
OS:
Profile A: profile_001
Profile B: profile_002
Profile C: profile_003
Baseline cycles: 25
Stress cycles: 10
Total switch requests:
Peak active runtime count:
Crash tests:
Unclean-shutdown tests:
Secret scan:
Final result: PASS / FAIL
```

Jangan tulis alamat email/password/token.

## 20. Failure classification

### BLOCKER

- cross-session/account leak;
- wrong partition;
- lost persistent identity;
- runtime hard-cap violation;
- infinite recovery loop;
- secret leak;
- registry corruption;
- crash satu profile merusak profile lain.

### HIGH

- repeated switch duplicate runtime sementara tetapi recover;
- significant resource leak;
- archive/rename inconsistency;
- diagnostic bundle gagal setelah crash.

### MEDIUM

- UI indicator terlambat tetapi underlying profile benar;
- non-critical log/event mismatch;
- minor navigation state inconsistency.

STEP 11 tidak boleh PASS jika ada BLOCKER atau unresolved HIGH yang menyentuh isolation/persistence/resource/recovery.

## 21. Test execution phases

### Phase A — Functional

T11-01 sampai T11-17.

### Phase B — Recovery

T11-18 sampai T11-22.

### Phase C — Diagnostics

T11-23 sampai T11-25.

### Phase D — Navigation

T11-26 sampai T11-27.

### Phase E — Endurance

T11-28 sampai T11-29.

Urutan ini memudahkan mencari penyebab kegagalan.

## 22. Required regression

Sebelum STEP 11 PASS, ulangi regression penting:

- STEP 00 clean-shutdown;
- STEP 01 browser engine;
- STEP 02 login compatibility;
- STEP 03 persistent single profile;
- STEP 04 Profile Manager;
- STEP 05 isolation;
- STEP 06 launcher;
- STEP 07 workspace/shortcut;
- STEP 08 runtime cap/resource management;
- STEP 09 recovery;
- STEP 10 logging/diagnostics.

## 23. STOP CONDITION

STOP dan jangan lanjut STEP 12 jika salah satu terjadi:

- satu account muncul pada profile yang salah;
- partition mapping berubah;
- login persistence hilang akibat switching biasa;
- runtime melebihi cap;
- duplicate surface terus tertinggal;
- resource usage tumbuh tanpa batas pada test terkontrol;
- crash profile A/B/C merusak profile lain;
- unclean shutdown mengacaukan active profile state;
- diagnostic/log mengandung secret;
- test hanya PASS setelah sandbox/webSecurity/security baseline diturunkan.

## 24. Definition of Done

STEP 11 PASS hanya jika:

- STEP 00–10 sudah PASS;
- tiga akun nyata berhasil dipetakan ke tiga persistent profile yang benar;
- persistence restart PASS;
- baseline 25 cycle PASS;
- stress 10 cycle PASS;
- 100+ total switch observation tidak menemukan duplicate/leak blocker;
- lifecycle rename/archive/unarchive PASS;
- crash/recovery PASS;
- unclean shutdown PASS;
- runtime cap PASS;
- diagnostics/secret scan PASS;
- tidak ada cross-session leak;
- evidence aman tersedia.

Setelah STEP 11 PASS baru boleh masuk **STEP 12 — 10 Profile Test**.

## 25. Catatan untuk STEP 12–15

STEP 11 adalah satu-satunya scale gate awal yang memang membutuhkan tiga account nyata berbeda untuk membuktikan isolation end-to-end.

Untuk STEP 12–15:

```text
10 / 25 / 50 / 100 stored profiles
```

tidak berarti wajib login ke semua akun nyata.

Scale registry/resource test boleh memakai:

- metadata test profile;
- deterministic dummy profile records;
- subset kecil profile dengan login manual nyata;
- local test pages untuk resource/lifecycle stress.

Tujuannya mencegah test berubah menjadi kebutuhan mengelola puluhan akun eksternal yang tidak perlu.
