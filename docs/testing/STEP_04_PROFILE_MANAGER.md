# STEP 04 — Profile Manager

> **STATUS: BLOCKED oleh STEP 03.** Dokumen ini hanya persiapan. Jangan implementasikan Profile Manager sampai STEP 03 — Persistent Single Profile sudah PASS dan Issue #8 ditutup sebagai completed.

## Tujuan

Membangun lifecycle profile lokal yang aman, deterministic, dan mudah diuji tanpa menyentuh credential pengguna. STEP 04 adalah fondasi registry/profile lifecycle sebelum STEP 05 menguji isolation antar banyak akun.

## Prinsip utama

1. **Profile ID immutable.** Setelah profile dibuat, ID tidak boleh berubah.
2. **Partition deterministic.** `profile_001` selalu memakai `persist:profile_001`, dan seterusnya.
3. **Display name boleh berubah.** Rename hanya mengubah label manusia, bukan ID/partition.
4. **Archive sebelum delete.** Aksi aman default adalah archive, bukan permanent delete.
5. **Tidak ada secret di registry.** Password, OTP, recovery code, cookie value, token, authorization header, dan session secret dilarang disimpan.
6. **Tidak ada copy cookie.** Chromium/Electron tetap menjadi pemilik browser session data.
7. **Tidak ada multi-active account orchestration.** STEP 04 mengelola lifecycle profile; isolation runtime banyak profile baru dibuktikan di STEP 05.

## Scope

Yang boleh dibuat:

- create profile;
- list profile;
- rename profile;
- archive profile;
- unarchive profile;
- guarded permanent delete;
- registry metadata non-secret;
- deterministic ID allocator;
- deterministic partition resolver;
- validation registry;
- launcher satu profile yang dipilih;
- diagnostics untuk duplicate/corrupt metadata;
- unit test + offline smoke test Profile Manager.

Yang belum boleh dibuat:

- menjalankan banyak profile aktif sekaligus;
- switching cepat untuk automation;
- quota/account rotation;
- cookie export/import;
- cloning profile session;
- auto-login;
- password/OTP/2FA storage;
- CAPTCHA/security challenge automation;
- anti-detection/fingerprint spoofing;
- AI agent;
- website-specific automation.

## Model data minimum

Contoh metadata profile:

```json
{
  "id": "profile_001",
  "displayName": "Profile 001",
  "partition": "persist:profile_001",
  "status": "active",
  "createdAt": "2026-10-05T00:00:00.000Z",
  "updatedAt": "2026-10-05T00:00:00.000Z",
  "archivedAt": null
}
```

Field yang dilarang:

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

## State machine

```text
CREATE
  ↓
ACTIVE
  ├─ rename ───────────────→ ACTIVE
  ├─ archive ──────────────→ ARCHIVED
  └─ launch profile ───────→ ACTIVE

ARCHIVED
  ├─ unarchive ────────────→ ACTIVE
  └─ permanent delete ─────→ DELETED
```

`DELETED` bukan state yang disimpan sebagai profile aktif; setelah delete berhasil, registry entry dihapus dan session-data removal harus mengikuti flow yang terkontrol.

## Kontrak ID

Format awal:

```text
profile_001
profile_002
profile_003
...
```

Aturan:

- zero-padding 3 digit minimal;
- allocator tidak boleh memakai kembali ID yang masih aktif/archived;
- rename tidak pernah mengubah ID;
- archive tidak pernah mengubah ID;
- unarchive mengembalikan ID yang sama;
- partition selalu diturunkan dari ID yang immutable.

## Kontrak partition

```text
profile_001 -> persist:profile_001
profile_002 -> persist:profile_002
profile_003 -> persist:profile_003
```

Resolver harus pure/deterministic. Jika metadata mengatakan `profile_002` tetapi partition berisi `persist:profile_009`, profile dianggap invalid dan tidak boleh diluncurkan.

## Registry storage

Registry hanya menyimpan metadata profile. Browser session data tetap disimpan oleh Electron/Chromium.

Pisahkan secara konsep:

```text
Profile Registry
  └─ metadata non-secret

Chromium Session Storage
  └─ cookies/localStorage/cache/service state
```

Jangan menyalin data dari Chromium Session Storage ke Profile Registry.

## Create profile

Flow target:

```text
request create
→ allocate next ID
→ derive partition
→ validate uniqueness
→ persist registry atomically
→ return profile descriptor
```

Jika registry write gagal, jangan membuat profile setengah jadi.

## Rename profile

Rename hanya mengubah:

```text
displayName
updatedAt
```

Tidak boleh mengubah:

```text
id
partition
createdAt
browser session identity
```

## Archive profile

Archive harus:

- mengubah status menjadi `archived`;
- mencatat `archivedAt`;
- tidak menghapus session data;
- tidak menghapus registry entry;
- mencegah profile diluncurkan tanpa unarchive terlebih dahulu, kecuali nanti ada explicit recovery/admin flow.

## Unarchive profile

Unarchive harus mengembalikan profile yang sama:

- ID sama;
- partition sama;
- display name sama kecuali user mengubahnya;
- session data tetap terkait profile yang sama.

## Permanent delete

Permanent delete adalah destructive action dan tidak boleh menjadi aksi default.

Minimum guard:

1. profile harus archived terlebih dahulu;
2. user memilih permanent delete secara eksplisit;
3. app menampilkan target profile yang jelas;
4. app memverifikasi ID/partition target;
5. registry entry target dihapus secara terkontrol;
6. session data target saja yang boleh dihapus;
7. profile lain tidak boleh disentuh.

Jika session-data removal gagal, registry tidak boleh silently mengklaim bahwa cleanup berhasil penuh. Catat status recovery/cleanup yang jelas.

## UI minimum

UI tetap sederhana:

```text
┌──────────────────────────────────────────────┐
│ Profiles                         [+ Profile] │
├───────────────┬──────────────────────────────┤
│ Profile 001   │ Name: Profile 001            │
│ Profile 002   │ Status: Active               │
│ Archived      │ Partition: persist:profile...│
│               │                              │
│               │ [Open] [Rename] [Archive]    │
└───────────────┴──────────────────────────────┘
```

Tidak perlu dashboard statistik, avatar cloud, sync, animasi, atau UI kompleks.

## Error handling

### Duplicate ID

Jika allocator menemukan duplicate ID, operasi create harus STOP dan registry diperiksa.

### Partition mismatch

Jika ID dan partition tidak sesuai kontrak, profile tidak boleh diluncurkan.

### Registry parse/corruption

Jangan overwrite file/database registry corrupt secara otomatis. Buat backup/recovery path atau fail terkontrol.

### Delete failure

Jika permanent delete hanya berhasil sebagian, tandai cleanup sebagai incomplete dan jangan menghapus bukti diagnostic non-secret.

## Automated test matrix

### T04-00 — Prerequisite

- STEP 03 PASS.
- Regression STEP 00–03 PASS.

### T04-01 — Create first profile

Expected:

```text
id = profile_001
partition = persist:profile_001
status = active
```

### T04-02 — Create sequential profiles

Buat minimal 5 profile metadata tanpa login.

Expected:

```text
profile_001
profile_002
profile_003
profile_004
profile_005
```

Tidak ada duplicate ID/partition.

### T04-03 — Registry restart

Tutup app, buka lagi.

PASS jika daftar profile tetap sama.

### T04-04 — Rename

Rename `Profile 002` menjadi label lain.

PASS jika hanya display name berubah; ID dan partition tetap.

### T04-05 — Archive

Archive profile_003.

PASS jika status berubah menjadi archived tanpa menghapus metadata/session path.

### T04-06 — Unarchive

Unarchive profile_003.

PASS jika ID dan partition persis sama seperti sebelum archive.

### T04-07 — Permanent delete guard

Coba delete profile active.

PASS jika ditolak atau diwajibkan archive terlebih dahulu.

### T04-08 — Permanent delete target isolation

Delete profile_004 yang sudah archived.

PASS jika profile_001/002/003/005 tetap utuh.

### T04-09 — Invalid metadata

Simulasikan descriptor dengan mismatch ID/partition.

PASS jika launch diblokir.

### T04-10 — Secret audit

Registry/log/evidence tidak boleh memiliki credential/token/cookie values.

## Manual test minimum

Setelah STEP 03 sudah lolos manual persistence:

1. Pastikan `profile_001` tetap membuka akun yang sudah diuji pada STEP 03.
2. Rename profile dan buka lagi.
3. Archive profile, lalu unarchive.
4. Buka lagi profile yang sama.
5. Pastikan session identity tidak berubah karena rename/archive/unarchive.

## Acceptance gate

STEP 04 baru PASS jika:

- STEP 03 sudah PASS terlebih dahulu;
- create/list/rename/archive/unarchive/delete berfungsi;
- ID immutable;
- partition deterministic;
- registry survive restart;
- archive tidak menghapus session;
- delete hanya mengenai target;
- invalid metadata diblokir;
- tidak ada secret di registry/log;
- regression STEP 00–03 tetap PASS.

## STOP CONDITION

STOP dan jangan lanjut STEP 05 jika:

- duplicate profile ID muncul;
- partition mismatch dapat diluncurkan;
- rename mengubah partition;
- archive menghapus session;
- delete memengaruhi profile lain;
- registry corrupt setelah restart;
- secret masuk registry/log;
- security baseline perlu diturunkan.

## Definition of Done

Setelah semua gate PASS:

```text
STEP 04 = CLOSED
↓
STEP 05 — Multi-Profile Isolation
```

STEP 05 baru boleh menguji beberapa akun/profile secara bersamaan setelah lifecycle profile terbukti aman di STEP 04.
