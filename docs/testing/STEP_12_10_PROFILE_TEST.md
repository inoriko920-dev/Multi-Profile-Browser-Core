# STEP 12 — 10 Profile Test

> Status: **PREPARED ONLY — BLOCKED by STEP 11**
>
> Dokumen ini adalah kontrak test. Jangan menjalankan STEP 12 sebelum STEP 11 — 3 Account Stability Test selesai dan PASS.

## 1. Tujuan

STEP 12 adalah scale gate pertama setelah end-to-end stability tiga akun. Tujuannya bukan membuktikan kemampuan menjalankan sepuluh browser sekaligus, tetapi membuktikan bahwa core mampu menyimpan, membaca, mengelola, dan berpindah di antara sepuluh profile tanpa merusak identity/session dan tanpa melanggar hard runtime cap.

Target utama:

```text
stored profiles = 10
active runtime cap = 1
real logged-in profiles = 3
additional test profiles = 7
```

Prinsip penting:

```text
10 profile tersimpan != 10 runtime aktif
```

## 2. Dependency gate

STEP 12 hanya boleh dijalankan setelah:

```text
STEP 10 Logging & Diagnostics PASS
        ↓
STEP 11 3 Account Stability Test PASS
        ↓
STEP 12 10 Profile Test
```

STEP 11 harus sudah membuktikan tiga account nyata tidak pernah tertukar. STEP 12 kemudian memperbesar tekanan pada registry, lifecycle, runtime switching, restart, diagnostics, dan recovery.

## 3. Test population

Gunakan sepuluh profile:

| Profile | Tipe | Login nyata wajib |
|---|---|---|
| profile_001 | Real A | Ya |
| profile_002 | Real B | Ya |
| profile_003 | Real C | Ya |
| profile_004 | Test | Tidak |
| profile_005 | Test | Tidak |
| profile_006 | Test | Tidak |
| profile_007 | Test | Tidak |
| profile_008 | Test | Tidak |
| profile_009 | Test | Tidak |
| profile_010 | Test | Tidak |

Test profile bukan fake cookie/session. Profile tersebut adalah profile normal tanpa kewajiban login account eksternal.

Dilarang:

- membuat cookie/token sintetis agar terlihat login;
- menyalin cookie profile A ke test profile;
- mengimpor storage profile lain;
- mengotomatisasi password/OTP/CAPTCHA;
- melakukan fingerprint spoofing atau anti-detection.

## 4. Identity invariant

Setiap profile harus memiliki identitas immutable:

```text
profileId -> partition
```

Contoh target:

```text
profile_001 -> persist:profile_001
profile_002 -> persist:profile_002
...
profile_010 -> persist:profile_010
```

Display name boleh berubah. Mapping identity tidak boleh berubah akibat rename, archive, restart, switching, recovery, atau diagnostics.

## 5. Preflight

Sebelum test:

- STEP 11 berstatus PASS;
- registry dapat dibaca tanpa error;
- ketiga real profile masih memiliki identity/session yang benar;
- `maxActiveRuntimes = 1`;
- diagnostics service aktif;
- recovery service aktif;
- structured logger aktif;
- secret scanner tersedia;
- tidak ada profile dalam state migrasi setengah selesai;
- previous shutdown state diketahui.

Jika salah satu syarat gagal, jangan mulai matrix STEP 12.

## 6. Registry creation test

Buat profile sampai total sepuluh.

Verifikasi untuk setiap row registry:

- profileId unik;
- partition unik;
- status valid;
- createdAt valid;
- display name bukan authority identity;
- tidak ada secret credential di registry.

Expected:

```text
storedProfileCount = 10
activeRuntimeCount <= 1
```

Membuat profile ke-10 tidak boleh menyalakan sepuluh runtime.

## 7. Cold restart registry test

Setelah sepuluh profile tersimpan:

1. tutup aplikasi secara normal;
2. buka kembali;
3. baca seluruh registry;
4. verifikasi jumlah profile = 10;
5. verifikasi mapping identity sama;
6. pastikan app tidak otomatis membuka seluruh profile.

PASS jika registry utuh dan runtime count tetap mengikuti cap.

## 8. Sequential switching test

Sequence:

```text
001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007 -> 008 -> 009 -> 010 -> 001
```

Ulang minimal 10 cycle.

Pada setiap transition cek:

- hanya target profile menjadi active;
- previous runtime selesai ditutup/evict sesuai policy;
- tidak ada duplicate surface;
- active runtime count tidak > 1;
- active profile label sesuai runtime sebenarnya;
- navigation/history tidak diarahkan ke surface profile lama.

## 9. Reverse switching test

Sequence:

```text
010 -> 009 -> 008 -> 007 -> 006 -> 005 -> 004 -> 003 -> 002 -> 001 -> 010
```

Ulang minimal 5 cycle.

Tujuannya mendeteksi bug yang hanya muncul saat urutan switching dibalik.

## 10. Deterministic mixed stress

Gunakan seeded sequence agar reproducible.

Contoh seed logical:

```text
STEP12-SEED-001
```

Generate minimal 100 target transitions dari profile 001–010.

Simpan hanya target profileId sequence, bukan credential atau konten halaman.

Jika failure terjadi pada transition ke-63, developer harus dapat menjalankan sequence yang sama dan mengulang failure.

## 11. Repeated-open idempotency

Pada profile aktif lakukan request open yang sama berulang kali.

Contoh:

```text
open profile_005 x 20
```

Expected:

- tetap satu logical runtime;
- tetap satu browser surface;
- tidak ada duplicate listener;
- tidak ada duplicate navigation yang tidak diperlukan;
- runtime cap tetap 1.

## 12. Rapid switching / serialization

Simulasikan request cepat:

```text
001 -> 008 -> 003 -> 010 -> 002
```

Request boleh datang sebelum transition sebelumnya selesai.

RuntimeManager wajib men-serialize atau menolak request secara deterministic.

Final active profile harus dapat diprediksi berdasarkan contract queue/cancellation yang ditetapkan pada STEP 08.

Tidak boleh terjadi kondisi dua runtime sama-sama merasa active.

## 13. Real-account isolation subset

Pada profile 001/002/003 verifikasi manual:

- account A hanya terlihat di profile 001;
- account B hanya terlihat di profile 002;
- account C hanya terlihat di profile 003.

Kemudian buka profile test 004–010.

Profile test tidak boleh tiba-tiba menampilkan session A/B/C.

Satu kejadian cross-session = blocker.

## 14. Rename test

Rename minimal tiga profile, termasuk satu real profile dan dua test profile.

Verifikasi:

```text
profileId unchanged
partition unchanged
session identity unchanged
```

Display name hanyalah metadata.

## 15. Archive / unarchive test

Archive beberapa test profile dan satu real profile.

Verifikasi:

- archived profile tidak ditampilkan sebagai active launcher target normal bila policy demikian;
- session data tidak dihapus;
- unarchive mengembalikan profile yang sama;
- partition tetap sama;
- profile lain tidak berubah.

## 16. Delete isolation test

Permanent delete hanya dilakukan pada test profile tanpa account penting.

Prosedur:

1. pilih satu test profile;
2. capture registry mapping non-secret;
3. delete melalui flow resmi;
4. restart app;
5. verifikasi target hilang;
6. verifikasi sembilan profile lain utuh.

Delete target tidak boleh menghapus profile directory/session milik profile lain.

Jika implementasi memakai tombstone/soft-delete sebelum physical cleanup, test harus mengikuti contract tersebut.

## 17. Recreate-after-delete test

Jika product policy mengizinkan membuat profile baru setelah delete:

- profile baru mendapat identity baru sesuai allocator policy;
- jangan diam-diam mewarisi partition/session profile yang sudah dihapus;
- old deleted identity tidak boleh hidup kembali karena display name sama.

## 18. Clean restart after stress

Setelah sequential + reverse + mixed switching:

1. ambil diagnostic snapshot;
2. clean shutdown;
3. relaunch;
4. verifikasi registry count/state;
5. buka profile A/B/C satu per satu;
6. pastikan identity/session tetap benar.

## 19. Unclean shutdown test

Dengan sepuluh stored profiles:

- hanya satu runtime aktif;
- paksa terminate app sesuai test procedure STEP 09;
- relaunch;
- previous shutdown harus terdeteksi unclean;
- aplikasi tidak boleh mass-restore 10 runtime;
- registry tidak boleh corrupt;
- recovery tetap menghormati cap.

## 20. Renderer crash test

Crash/recreate hanya salah satu runtime melalui test hook resmi.

Expected:

- crash dikaitkan dengan profile yang benar;
- RecoveryManager tidak memilih partition lain;
- registry 10 profile tetap utuh;
- runtime cap tetap dipatuhi;
- profile lain tidak logout/corrupt.

## 21. Runtime cap verification

Sepanjang test, monitor invariant:

```text
activeRuntimeCount <= maxActiveRuntimes
```

Baseline STEP 12:

```text
maxActiveRuntimes = 1
```

Jika diagnostics satu kali saja mencatat count > 1 tanpa transition policy yang secara eksplisit mengizinkannya, test gagal.

## 22. Background inactivity test

Setelah berpindah dari satu profile ke profile lain, profile inactive tidak boleh terus memiliki browser workload aktif secara tidak terkendali.

Periksa:

- runtime registry;
- WebContents ownership;
- process count;
- listener count bila instrumentation tersedia;
- CPU/memory trend.

Persistent session di disk boleh tetap ada. Runtime bukan session.

## 23. Memory/resource observation

Capture snapshot pada titik:

```text
S0 = setelah startup
S1 = setelah membuat/load 10 profile
S2 = setelah 50 switch
S3 = setelah 100+ switch
S4 = setelah clean restart
```

Jangan menetapkan angka RAM absolut sebagai universal PASS/FAIL tanpa baseline perangkat.

Yang dicari terutama:

- pertumbuhan monoton yang tidak turun;
- duplicate renderer process;
- runtime count leak;
- listener/timer leak;
- retained WebContents yang seharusnya sudah closed.

## 24. Diagnostics correctness

Diagnostic snapshot minimal harus dapat melaporkan:

```text
storedProfileCount = 10
activeRuntimeCount = 0 atau 1
maxActiveRuntimes = 1
recoveryState
previousShutdownState
appVersion
ElectronVersion
```

Nilai diagnostic harus sesuai state sebenarnya.

Diagnostics tidak boleh membaca cookie/token/DOM untuk menentukan apakah profile sehat.

## 25. Secret scan

Masukkan synthetic secret ke test input logger yang memang ditujukan menguji redaction.

Contoh kategori synthetic:

```text
password
Authorization: Bearer ...
access_token
refresh_token
cookie
OTP
recovery_code
URL query token
```

Setelah run, scan:

- current logs;
- rotated logs;
- diagnostic snapshot;
- diagnostic bundle;
- evidence file.

Semua synthetic secret harus tidak ditemukan dalam bentuk raw.

## 26. Registry integrity test

Validasi invariant:

```text
count(profileId) = count(distinct profileId)
count(partition) = count(distinct partition)
```

Untuk active/non-deleted profile, tidak boleh ada collision partition.

Check juga orphan metadata setelah delete/archive/restart.

## 27. Launcher consistency

Launcher harus menampilkan state yang sama dengan ProfileManager.

Test:

- create profile;
- rename;
- archive;
- unarchive;
- delete test profile;
- restart.

UI tidak boleh mempertahankan ghost row yang sebenarnya sudah hilang dari registry.

## 28. Workspace/shortcut regression

Pada subset profile real dan test:

- gunakan shortcut registry;
- pastikan shortcut hanya melakukan navigation pada runtime profile aktif;
- jangan membuat runtime baru di luar RuntimeManager;
- race shortcut selama switching harus mengikuti contract STEP 07.

## 29. Test matrix

| ID | Scenario | Expected |
|---|---|---|
| T12-01 | Create/load 10 profiles | PASS, unique identities |
| T12-02 | Cold restart | 10 profiles retained |
| T12-03 | Sequential 10-cycle | no cross-session/leak |
| T12-04 | Reverse 5-cycle | no cross-session/leak |
| T12-05 | Seeded 100-switch | deterministic PASS |
| T12-06 | Repeated open x20 | idempotent |
| T12-07 | Rapid switching | serialized |
| T12-08 | A/B/C real isolation | no account crossover |
| T12-09 | Test profiles 004–010 | no inherited login |
| T12-10 | Rename | identity unchanged |
| T12-11 | Archive/unarchive | identity unchanged |
| T12-12 | Delete one test profile | others untouched |
| T12-13 | Recreate after delete | no old session inheritance |
| T12-14 | Clean restart after stress | registry/session intact |
| T12-15 | Unclean shutdown | no mass restore/corruption |
| T12-16 | Renderer crash/recovery | same profile partition |
| T12-17 | Hard cap | never exceed baseline cap |
| T12-18 | Background inactivity | inactive runtime released |
| T12-19 | Resource snapshots | no unbounded trend |
| T12-20 | Diagnostics counts | correct |
| T12-21 | Secret scan | zero raw secrets |
| T12-22 | Registry uniqueness | no collisions |
| T12-23 | Launcher lifecycle | no ghost/stale row |
| T12-24 | Workspace shortcuts | active profile only |
| T12-25 | Regression STEP 00–11 | all PASS |

## 30. Evidence format

Simpan evidence lokal, bukan credential.

Contoh:

```text
STEP12_RUN_ID
startedAt
completedAt
appVersion
ElectronVersion
storedProfileCount
maxActiveRuntimes
seed
switchCount
registryUniqueness: PASS/FAIL
realAccountIsolation: PASS/FAIL
restart: PASS/FAIL
uncleanRecovery: PASS/FAIL
runtimeCap: PASS/FAIL
secretScan: PASS/FAIL
resourceObservation: PASS/FAIL
finalResult
```

Jangan simpan email account A/B/C; label A/B/C cukup.

## 31. Failure classification

Gunakan kategori:

- BLOCKER — cross-session, partition mismatch, secret leak, registry corruption;
- CRITICAL — hard-cap bypass, delete corruption, unrecoverable crash;
- MAJOR — repeated runtime leak, restart inconsistency, stale launcher state;
- MINOR — cosmetic/evidence formatting yang tidak memengaruhi correctness.

BLOCKER atau CRITICAL menghentikan progression.

## 32. Acceptance gate

STEP 12 PASS hanya jika seluruh kondisi ini benar:

- STEP 11 telah PASS;
- sepuluh profile dapat disimpan dan dimuat ulang;
- seluruh profileId unik;
- seluruh persistent partition unik;
- A/B/C tetap terisolasi;
- test profile tidak mewarisi session real profile;
- 100+ switch tidak membuat duplicate runtime/surface;
- hard cap tidak terlewati;
- inactive runtime dilepas sesuai policy;
- rename/archive/unarchive/delete aman;
- clean/unclean restart tidak corrupt registry;
- crash recovery tidak menukar profile;
- diagnostics state benar;
- resource usage tidak menunjukkan leak tak terbatas;
- secret scan PASS;
- regression STEP 00–11 PASS.

## 33. STOP CONDITION

STOP dan jangan lanjut STEP 13 jika:

- terjadi cross-session sekali pun;
- mapping profileId/partition berubah tanpa migration resmi;
- duplicate partition ditemukan;
- hard cap runtime gagal;
- inactive profiles tetap menjalankan workload massal;
- registry corrupt setelah restart;
- delete satu profile merusak profile lain;
- memory/process/listener leak terus bertambah;
- recovery membuka profile yang salah;
- log/evidence/bundle membocorkan secret;
- solusi membutuhkan penurunan security baseline.

## 34. Definition of Done

STEP 12 selesai hanya setelah Issue STEP 12 dinyatakan PASS berdasarkan evidence yang dapat direproduksi.

Sesudah itu baru buka:

```text
STEP 13 — 25 Profile Test
```

STEP 13 tetap tidak memerlukan 25 akun nyata. Scale berikutnya memperbesar jumlah stored profile dan tekanan registry/resource, sementara real-account isolation subset tetap menggunakan akun nyata yang sudah tervalidasi.