# STEP 13 — 25 Profile Test

> Status: **PREPARED ONLY — BLOCKED by STEP 12**
>
> Dokumen ini adalah kontrak scale-test. Jangan menjalankan STEP 13 sebelum STEP 12 — 10 Profile Test selesai dan PASS.

## 1. Tujuan

STEP 13 membuktikan bahwa fondasi Multi-Profile-Browser-Core tetap stabil ketika jumlah profile tersimpan dinaikkan dari 10 menjadi 25.

Fokus utama bukan menjalankan 25 browser sekaligus. Fokusnya adalah memastikan:

- registry tetap konsisten pada 25 profile;
- mapping `profileId -> partition` tetap unik dan immutable;
- profile dapat dibuka/ditutup bergantian tanpa duplicate runtime;
- hard cap runtime tetap dihormati;
- session tiga akun nyata tetap terisolasi;
- test profiles tidak pernah mengambil session profile nyata;
- restart bersih maupun unclean tidak merusak registry;
- lifecycle mutation tetap profile-scoped;
- resource usage tidak tumbuh tanpa batas setelah ratusan switch;
- diagnostics tetap akurat pada skala 25 profile;
- logs/evidence tetap bebas secret.

STEP 13 adalah scale gate antara STEP 12 (10 profile) dan STEP 14 (50 profile).

## 2. Dependency gate

STEP 13 hanya boleh dijalankan setelah:

```text
STEP 11 — 3 Account Stability Test PASS
            ↓
STEP 12 — 10 Profile Test PASS
            ↓
STEP 13 — 25 Profile Test
```

Jika STEP 12 masih memiliki failure pada registry, switching, lifecycle, runtime cap, recovery, diagnostics, atau secret scan, STEP 13 harus tetap BLOCKED.

## 3. Prinsip dasar

### 3.1 Stored profiles bukan active runtimes

Target:

```text
storedProfiles = 25
maxActiveRuntimes = 1
```

Artinya:

- 25 profile boleh terdaftar;
- 25 persistent session descriptor boleh ada;
- tetapi baseline hanya satu runtime/browser surface aktif;
- membuka profile baru harus menutup atau mengganti runtime lama sesuai RuntimeManager policy;
- inactive profile tidak boleh hidup sebagai browser background tanpa policy eksplisit.

### 3.2 Tidak perlu 25 akun nyata

Population minimum:

```text
profile_001 -> real account A
profile_002 -> real account B
profile_003 -> real account C
profile_004 -> test profile
...
profile_025 -> test profile
```

Tiga akun nyata dari STEP 11 dipakai sebagai canary end-to-end untuk mendeteksi cross-session leakage.

Profile 004–025 tidak memerlukan credential atau login eksternal.

### 3.3 Test profile tetap profile normal

Test profile harus dibuat melalui Profile Manager yang sama, bukan registry injection khusus yang melewati lifecycle normal.

Dilarang:

- membuat row registry palsu yang tidak mengikuti schema;
- menggunakan partition bersama;
- menggunakan cookie/token hasil copy profile lain;
- mengisi credential otomatis;
- menonaktifkan security baseline demi mempercepat test.

## 4. Test population contract

Semua 25 profile harus memiliki:

```ts
interface ProfileRecord {
  profileId: string;
  displayName: string;
  partition: string;
  state: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}
```

Konsep mapping:

```text
profile_001 -> persist:profile_001
profile_002 -> persist:profile_002
...
profile_025 -> persist:profile_025
```

Partition name final harus mengikuti kontrak implementation yang sudah dibuktikan di STEP 03–05.

Yang wajib:

- `profileId` immutable;
- partition deterministic;
- rename tidak mengubah partition;
- archive tidak mengubah partition;
- runtime close tidak menghapus partition;
- delete hanya menghapus target profile sesuai delete policy resmi.

## 5. Pre-test checklist

Sebelum test:

- STEP 12 status PASS;
- regression STEP 00–12 PASS;
- registry backup/evidence aman tersedia;
- profile 001–003 masih memiliki identity/session yang benar;
- logs directory writable;
- DiagnosticsService aktif;
- RecoveryManager aktif;
- `maxActiveRuntimes = 1`;
- tidak ada stale runtime sebelum test dimulai;
- secret scanner siap dijalankan pada output test.

## 6. Scenario A — create/load 25 profiles

### A1. Create missing profiles

Jika STEP 12 sudah memiliki 10 profile, tambahkan profile 011–025 melalui Profile Manager normal.

Expected:

```text
stored profile count = 25
active runtime count <= 1
```

### A2. Registry uniqueness

Validasi:

- semua `profileId` unik;
- semua partition unik;
- tidak ada empty profileId;
- tidak ada duplicate display-independent identity;
- tidak ada orphan registry entry;
- tidak ada profile pointing ke partition profile lain.

### A3. Cold restart

Tutup app cleanly lalu buka ulang.

Expected:

- stored count tetap 25;
- mapping tetap identik;
- archived/active state tetap sesuai;
- tidak ada mass runtime restore.

## 7. Scenario B — sequential switching

Urutan:

```text
001 -> 002 -> 003 -> ... -> 024 -> 025 -> 001
```

Minimum: 5 cycle.

Total switch minimum kira-kira 125+ transition.

Untuk setiap transition:

- target profile resolved benar;
- runtime lama ditutup sesuai policy;
- target runtime dibuat sekali;
- tidak ada duplicate `WebContentsView`;
- runtime count tidak > cap;
- UI active profile sesuai RuntimeManager state.

## 8. Scenario C — reverse switching

Urutan:

```text
025 -> 024 -> 023 -> ... -> 002 -> 001 -> 025
```

Minimum: 3 cycle.

Tujuan:

- memastikan tidak ada bug yang hanya muncul saat traversal satu arah;
- menguji lookup profile ID pada rentang akhir-ke-awal;
- memastikan eviction/switch logic tidak bias terhadap recent insertion order.

## 9. Scenario D — deterministic seeded stress

Gunakan seeded pseudo-random sequence minimal 250 switch.

Contoh konsep:

```text
seed = STEP13_25_PROFILE_BASELINE_V1
count = 250
profileRange = 001..025
```

Sequence harus direkam sebagai evidence non-secret agar failure bisa diulang.

Aturan:

- seed sama harus menghasilkan sequence sama;
- tidak boleh membuka lebih dari cap runtime;
- repeated target boleh terjadi dan harus idempotent;
- transition saat target sama dengan active profile tidak boleh membuat duplicate runtime;
- rapid request harus diserialisasi.

## 10. Scenario E — repeated-open idempotency

Pilih beberapa profile representatif:

```text
001
003
010
013
019
025
```

Untuk tiap profile:

- trigger open 10 kali berurutan;
- trigger double-click/rapid-click pattern;
- verify hanya satu runtime target;
- verify runtime ownership tidak berubah secara salah;
- verify listener count tidak bertambah setiap click.

## 11. Scenario F — rapid switch race

Gunakan sequence cepat:

```text
001 -> 025 -> 002 -> 024 -> 003 -> 023 -> 004 -> 022
```

Lalu:

```text
005 -> 015 -> 010 -> 020 -> 001
```

Expected:

- switch queue deterministic;
- tidak ada dua profile mengklaim active state bersamaan;
- target terakhir sesuai queue/policy;
- tidak ada stale surface yang tertinggal;
- shortcut/workspace tidak navigasi ke profile yang salah saat switch berlangsung.

## 12. Scenario G — real-account isolation canary

Profile:

```text
001 = account A
002 = account B
003 = account C
```

Periksa secara manual bahwa:

- account A hanya tampil pada 001;
- account B hanya tampil pada 002;
- account C hanya tampil pada 003;
- test profile 004–025 tidak otomatis login sebagai A/B/C;
- restart dan stress switching tidak mengubah mapping.

Evidence hanya memakai label A/B/C dan profileId.

Dilarang menyimpan email/password/OTP/token sebagai evidence.

## 13. Scenario H — lifecycle mutation spread

Gunakan profile dari berbagai rentang agar bug index/order lebih mudah ditemukan.

Contoh:

### Rename

```text
profile_004
profile_012
profile_018
profile_025
```

Expected:

- display name berubah;
- profileId tetap;
- partition tetap;
- session identity tetap.

### Archive/unarchive

```text
profile_006
profile_014
profile_021
```

Expected:

- archived profile tidak tampil sebagai launchable normal sesuai UI policy;
- session data tidak dihapus;
- unarchive mengembalikan record yang sama.

### Delete test profile

Pilih hanya test profile, misalnya:

```text
profile_009
profile_017
```

Expected:

- hanya target yang dihapus;
- profile lain tidak berubah;
- real account sessions tidak tersentuh;
- jika profile baru dibuat sesudahnya, ID allocation mengikuti policy dan tidak diam-diam reuse identity lama bila policy melarang reuse.

Setelah mutation phase, population boleh direstore ke 25 menggunakan profile baru normal untuk melanjutkan scale test.

## 14. Scenario I — clean restart after stress

Setelah minimal 250 mixed switch:

1. capture diagnostics snapshot;
2. shutdown cleanly;
3. start app;
4. load registry;
5. verify stored count/state;
6. buka A/B/C dan beberapa test profile;
7. verify mapping tetap benar.

Expected:

- no registry drift;
- no partition drift;
- no duplicate runtime;
- no mass auto-restore.

## 15. Scenario J — unclean shutdown

Dengan 25 stored profiles:

1. aktifkan satu profile;
2. simulasikan forced/unclean app termination sesuai test harness resmi;
3. restart;
4. verify unclean marker;
5. verify shell/registry start lebih dulu;
6. verify app tidak membuka 25 runtime;
7. verify active runtime cap masih dipatuhi.

Expected:

- registry tetap readable;
- profile sessions tidak tertukar;
- RecoveryManager tidak melakukan mass restore;
- diagnostics mencatat previous shutdown as unclean secara aman.

## 16. Scenario K — renderer crash and recovery

Gunakan satu real profile, misalnya profile_002.

Simulasikan renderer failure melalui test mechanism yang aman.

Expected:

- crash terdeteksi;
- RecoveryManager menggunakan profileId/partition yang sama;
- A dan C tidak terdampak;
- test profiles tidak corrupt;
- runtime cap tetap dihormati;
- bounded retry tetap berlaku.

## 17. Scenario L — background inactivity

Dengan 25 stored profiles dan cap 1:

- aktifkan satu profile;
- tunggu observation window;
- cek process/runtime list;
- verify 24 profile lain tidak mempunyai active browser runtime.

Yang masih boleh ada:

- registry metadata;
- persistent session data di disk;
- app-level services yang memang singleton.

Yang tidak boleh:

- 24 hidden WebContentsView;
- per-profile polling timer tanpa policy;
- background page refresh seluruh profile;
- mass service-worker wakeup yang dipicu app tanpa kebutuhan.

## 18. Scenario M — resource observation

Capture safe metrics:

```text
before stress
mid stress
immediately after stress
post-idle cooldown
post-restart
```

Metrics minimum:

- active runtime count;
- Electron process count;
- app memory summary;
- renderer memory summary bila aman;
- CPU summary;
- listener/timer counters bila instrumented;
- crash/recovery count.

Tujuan bukan menetapkan angka RAM absolut yang sama di semua PC.

Tujuannya mendeteksi pola pertumbuhan tak terkendali.

## 19. Scenario N — diagnostics correctness

Diagnostics snapshot harus melaporkan state yang sesuai real system, misalnya:

```json
{
  "storedProfileCount": 25,
  "activeRuntimeCount": 1,
  "maxActiveRuntimes": 1
}
```

Jika beberapa profile diarsipkan, total active/archived count harus konsisten dengan registry.

Diagnostics tidak boleh menghitung inactive stored profile sebagai runtime hidup.

## 20. Scenario O — secret scan

Scan seluruh output test:

- logs;
- diagnostics bundle;
- evidence Markdown/JSON;
- crash/recovery report;
- test artifacts lokal yang direncanakan untuk dibagikan.

Forbidden content:

- password;
- OTP/2FA;
- recovery code;
- cookie value;
- Authorization header;
- access token;
- refresh token;
- session token;
- localStorage/sessionStorage content;
- raw form value;
- raw request/response body.

Synthetic secret fixtures harus ter-redact.

## 21. Registry invariant audit

Setelah seluruh test:

- enumerate semua registry record;
- cek uniqueness profileId;
- cek uniqueness partition;
- cek state enum valid;
- cek required fields;
- cek tidak ada dangling runtime ownership;
- cek tidak ada deleted profile masih tercantum sebagai active;
- cek archived profile tidak berubah ID;
- cek test profile tidak menunjuk partition A/B/C.

## 22. Failure classification

Gunakan severity minimum:

### P0 — Critical isolation/security

Contoh:

- session A muncul pada B/C/test profile;
- partition salah;
- secret masuk diagnostics/log;
- profile deletion menghapus session profile lain.

STEP 13 langsung FAIL.

### P1 — Stability blocker

Contoh:

- duplicate runtime;
- runtime cap terlewati;
- registry corrupt;
- crash loop;
- unclean startup melakukan mass restore.

STEP 13 FAIL.

### P2 — Resource/UX issue

Contoh:

- memory tidak turun setelah cooldown;
- switching latency abnormal;
- stale UI state tetapi backend benar.

Harus diperbaiki sebelum STEP 14 jika menunjukkan trend scale risk.

## 23. Minimum test matrix

| ID | Test | Expected |
|---|---|---|
| T13-01 | Load 25 profiles | Count 25 |
| T13-02 | Unique profileId | PASS |
| T13-03 | Unique partition | PASS |
| T13-04 | Cold restart | Registry stable |
| T13-05 | Sequential switching | No duplicate runtime |
| T13-06 | Reverse switching | No duplicate runtime |
| T13-07 | 250 seeded switches | Stable |
| T13-08 | Repeated open | Idempotent |
| T13-09 | Rapid switch | Serialized |
| T13-10 | A/B/C isolation | No cross-session |
| T13-11 | Test profile isolation | No inherited login |
| T13-12 | Rename spread | Identity unchanged |
| T13-13 | Archive/unarchive | Identity unchanged |
| T13-14 | Delete test profile | Other profiles unaffected |
| T13-15 | Clean restart after stress | Stable |
| T13-16 | Unclean restart | Safe recovery |
| T13-17 | Renderer crash | Same-profile recovery |
| T13-18 | Runtime cap | Never exceeded |
| T13-19 | Background inactivity | Inactive profiles dormant |
| T13-20 | Resource observation | No unbounded growth |
| T13-21 | Diagnostics counts | Accurate |
| T13-22 | Registry invariant audit | PASS |
| T13-23 | Secret scan | PASS |
| T13-24 | Regression STEP 00–12 | PASS |

## 24. Evidence format

Evidence minimum:

```text
STEP13 Run ID:
Timestamp:
App version:
Electron version:
OS:
Stored profiles: 25
Active runtime cap: 1
Unique profileId: PASS/FAIL
Unique partitions: PASS/FAIL
Sequential cycles:
Reverse cycles:
Seed:
Seeded switch count:
A/B/C isolation: PASS/FAIL
Lifecycle mutation: PASS/FAIL
Clean restart: PASS/FAIL
Unclean restart: PASS/FAIL
Crash recovery: PASS/FAIL
Resource trend: PASS/FAIL
Diagnostics accuracy: PASS/FAIL
Secret scan: PASS/FAIL
Overall: PASS/FAIL
```

Jangan masukkan credential atau account identifier sensitif.

## 25. Acceptance gate

STEP 13 dinyatakan PASS hanya jika seluruh kondisi berikut terpenuhi:

- STEP 12 PASS;
- 25 profile berhasil tersimpan dan diload ulang;
- mapping profileId/partition unik dan stabil;
- A/B/C tetap terisolasi;
- profile test tidak menerima session A/B/C;
- cap runtime tidak pernah terlewati;
- 250+ seeded switch selesai tanpa duplicate runtime/surface;
- lifecycle mutation tidak menyebabkan cross-profile corruption;
- clean restart konsisten;
- unclean restart aman;
- renderer recovery profile-scoped;
- inactive profiles tidak mempertahankan runtime background tanpa policy;
- registry invariant audit PASS;
- diagnostics akurat;
- resource trend tidak menunjukkan pertumbuhan tak terbatas;
- secret scan PASS;
- regression STEP 00–12 PASS.

## 26. STOP CONDITION

STOP dan jangan lanjut STEP 14 jika salah satu terjadi:

- satu cross-session leak saja;
- profile membuka partition yang salah;
- duplicate profileId/partition;
- duplicate active runtime/surface;
- runtime cap terlewati tanpa policy eksplisit;
- inactive profile terus menjalankan workload background;
- registry corrupt/hilang setelah restart;
- rename/archive/delete merusak profile lain;
- recovery mengganti identity/partition;
- memory/listener/timer menunjukkan unbounded growth;
- logs/diagnostics/evidence mengandung secret;
- test hanya bisa PASS setelah security baseline diturunkan.

## 27. Definition of Done

STEP 13 selesai hanya setelah:

1. Issue STEP 12 completed;
2. test matrix STEP 13 selesai;
3. tidak ada P0/P1 blocker;
4. evidence aman tersedia;
5. secret scan PASS;
6. regression PASS;
7. issue STEP 13 dapat ditutup sebagai completed.

Setelah itu baru **STEP 14 — 50 Profile Test** boleh dimulai.
