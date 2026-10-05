# STEP 15 — 100 Profile Registry Test

> Status: **PREPARED ONLY — BLOCKED by STEP 14**
>
> Dokumen ini adalah kontrak pengujian. Jangan menjalankan 100 Profile Registry Test sebelum STEP 14 — 50 Profile Test selesai dan PASS.

## 1. Tujuan

STEP 15 adalah scale gate terakhir sebelum Foundation v1.0 Freeze.

Target utamanya adalah membuktikan bahwa core mampu menyimpan, memuat, memvalidasi, memutasi, dan memulihkan registry berisi 100 profile tanpa:

- menyalakan 100 runtime;
- membuat duplicate surface;
- menukar session antar profile;
- merusak registry saat restart/mutation;
- menambah orphan process setiap restart;
- mengalami resource growth tanpa batas;
- membocorkan credential/session secret ke log atau diagnostics.

STEP 15 bukan benchmark untuk menjalankan 100 browser sekaligus.

## 2. Dependency gate

STEP 15 hanya boleh dieksekusi setelah:

```text
STEP 11 — 3 Account Stability Test PASS
STEP 12 — 10 Profile Test PASS
STEP 13 — 25 Profile Test PASS
STEP 14 — 50 Profile Test PASS
                    ↓
STEP 15 — 100 Profile Registry Test
```

Jika STEP 14 masih OPEN/BLOCKED/FAIL, STEP 15 hanya boleh berada pada status PREPARED.

## 3. Prinsip arsitektur wajib

### 3.1 Stored profile bukan active runtime

```text
stored profiles = 100
maxActiveRuntimes = 1   # baseline
```

Yang dilarang:

```text
100 stored profiles
→ 100 WebContentsView aktif
→ 100 workload browser aktif
```

Registry scale harus tetap dipisahkan dari runtime concurrency.

### 3.2 Tiga akun nyata tetap menjadi isolation canary

Gunakan kembali:

```text
profile_001 -> account A
profile_002 -> account B
profile_003 -> account C
```

Profile lain:

```text
profile_004 ... profile_100
```

boleh berupa test profile normal tanpa login eksternal.

Tidak perlu 100 akun nyata.

### 3.3 Security baseline tidak boleh diturunkan

Dilarang menggunakan STEP 15 untuk:

- auto-login password;
- auto-submit OTP/2FA;
- CAPTCHA bypass;
- session cloning;
- cookie/token export-import;
- credential harvesting;
- fingerprint spoofing;
- anti-detection;
- quota/limit evasion;
- menonaktifkan webSecurity/contextIsolation/sandbox hanya agar test lolos.

## 4. Test population

Target minimum:

| Range | Jenis | Keterangan |
|---|---|---|
| profile_001 | real-account canary | account A |
| profile_002 | real-account canary | account B |
| profile_003 | real-account canary | account C |
| profile_004–015 | test profiles | early range |
| profile_016–030 | test profiles | quarter range |
| profile_031–044 | test profiles | early-middle |
| profile_045–055 | test profiles | middle |
| profile_056–069 | test profiles | late-middle |
| profile_070–080 | test profiles | late range |
| profile_081–089 | test profiles | near-end |
| profile_090–100 | test profiles | end range |

Semua profile wajib mempunyai:

- immutable `profileId`;
- deterministic persistent partition descriptor;
- valid lifecycle state;
- non-secret registry metadata;
- tidak ada duplicate profileId;
- tidak ada duplicate partition.

## 5. Registry invariants

Sebelum stress test, audit seluruh registry.

Minimum invariant:

```text
storedProfileCount == 100
unique(profileId).count == 100
unique(partition).count == 100
activeRuntimeCount <= maxActiveRuntimes
```

Untuk setiap profile:

```text
profileId tetap sama setelah:
- restart
- rename
- archive/unarchive
- close/reopen runtime

partition tetap sama setelah:
- restart
- rename
- archive/unarchive
- close/reopen runtime
```

Rename hanya mengubah display metadata.

## 6. Registry schema validation

### T15-01 — Full registry validation

Lakukan validasi seluruh 100 entry.

Per entry minimum:

- `profileId` valid;
- partition valid;
- partition milik profile yang sama;
- lifecycle state dikenali;
- tidak ada field credential/session secret;
- tidak ada duplicate key;
- tidak ada path traversal atau malformed descriptor.

PASS bila semua 100 entry valid dan validasi tidak perlu membaca isi cookie/token/session.

## 7. Cold-start test

### T15-02 — Cold start 100 profile

1. pastikan 100 profile tersimpan;
2. tutup app clean;
3. start app;
4. ukur registry-load start sampai registry ready;
5. verifikasi count = 100;
6. verifikasi launcher mendapatkan metadata profile;
7. verifikasi runtime tidak dibuat massal.

Catat:

```text
coldRegistryLoadMs
registryValidationMs
launcherListReadyMs
activeRuntimeCount
```

PASS bila registry siap tanpa corruption dan runtime count tetap sesuai policy.

## 8. Warm reload test

### T15-03 — Registry reload

Reload metadata registry tanpa membuat semua runtime.

Catat:

```text
warmRegistryReloadMs
registryValidationMs
storedProfileCount
processCountBefore
processCountAfter
```

PASS bila reload kedua/berikutnya tidak menambah process/listener/timer secara terus-menerus.

## 9. Repeated restart loop

### T15-04 — Clean restart loop

Minimal 10 restart clean dengan 100 stored profiles.

Per cycle:

- registry count = 100;
- uniqueness PASS;
- runtime cap dihormati;
- tidak ada orphan process baru yang menumpuk;
- load time dicatat;
- diagnostics tetap dapat dibuat.

Yang dicari:

- load time makin buruk setiap restart;
- process count makin naik;
- registry entry hilang/duplikat;
- active runtime salah dipulihkan.

## 10. Controlled unclean restart

### T15-05 — Unclean shutdown

Simulasikan shutdown tidak bersih melalui test harness yang aman.

Pada startup berikutnya:

- unclean state terdeteksi;
- registry tetap terbaca;
- tidak ada mass restore 100 runtime;
- profile A/B/C tetap pada mapping yang benar;
- recovery tidak menghapus session profile lain;
- recovery evidence tidak berisi secret.

## 11. Sequential traversal

### T15-06 — Forward traversal

Urutan:

```text
001 -> 002 -> ... -> 100 -> 001
```

Minimal 2 cycle.

Setiap transition harus memastikan:

- requested `profileId` benar;
- partition benar;
- previous runtime dibersihkan sesuai policy;
- `activeRuntimeCount <= 1` pada baseline;
- active marker launcher benar;
- tidak ada duplicate WebContentsView.

## 12. Reverse traversal

### T15-07 — Reverse traversal

Urutan:

```text
100 -> 099 -> ... -> 001 -> 100
```

Minimal 1 cycle.

Tujuan:

- menangkap bug index/order;
- memastikan identity tidak bergantung posisi array;
- memastikan profile awal/akhir diperlakukan sama.

## 13. Deterministic mixed stress

### T15-08 — 1000+ seeded transitions

Gunakan deterministic PRNG dengan seed tetap.

Contoh:

```text
seed = step15-100-profile-v1
transitionCount >= 1000
```

Sequence lengkap boleh direkam sebagai daftar profileId.

PASS bila:

- sequence dapat direproduksi;
- tidak ada deadlock;
- tidak ada transition hilang tanpa error jelas;
- runtime cap tidak terlewati;
- tidak ada duplicate surface;
- tidak ada cross-session.

## 14. Same-profile idempotency

### T15-09 — Repeated open

Ulangi:

```text
open(profile_010) x 25
open(profile_050) x 25
open(profile_100) x 25
```

Expected:

- satu logical runtime per target aktif;
- repeated request boleh coalesce;
- tidak membuat 25 surface;
- state akhir deterministic.

## 15. Rapid-switch serialization

### T15-10 — Cross-range burst

Contoh burst:

```text
004 -> 098 -> 027 -> 075 -> 001 -> 050 -> 100 -> 003 -> 044 -> 081
```

Expected:

- transition serialized;
- tidak attach dua active surface bila cap=1;
- target final deterministic;
- tidak ada partition bleed dari previous profile.

## 16. Real-account isolation canary

### T15-11 — Verify A/B/C

Verifikasi manual:

```text
profile_001 -> account A
profile_002 -> account B
profile_003 -> account C
```

Lakukan switching melalui test profiles di antaranya.

Satu kejadian berikut = FAIL keras:

- account A muncul di profile B/C;
- account B muncul di profile A/C;
- account C muncul di profile A/B;
- test profile mewarisi login A/B/C.

## 17. Lifecycle mutation ranges

Mutation wajib mencakup beberapa area registry.

Minimum kelompok:

```text
early: 004–015
quarter: 020–030
middle: 045–055
late: 070–080
end: 090–100
```

### T15-12 — Rename

Rename minimal satu profile dari tiap kelompok.

Expected:

```text
profileId unchanged
partition unchanged
session identity unchanged
```

### T15-13 — Archive / unarchive

Archive subset profile.

Expected:

- archived profile mengikuti launch policy;
- partition/session identity tidak dihapus;
- unarchive memulihkan profile yang sama.

### T15-14 — Batch archive/unarchive

Archive lalu unarchive minimal 10 test profiles.

PASS bila:

- registry count konsisten;
- lifecycle state tepat;
- tidak membuat runtime massal;
- profile lain tidak berubah.

### T15-15 — Delete/recreate test profile

Hapus beberapa test profile sesuai permanent-delete policy.

Verifikasi:

- hanya target terhapus;
- profile lain tetap utuh;
- recreate mengikuti policy ID baru/reuse yang sudah ditentukan oleh Profile Manager;
- tidak mengadopsi session profile lain.

## 18. Hard runtime cap

### T15-16 — Runtime-cap audit

Sepanjang test baseline:

```text
maxActiveRuntimes = 1
```

Catat high-water mark runtime count.

PASS bila:

```text
maxObservedActiveRuntimes <= 1
```

Jika implementation mendukung cap lain untuk eksperimen, baseline STEP 15 tetap menggunakan cap 1.

## 19. Inactive/background inactivity

### T15-17 — Inactive profiles

Setelah berpindah melalui banyak profile, pastikan profile yang tidak aktif tidak mempertahankan workload browser tanpa alasan.

Audit minimum:

- active surface count;
- runtime registry count;
- process count trend;
- listener/timer counters bila tersedia;
- recovery timers.

Persistent storage boleh tetap ada di disk. Runtime browser tidak boleh tetap hidup hanya karena profile pernah dibuka.

## 20. Resource trend observation

### T15-18 — Before/after stress

Ambil health snapshot:

```text
before 1000 transitions
after 1000 transitions
after cleanup/idle
```

Amati:

- memory;
- process count;
- active runtime count;
- listener count proxy;
- timer/retry count;
- crash/recovery counter.

Tidak perlu menetapkan angka RAM universal untuk semua PC.

Yang dilarang adalah growth tak bounded yang tidak turun setelah cleanup/idle.

## 21. Registry latency trend

### T15-19 — Timing stability

Bandingkan:

```text
coldRegistryLoadMs
warmRegistryReloadMs
registryValidationMs
launcherListReadyMs
```

pada beberapa restart.

STOP bila timing makin buruk terus tanpa perubahan data dan disertai process/listener/resource growth.

## 22. Registry corruption boundary

### T15-20 — One malformed test entry

Gunakan controlled test fixture, bukan profile real user.

Tujuan:

- satu malformed test entry tidak membuat semua 100 profile tidak dapat dipakai;
- error menunjukkan profile/entry yang bermasalah;
- recovery tidak diam-diam menghapus profile lain;
- aplikasi tidak membaca cookie/token untuk memperbaiki registry metadata.

Expected policy dapat berupa:

- reject invalid entry dan lanjut load valid entries; atau
- safe-mode registry recovery dengan explicit diagnostics.

Yang penting behavior deterministic dan terdokumentasi.

## 23. Registry backup/recovery metadata

### T15-21 — Metadata recovery

Jika RegistryService memakai backup metadata:

- backup harus non-secret;
- restore tidak boleh mengganti partition identity profile valid;
- restore tidak boleh membuat duplicate profileId;
- corrupt primary registry tidak boleh menyebabkan backup session/cookie export.

Session browser tetap dimiliki Chromium/Electron partition, bukan JSON backup manual.

## 24. Renderer crash/recovery

### T15-22 — Crash one active canary

Gunakan test crash mechanism yang sudah disiapkan STEP 09.

Expected:

- crash terdeteksi;
- bounded recovery;
- same `profileId`;
- same partition;
- profile lain tidak logout/corrupt;
- runtime cap tetap dihormati.

## 25. Diagnostics correctness

### T15-23 — 100-profile diagnostics

Diagnostics minimal melaporkan secara aman:

```text
storedProfileCount = 100
activeRuntimeCount
maxActiveRuntimes
archivedProfileCount
crashCount
recoveryCount
clean/unclean previous shutdown
app/Electron/Node/OS version
safe resource/process metrics
```

Diagnostics tidak boleh berisi:

- password;
- OTP;
- cookie value;
- Authorization header;
- access token;
- refresh token;
- session token;
- raw DOM;
- raw localStorage/sessionStorage content.

## 26. Secret scan

### T15-24 — Output secret scan

Scan:

- logs;
- evidence;
- diagnostics bundle;
- registry metadata fixture/output.

Gunakan synthetic secret patterns untuk memastikan redaction benar.

PASS bila synthetic secrets tidak muncul di output final.

## 27. Failure classification

Setiap failure diklasifikasikan minimal sebagai:

```text
REGISTRY_CORRUPTION
IDENTITY_MISMATCH
PARTITION_DUPLICATE
CROSS_SESSION
RUNTIME_CAP_BREACH
DUPLICATE_SURFACE
SWITCH_DEADLOCK
RESOURCE_LEAK
ORPHAN_PROCESS
RECOVERY_FAILURE
DIAGNOSTIC_MISMATCH
SECRET_LEAK
PERFORMANCE_REGRESSION
```

Jangan menutup failure dengan label generik seperti `unknown` bila evidence cukup untuk klasifikasi.

## 28. Reproducibility contract

Setiap stress run harus mencatat:

- run ID;
- timestamp;
- commit SHA;
- app/Electron version;
- test seed;
- transition count;
- profile population count;
- runtime cap;
- PASS/FAIL per scenario.

Jangan mencatat email account nyata atau credential.

## 29. Evidence format minimum

Contoh aman:

```text
runId: step15-2026-xx-xx-001
storedProfiles: 100
realAccountCanaryProfiles: profile_001/profile_002/profile_003
maxActiveRuntimes: 1
seed: step15-100-profile-v1
transitionCount: 1000
maxObservedActiveRuntimes: 1
uniquenessCheck: PASS
restartLoop: PASS
resourceTrend: PASS
secretScan: PASS
finalResult: PASS
```

## 30. Regression gate

Sebelum STEP 15 dianggap PASS, regression minimal harus mencakup seluruh behavior STEP 00–14 yang relevan.

Target:

- build/typecheck/lint/unit test PASS;
- STEP 00 clean-shutdown behavior PASS;
- STEP 01 BrowserBackend behavior PASS;
- STEP 02 compatibility contract tetap tidak diregresikan;
- persistence/isolation/profile manager/runtime manager/recovery/logging/diagnostics behavior PASS;
- 3/10/25/50 profile gates tidak kehilangan invariant.

## 31. Acceptance matrix

STEP 15 PASS hanya bila semua kondisi berikut terpenuhi:

- [ ] STEP 14 PASS lebih dulu;
- [ ] 100 stored profiles terbentuk;
- [ ] 100 unique profileId;
- [ ] 100 unique partition;
- [ ] cold start registry PASS;
- [ ] warm reload PASS;
- [ ] repeated clean restart PASS;
- [ ] controlled unclean restart PASS;
- [ ] forward traversal PASS;
- [ ] reverse traversal PASS;
- [ ] 1000+ deterministic transitions PASS;
- [ ] same-profile idempotency PASS;
- [ ] rapid-switch serialization PASS;
- [ ] account A/B/C isolation PASS;
- [ ] rename across ranges PASS;
- [ ] archive/unarchive PASS;
- [ ] batch lifecycle mutation PASS;
- [ ] delete/recreate test profile PASS;
- [ ] hard runtime cap PASS;
- [ ] inactive/background inactivity PASS;
- [ ] resource trend bounded;
- [ ] registry timing stable/non-pathological;
- [ ] controlled corruption boundary PASS;
- [ ] metadata recovery PASS bila applicable;
- [ ] renderer crash/recovery PASS;
- [ ] diagnostics count PASS;
- [ ] secret scan PASS;
- [ ] regression STEP 00–14 PASS.

## 32. STOP CONDITION

STOP dan jangan lanjut STEP 16 — Foundation v1.0 Freeze jika salah satu terjadi:

- duplicate `profileId`;
- duplicate partition;
- cross-session/account leak sekali pun;
- runtime cap terlewati tanpa policy;
- duplicate runtime/surface;
- switching deadlock atau nondeterministic identity;
- registry corrupt/hilang setelah restart/mutation;
- satu corrupt test entry membuat seluruh registry unrecoverable tanpa safe path;
- inactive profile tetap menjalankan workload tanpa alasan;
- orphan process bertambah setiap restart;
- memory/listener/timer/process count tumbuh tanpa batas;
- registry latency memburuk terus bersama resource growth;
- crash satu profile merusak profile lain;
- diagnostics/log/evidence mengandung secret;
- test hanya bisa PASS dengan menurunkan security baseline.

## 33. Definition of Done

Issue STEP 15 hanya boleh ditutup setelah:

1. STEP 14 sudah completed;
2. seluruh 100-profile registry matrix PASS;
3. evidence aman tersedia;
4. tidak ada blocker isolation/persistence/resource/recovery/security;
5. regression STEP 00–14 PASS.

Setelah itu barulah STEP 16 — Foundation v1.0 Freeze boleh dimulai.

## 34. Catatan untuk implementer

STEP 15 bukan alasan untuk mengoptimalkan secara prematur dengan mengubah security boundary.

Prioritas tetap:

```text
correct identity
> session isolation
> deterministic lifecycle
> bounded runtime/resource
> recoverability
> diagnostics
> performance optimization
```

Jika performa 100 profile buruk, perbaiki struktur registry/runtime ownership terlebih dahulu. Jangan mengganti isolation dengan shared session, cloning cookie, atau trik anti-detection.

## 35. Ringkasan target akhir

```text
100 stored profiles
3 real-account isolation canaries
97 test profiles
maxActiveRuntimes = 1
100 unique profileId
100 unique partition
1000+ deterministic transitions
10+ restart cycles
bounded resource trend
safe diagnostics
zero cross-session
zero secret leak
```

Jika semua ini terbukti PASS setelah dependency chain selesai, target scale pondasi v1.0 dapat dianggap tervalidasi dan proyek boleh masuk STEP 16 — Foundation v1.0 Freeze.
