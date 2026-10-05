# STEP 14 — 50 Profile Test

> Status: **PREPARED ONLY — BLOCKED by STEP 13**
>
> Dokumen ini adalah kontrak pengujian. Jangan menjalankan 50 Profile Test sebelum STEP 13 — 25 Profile Test selesai dan PASS.

## 1. Tujuan

STEP 14 membuktikan fondasi browser tetap stabil ketika registry menyimpan 50 profile.

Target bukan menjalankan 50 browser sekaligus. Targetnya adalah membuktikan bahwa sistem dapat:

- menyimpan 50 profile secara konsisten;
- memuat registry 50 profile tanpa corruption;
- mempertahankan mapping `profileId -> partition` secara unik dan immutable;
- membuka hanya runtime yang diperlukan;
- menutup runtime lama secara bersih;
- melakukan switching dalam jumlah besar tanpa duplicate surface/runtime;
- bertahan melalui clean restart dan unclean restart;
- mempertahankan isolation tiga akun nyata sebagai canary;
- menjaga resource trend tetap bounded;
- menghasilkan diagnostics aman tanpa secret.

STEP 14 adalah jembatan antara 25-profile stress test dan STEP 15 — 100 Profile Registry Test.

## 2. Dependency gate

STEP 14 hanya boleh dieksekusi setelah:

```text
STEP 11 — 3 Account Stability Test PASS
STEP 12 — 10 Profile Test PASS
STEP 13 — 25 Profile Test PASS
                    ↓
STEP 14 — 50 Profile Test
```

Jika STEP 13 masih OPEN/BLOCKED/FAIL, STEP 14 hanya boleh berada pada status PREPARED.

## 3. Prinsip arsitektur wajib

### 3.1 Stored profile bukan active runtime

```text
stored profiles = 50
maxActiveRuntimes = 1   # baseline
```

Tidak boleh mengubah desain menjadi:

```text
50 stored profiles
→ 50 WebContentsView aktif
→ 50 session workload aktif
```

Registry scale dan runtime scale adalah dua hal berbeda.

### 3.2 Tiga akun nyata tetap menjadi isolation canary

Gunakan kembali:

```text
profile_001 -> account A
profile_002 -> account B
profile_003 -> account C
```

Tidak perlu 50 akun nyata.

Profile lain:

```text
profile_004 ... profile_050
```

boleh berupa test profile normal tanpa external login.

### 3.3 Tidak ada shortcut keamanan

Dilarang menggunakan STEP 14 untuk:

- auto-login password;
- auto-submit OTP/2FA;
- CAPTCHA bypass;
- cookie/token import-export;
- session cloning;
- fingerprint spoofing;
- anti-detection;
- security weakening;
- quota/limit evasion.

## 4. Test population

Target minimum:

| Range | Jenis | Keterangan |
|---|---|---|
| profile_001 | real-account canary | account A |
| profile_002 | real-account canary | account B |
| profile_003 | real-account canary | account C |
| profile_004–010 | test profiles | kelompok awal |
| profile_011–019 | test profiles | kelompok early-middle |
| profile_020–030 | test profiles | kelompok tengah |
| profile_031–039 | test profiles | kelompok late-middle |
| profile_040–050 | test profiles | kelompok akhir |

Semua profile wajib mempunyai:

- immutable `profileId`;
- deterministic partition descriptor;
- lifecycle state valid;
- tidak ada secret dalam registry metadata;
- tidak ada duplicate partition.

## 5. Registry invariants

Sebelum stress test, lakukan audit seluruh 50 entry.

Minimum invariant:

```text
storedProfileCount == 50
unique(profileId).count == 50
unique(partition).count == 50
```

Untuk setiap profile:

```text
partition(profile_X) tetap sama setelah:
- restart
- rename
- archive/unarchive
- close/reopen runtime
```

Rename hanya boleh mengubah display metadata.

## 6. Cold-start test

### T14-01 — Cold start 50 profile

1. pastikan 50 profile tersimpan;
2. tutup app clean;
3. start app;
4. ukur waktu dari registry load start sampai registry ready;
5. verifikasi count = 50;
6. verifikasi tidak ada runtime massal otomatis.

PASS bila:

- registry terbaca valid;
- UI/launcher mendapatkan 50 metadata profile;
- runtime count tetap sesuai policy;
- tidak ada duplicate profile;
- startup tidak memerlukan pembacaan session secret.

## 7. Registry latency observation

STEP 14 mulai mencatat performa registry secara eksplisit.

Catat minimal:

```text
coldRegistryLoadMs
warmRegistryReloadMs
registryValidationMs
launcherListReadyMs
```

Tujuannya bukan menetapkan angka absolut lintas semua PC.

Yang dicari adalah pola buruk seperti:

- load time meningkat setiap restart;
- reload kedua lebih buruk tanpa alasan;
- registry validation bergantung pada membuka runtime;
- jumlah process bertambah setiap reload;
- satu entry corrupt membuat seluruh registry tidak dapat dipakai.

## 8. Sequential switching test

### T14-02 — Forward sequence

Urutan:

```text
001 -> 002 -> ... -> 050 -> 001
```

Minimal 3 cycle.

Setelah setiap switch:

- target profileId benar;
- target partition benar;
- previous runtime selesai ditutup bila cap = 1;
- active runtime count tidak melebihi cap;
- tidak ada duplicate WebContentsView untuk target yang sama;
- launcher active marker benar.

## 9. Reverse switching test

### T14-03 — Reverse sequence

Urutan:

```text
050 -> 049 -> ... -> 001 -> 050
```

Minimal 2 cycle.

Tujuan:

- menangkap bug index/order;
- memastikan urutan registry tidak menjadi source of identity;
- memastikan profile akhir/awal mempunyai behavior sama.

## 10. Deterministic mixed stress

### T14-04 — 500+ seeded switches

Gunakan deterministic PRNG/seed tetap untuk menghasilkan minimal 500 target switch.

Contoh evidence aman:

```text
seed = step14-50-profile-v1
switchCount = 500
```

Sequence lengkap boleh dicatat sebagai daftar `profileId` karena tidak mengandung credential.

Dilarang mencatat:

- account email;
- cookie value;
- token;
- password;
- OTP.

PASS bila:

- sequence dapat direproduksi;
- runtime cap tidak pernah terlewati;
- tidak ada duplicate surface;
- tidak ada cross-session;
- switching queue selesai tanpa deadlock.

## 11. Repeated-open idempotency

### T14-05 — Same-profile spam

Untuk profile aktif:

```text
open(profile_025) x 20
```

Expected:

- tetap satu logical runtime;
- tidak membuat 20 WebContentsView;
- request boleh collapse/coalesce;
- state akhir deterministic.

Ulangi pada:

```text
profile_004
profile_025
profile_050
```

## 12. Rapid-switch serialization

### T14-06 — Rapid cross-range switching

Contoh input cepat:

```text
004 -> 047 -> 021 -> 050 -> 001 -> 033 -> 002 -> 045
```

Sistem wajib:

- serialize transition;
- tidak attach dua active surfaces secara bersamaan bila cap=1;
- tidak membuka target dengan partition profile sebelumnya;
- memiliki final active state yang deterministic.

## 13. Real-account isolation canary

### T14-07 — Account A/B/C

Verifikasi manual:

```text
profile_001 -> account A
profile_002 -> account B
profile_003 -> account C
```

Lakukan switching berulang ke test profiles di antaranya.

Expected:

- account A tidak pernah terlihat di profile B/C;
- account B tidak pernah terlihat di profile A/C;
- account C tidak pernah terlihat di profile A/B;
- test profile tidak tiba-tiba mewarisi login A/B/C.

Satu cross-session event = FAIL keras.

## 14. Lifecycle mutation lintas rentang

STEP 14 wajib menguji mutation pada profile awal, tengah, dan akhir.

Contoh target:

```text
profile_006
profile_024
profile_047
```

### T14-08 — Rename

Rename display name.

Expected:

```text
profileId unchanged
partition unchanged
session identity unchanged
```

### T14-09 — Archive / unarchive

Expected:

- archive mencegah launch normal sesuai policy;
- persistent session tidak terhapus;
- unarchive mengembalikan profile yang sama.

### T14-10 — Delete test profile

Hanya gunakan test profile tanpa account penting.

Expected:

- delete terisolasi;
- profile lain tetap utuh;
- deleted ID tidak diam-diam menunjuk partition profile lain;
- recreate mengikuti ID-generation policy resmi.

## 15. Clean restart loop

### T14-11 — Repeated clean restart

Lakukan minimal 10 cycle:

```text
start
load registry 50
open selected profile
close clean
repeat
```

Catat:

- registry load timing;
- process count summary;
- active runtime count;
- clean-shutdown marker;
- memory summary aman.

Cari trend:

```text
cycle 1 < cycle 2 < ... < cycle 10 secara terus-menerus
```

yang dapat menunjukkan leak/accumulation.

## 16. Unclean shutdown

### T14-12 — Unclean exit with 50 stored profiles

Simulasikan termination sesuai test harness STEP 09/10.

Saat start berikutnya:

- previous shutdown terdeteksi unclean;
- registry tetap bisa dimuat;
- jangan auto-open 50 runtime;
- safe recovery policy berlaku;
- A/B/C mapping tetap benar.

## 17. Renderer crash recovery

### T14-13 — Crash one active runtime

Gunakan mekanisme test resmi pada satu profile canary.

Expected:

- crash scoped ke runtime aktif;
- registry 50 profile tidak berubah;
- recovery memakai profile/partition yang sama;
- profile lain tidak logout/corrupt;
- retry bounded.

## 18. Runtime hard-cap validation

### T14-14 — Hard cap = 1

Selama seluruh test:

```text
observedActiveRuntimeCount <= 1
```

Jika suatu transition membutuhkan state sementara, definisi state harus eksplisit dan tidak boleh menghasilkan dua active remote workloads tanpa policy.

Diagnostics wajib dapat menunjukkan pelanggaran cap sebagai error.

## 19. Background inactivity

### T14-15 — Inactive profile audit

Saat satu runtime aktif dan 49 profile idle/stored:

- tidak boleh ada 49 browser surfaces hidup;
- tidak boleh ada mass refresh;
- tidak boleh ada timer per-profile yang terus melakukan navigation;
- tidak boleh ada background login check semua profile.

Stored metadata boleh berada di memory secara ringan.

## 20. Resource observation

Catat snapshot pada titik:

```text
R0 = setelah cold start
R1 = setelah sequential cycles
R2 = setelah reverse cycles
R3 = setelah 500 seeded switches
R4 = setelah restart loop
R5 = setelah crash/recovery
```

Minimum data aman:

- active runtime count;
- Electron process count/type;
- app memory summary;
- CPU snapshot;
- known listener/timer counts bila tersedia dari internal diagnostics;
- stored profile count.

Tidak perlu menetapkan RAM absolut universal.

FAIL bila trend menunjukkan pertumbuhan tanpa bounded cleanup.

## 21. Listener and timer cleanup

### T14-16 — Subscription growth audit

Setelah 500+ switches:

- listener browser surface lama harus dilepas;
- timer navigation lama harus dibersihkan;
- crash listeners tidak boleh terdaftar berulang setiap reopen;
- IPC handler tidak boleh bertambah per profile switch.

Gunakan safe internal counters bila tersedia.

## 22. Diagnostics correctness

### T14-17 — Health snapshot

Expected minimum:

```text
storedProfileCount: 50
activeRuntimeCount: 0 atau 1
maxActiveRuntimes: 1
registryHealthy: true
```

Saat profile aktif, diagnostics boleh menyertakan safe `profileId`/`runtimeId`.

Diagnostics tidak boleh membaca cookie/token/DOM.

## 23. Diagnostic bundle

### T14-18 — Export safe bundle

Bundle minimum boleh berisi:

- manifest;
- safe app/version info;
- sanitized logs;
- safe diagnostics snapshot;
- STEP 14 result summary;
- resource trend summary;
- seed/switch count.

Dilarang:

- profile session database;
- Cookies file;
- raw Local Storage;
- Authorization header;
- password/OTP/token;
- screenshot remote page otomatis.

## 24. Secret scan

### T14-19 — Synthetic secret test

Inject synthetic test strings melalui jalur log test, misalnya:

```text
password = STEP14_FAKE_PASSWORD
access_token = STEP14_FAKE_ACCESS_TOKEN
Authorization = Bearer STEP14_FAKE_BEARER
```

Expected:

- tidak muncul raw pada log;
- tidak muncul raw pada evidence;
- tidak muncul raw pada diagnostic bundle.

## 25. Registry corruption boundary

### T14-20 — One invalid test entry

Gunakan controlled fixture, bukan profile pengguna nyata.

Expected:

- invalid entry ditolak/quarantine sesuai policy;
- aplikasi tidak mengasosiasikan invalid ID dengan partition lain;
- error terdiagnosis aman;
- registry yang valid tidak dihancurkan massal.

## 26. Deletion isolation

### T14-21 — Multi-delete test profiles

Delete beberapa test profiles dari rentang berbeda.

Verifikasi:

- hanya target yang hilang;
- profile A/B/C tidak berubah;
- partition target tidak salah menunjuk profile lain;
- diagnostics count sesuai state final.

Jika target test kemudian dibuat ulang, gunakan ID policy resmi—jangan secara diam-diam reuse identity lama bila policy melarang.

## 27. Launcher behavior dengan 50 profile

### T14-22 — List and selection

UI sederhana harus:

- menampilkan 50 profile secara konsisten;
- selection berdasarkan `profileId`, bukan row index semata;
- rename/archive tidak menyebabkan selection berpindah ke profile lain;
- sorting/filtering future tidak boleh mengubah identity mapping.

Tidak perlu membuat UI kompleks untuk PASS STEP 14.

## 28. Test profile tidak membutuhkan account nyata

Profile 004–050 tidak wajib login website eksternal.

Untuk membuktikan isolation lokal, test profiles dapat memakai controlled origin/local test page dengan sentinel data non-secret.

Contoh:

```text
profile_004 sentinel = P004
profile_025 sentinel = P025
profile_050 sentinel = P050
```

Sentinel profile lain tidak boleh terlihat saat membuka profile berbeda.

## 29. Persistence sentinel

### T14-23 — Controlled persistence

Pada subset test profiles, tulis controlled non-secret local persistence marker.

Restart app.

Expected:

- marker kembali hanya di partition yang benar;
- marker tidak muncul pada profile lain;
- profileId/partition mapping tetap konsisten.

Ini tidak menggantikan real-account persistence canary A/B/C.

## 30. Failure classification

Setiap FAIL dikategorikan minimal sebagai:

```text
REGISTRY
IDENTITY_MAPPING
SESSION_ISOLATION
RUNTIME_CAP
SWITCH_SERIALIZATION
RESOURCE_LEAK
RECOVERY
DIAGNOSTICS
SECRET_REDACTION
PERFORMANCE_REGRESSION
UNKNOWN
```

Tujuannya agar implementer tidak menambal gejala tanpa mengetahui subsystem penyebab.

## 31. Evidence format

Evidence lokal yang aman dapat memakai struktur:

```text
evidence/step14/
├─ summary.md
├─ switching-seed.txt
├─ timings.json
├─ resource-summary.json
├─ results.json
└─ secret-scan.txt
```

Folder evidence tetap ignored dari Git kecuali explicitly sanitized fixture.

## 32. Minimum result schema

Contoh konseptual:

```json
{
  "step": 14,
  "storedProfileCount": 50,
  "maxActiveRuntimes": 1,
  "seededSwitchCount": 500,
  "uniquenessPass": true,
  "realAccountIsolationPass": true,
  "registryRestartPass": true,
  "resourceTrendPass": true,
  "secretScanPass": true,
  "result": "PASS"
}
```

Tidak boleh ada account email/token di file hasil.

## 33. Acceptance matrix

### T14-01
Cold-start registry 50.

### T14-02
Sequential switching.

### T14-03
Reverse switching.

### T14-04
500+ seeded switching.

### T14-05
Repeated-open idempotency.

### T14-06
Rapid-switch serialization.

### T14-07
A/B/C real-account isolation.

### T14-08
Rename identity stability.

### T14-09
Archive/unarchive identity stability.

### T14-10
Delete isolation.

### T14-11
10x clean restart loop.

### T14-12
Unclean shutdown recovery.

### T14-13
Renderer crash recovery.

### T14-14
Runtime hard-cap validation.

### T14-15
Inactive background audit.

### T14-16
Listener/timer cleanup.

### T14-17
Diagnostics health snapshot.

### T14-18
Safe diagnostic bundle.

### T14-19
Synthetic secret scan.

### T14-20
Controlled registry corruption boundary.

### T14-21
Multi-delete isolation.

### T14-22
Launcher 50-profile consistency.

### T14-23
Controlled persistence sentinel.

## 34. Acceptance gate utama

STEP 14 PASS hanya bila seluruh kondisi berikut benar:

- STEP 13 sudah PASS;
- registry memuat 50 profile secara konsisten;
- seluruh profileId unik;
- seluruh partition unik;
- mapping profileId -> partition stabil setelah restart/mutation;
- account A/B/C tidak pernah silang;
- test profiles tidak mewarisi session A/B/C;
- 500+ switch selesai tanpa duplicate runtime/surface;
- `maxActiveRuntimes = 1` tidak pernah dilanggar pada baseline;
- inactive profiles tidak menjalankan workload browser massal;
- clean restart loop tidak menambah orphan runtime/process;
- unclean recovery tidak mass-restore 50 runtime;
- renderer crash terisolasi;
- lifecycle mutation profile-scoped;
- diagnostics count sesuai state nyata;
- registry latency tidak menunjukkan degradasi patologis antar cycle;
- memory/process/listener/timer trend bounded;
- synthetic secret scan PASS;
- regression STEP 00–13 PASS.

## 35. STOP CONDITION

**STOP dan jangan lanjut STEP 15** jika salah satu terjadi:

- duplicate profileId;
- duplicate/incorrect partition mapping;
- account/session silang sekali pun;
- runtime cap dapat ditembus;
- switch queue deadlock atau menciptakan duplicate surface;
- inactive profiles terus hidup sebagai browser runtime;
- registry corrupt setelah restart/mutation;
- clean restart menghasilkan process accumulation;
- crash satu profile merusak profile lain;
- registry load/reload semakin lambat tanpa bounded reason;
- resource trend terus naik tanpa cleanup;
- log/evidence/bundle membocorkan secret;
- solusi membutuhkan menurunkan Electron security baseline.

## 36. Definition of Done

Issue STEP 14 hanya boleh ditutup setelah:

1. STEP 13 completed;
2. seluruh T14-01 sampai T14-23 PASS;
3. secret scan PASS;
4. regression STEP 00–13 PASS;
5. evidence aman tersedia;
6. tidak ada unresolved P0/P1 defect terkait registry, isolation, persistence, runtime cap, recovery, resource leak, atau secret exposure.

Setelah itu baru **STEP 15 — 100 Profile Registry Test** boleh dimulai.
