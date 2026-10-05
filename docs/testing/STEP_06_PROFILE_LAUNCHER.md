# STEP 06 — Profile Launcher

> Status: **PREPARED / BLOCKED BY STEP 05**
>
> Dokumen ini adalah kontrak implementasi dan test gate. Jangan menulis runtime STEP 06 sebelum STEP 05 — Multi-Profile Isolation selesai dan PASS.

## 1. Tujuan

STEP 06 membuat UI launcher profile yang sederhana dan stabil di atas Profile Manager + isolation layer yang sudah terbukti.

Launcher **bukan** pemilik session. Launcher hanya:

1. membaca daftar profile dari Profile Manager/registry;
2. menampilkan status profile;
3. mengirim `profileId` yang dipilih pengguna;
4. meminta runtime membuka profile tersebut;
5. menampilkan state aktif yang dikembalikan runtime.

Launcher tidak boleh membentuk partition sendiri dan tidak boleh menyentuh cookie/token/browser storage.

## 2. Dependency wajib

Sebelum implementasi:

- STEP 00 PASS;
- STEP 01 PASS;
- STEP 02 PASS;
- STEP 03 PASS;
- STEP 04 PASS;
- STEP 05 PASS;
- mapping `profileId -> partition` sudah deterministic dan teruji;
- switching tiga profile sudah terbukti tidak mencampur session.

Jika STEP 05 belum PASS, STEP 06 hanya boleh berada dalam bentuk dokumentasi seperti file ini.

## 3. UI minimum

```text
┌─────────────────────────────────────────────────────┐
│ Multi Profile Browser                 [+ PROFILE]   │
├──────────────────┬──────────────────────────────────┤
│ Profiles         │ ←   →   ⟳   [ URL............ ] │
│                  ├──────────────────────────────────┤
│ ● Profile 01     │                                  │
│ ○ Profile 02     │            WEBSITE               │
│ ○ Profile 03     │                                  │
│                  │                                  │
└──────────────────┴──────────────────────────────────┘
```

Fase ini sengaja tidak menambahkan dashboard, statistik, tema, tab kompleks, AI Agent, atau automation.

## 4. Komponen UI

### 4.1 Profile list

Setiap row minimal menampilkan:

- display name;
- active marker;
- optional safe status: active / archived / error;
- tidak menampilkan credential atau data sensitif.

Identity internal tetap `profileId`, bukan display name.

### 4.2 Tombol `+ PROFILE`

Tombol hanya memanggil flow create profile milik Profile Manager.

Launcher tidak membuat ID/partition secara mandiri.

### 4.3 Navigation bar

Memakai BrowserBackend yang sudah ada:

- Back;
- Forward;
- Reload;
- URL input.

Profile switching tidak boleh membuat implementasi navigation kedua.

### 4.4 Active marker

UI harus menunjukkan profile yang benar-benar terhubung ke active browser surface.

State visual tidak boleh diubah optimistis sebelum runtime mengonfirmasi switching sukses.

## 5. Source of truth

Source of truth:

```text
Profile Registry / Profile Manager
          ↓
ProfileRuntimeController
          ↓
BrowserBackend / WebContentsView
          ↓
Launcher menerima snapshot state
```

Dilarang:

```text
Launcher -> membentuk persist:<displayName>
Launcher -> memilih directory session sendiri
Launcher -> membaca cookie untuk menebak akun
Launcher -> menyimpan mapping duplikat lokal
```

## 6. Contract profile row

Contoh model aman:

```ts
interface ProfileLauncherItem {
  profileId: string;
  displayName: string;
  status: 'active' | 'archived' | 'error';
  isOpen: boolean;
}
```

Tidak boleh ada:

- password;
- OTP;
- cookie value;
- token;
- recovery code;
- raw browser storage.

Partition juga sebaiknya tidak diperlukan renderer jika main process dapat resolve dari `profileId`.

## 7. Open profile contract

Renderer mengirim:

```text
openProfile(profileId)
```

Main process:

1. validasi format profileId;
2. resolve profile dari registry;
3. pastikan profile aktif dan bukan archived;
4. resolve partition melalui Profile Manager;
5. jika profile sama sudah aktif, return state yang ada;
6. jika profile berbeda aktif, lakukan controlled switch;
7. setelah sukses, kirim state baru ke renderer.

## 8. Switching contract

Switch A -> B wajib mengikuti urutan yang terkontrol:

```text
request B
→ validate B
→ lock switching operation
→ detach/close active surface A sesuai lifecycle STEP 05
→ open surface B menggunakan descriptor B
→ wait minimum ready state
→ mark B active
→ notify UI
→ release lock
```

Jika B gagal dibuka, UI tidak boleh menampilkan B sebagai aktif secara palsu.

## 9. Idempotency

Klik profile yang sama berkali-kali tidak boleh:

- membuat WebContentsView baru;
- membuat session baru;
- membuat listener ganda;
- menambah runtime count;
- mengubah partition.

Expected:

```text
openProfile(A)
openProfile(A)
openProfile(A)
=> tetap satu runtime A
```

## 10. Switching race prevention

Contoh risiko:

```text
user klik A
langsung klik B
langsung klik C
```

Implementasi harus mempunyai serialized switch/mutex/state machine.

Tidak boleh ada kondisi akhir UI mengatakan C aktif tetapi browser surface masih B.

## 11. Archived profile

Default launcher:

- tidak menampilkan archived profile pada daftar utama, atau menampilkannya dalam area terpisah non-openable;
- tidak boleh membuka archived profile melalui normal open action;
- restore harus dilakukan melalui Profile Manager lebih dulu.

## 12. Rename

Rename hanya mengubah display name.

Invariant:

```text
before:
profileId = profile_001
partition = persist:profile_001
displayName = Google Utama

after rename:
profileId = profile_001
partition = persist:profile_001
displayName = Akun Kerja
```

Launcher harus merefresh label tanpa membuat runtime/session baru.

## 13. Create profile

Flow:

```text
+ PROFILE
→ Profile Manager create
→ registry commit sukses
→ launcher refresh list
→ profile baru tampil
```

Profile baru tidak harus otomatis dibuka kecuali keputusan produk secara eksplisit menetapkannya kemudian.

## 14. Startup behavior

Pada app start:

1. baca registry melalui Profile Manager;
2. filter invalid/archived sesuai policy;
3. render launcher;
4. jangan otomatis membuka banyak profile;
5. jika ada last-opened profile policy, tetap validasi registry sebelum open.

Baseline yang paling aman: launcher muncul dulu, lalu pengguna memilih profile.

## 15. Window resize

Sidebar profile dan browser surface harus menggunakan layout deterministic.

Resize tidak boleh:

- overlap dengan WebContentsView;
- menutup URL bar;
- membuat remote content menerima click di bawah tombol lokal;
- menciptakan surface baru.

## 16. IPC boundary

Renderer hanya mendapat IPC minimal seperti:

```text
profiles:list
profiles:create
profiles:open
profiles:rename
profiles:archive
profiles:restore
runtime:get-state
```

IPC harus:

- allowlisted;
- validate payload;
- validate profileId;
- tidak menerima raw partition dari renderer untuk open action;
- tidak mengekspos Electron/Node API langsung ke remote content.

## 17. Error states

Launcher harus menangani minimal:

- profile tidak ditemukan;
- profile archived;
- registry unavailable;
- switch already in progress;
- surface gagal dibuat;
- navigation gagal;
- active profile crash.

Error message harus non-sensitive.

## 18. Test matrix

### T06-01 — List registry

Precondition: tiga active profile valid.

Expected:

- tiga row tampil;
- nama sesuai registry;
- tidak ada duplicate row;
- profileId internal benar.

### T06-02 — Open Profile A

Expected:

- A menjadi active marker;
- tepat satu surface dibuat;
- runtime descriptor memakai Profile A;
- navigation normal.

### T06-03 — Repeated click A

Lakukan klik A minimal 10 kali.

Expected:

- satu runtime;
- satu active surface;
- tidak ada listener/session duplikat;
- UI tetap konsisten.

### T06-04 — Switch A -> B -> C -> A

Expected:

- marker selalu sesuai surface sebenarnya;
- session identity tetap benar;
- tidak ada leakage;
- runtime lama dibersihkan sesuai policy.

### T06-05 — Rapid switch

Trigger A/B/C secara cepat.

Expected:

- switch serialized;
- final UI state sama dengan final runtime state;
- tidak crash;
- tidak ada orphan surface.

### T06-06 — Rename active profile

Expected:

- label berubah;
- profileId/partition/session tetap sama;
- active browser tidak logout akibat rename.

### T06-07 — Archive inactive profile

Expected:

- profile hilang dari list utama;
- profile lain tidak terpengaruh.

### T06-08 — Archive active profile

Policy harus eksplisit. Rekomendasi:

- runtime active ditutup secara aman;
- profile kemudian archived;
- launcher kembali ke no-profile-active state.

### T06-09 — Create profile

Expected:

- Profile Manager membuat ID;
- launcher refresh;
- row baru muncul tepat sekali.

### T06-10 — Restart app

Expected:

- daftar profile konsisten;
- mapping tetap;
- tidak ada duplicate item;
- app tidak membuka semua profile sekaligus.

### T06-11 — Invalid profileId IPC

Expected:

- reject;
- tidak crash;
- tidak resolve arbitrary partition/path.

### T06-12 — Archived profile open attempt

Expected:

- reject dengan controlled error;
- session tidak dibuka.

### T06-13 — Browser navigation regression

Untuk active profile:

- URL input PASS;
- Back PASS;
- Forward PASS;
- Reload PASS.

### T06-14 — Secret audit

Periksa:

- launcher state;
- IPC payload;
- log;
- registry metadata;
- diagnostics.

Tidak boleh berisi secret value.

## 19. Regression gate

Sebelum STEP 06 dinyatakan PASS:

- seluruh automated gate STEP 00–01 PASS;
- STEP 02 compatibility tetap valid;
- STEP 03 persistence regression PASS;
- STEP 04 lifecycle regression PASS;
- STEP 05 isolation regression PASS;
- seluruh T06 PASS.

## 20. Performance target awal

Dengan 100 profile tersimpan di registry:

- launcher boleh menampilkan metadata 100 profile;
- tidak boleh membuat 100 WebContentsView;
- hanya active runtime sesuai policy yang hidup;
- scrolling/list operation tidak boleh membuka session profile.

STEP 06 belum melakukan full 100-profile stress gate; itu dilakukan pada step skala berikutnya.

## 21. Logging

Event aman yang boleh dicatat:

```text
profile_launcher_loaded
profile_open_requested
profile_open_succeeded
profile_open_rejected
profile_switch_started
profile_switch_completed
profile_switch_failed
profile_list_refreshed
```

Context aman:

- profileId;
- event;
- timestamp;
- error category.

Jangan log URL autentikasi lengkap jika berpotensi mengandung secret query parameter.

## 22. Security invariant

STEP 06 tidak boleh mengubah baseline:

- `nodeIntegration: false` remote content;
- `contextIsolation: true`;
- `sandbox: true`;
- `webSecurity: true`;
- validated IPC;
- HTTP(S) URL policy;
- no credential automation;
- no anti-detection/spoofing;
- no cookie/token transfer.

## 23. STOP CONDITION

STOP dan jangan lanjut STEP 07 bila terjadi salah satu:

- launcher membuka partition salah;
- profile label dan active runtime tidak sinkron;
- duplicate WebContentsView muncul akibat repeated click;
- rapid switching meninggalkan orphan surface;
- rename mengubah partition/session identity;
- archived profile masih bisa dibuka normal;
- renderer dapat menentukan arbitrary partition;
- launcher perlu membaca cookie/token untuk menentukan akun;
- security baseline harus diturunkan.

## 24. Definition of Done

STEP 06 dinyatakan PASS hanya jika:

- STEP 05 sudah completed;
- launcher sederhana selesai;
- source of truth tetap Profile Manager;
- switching serialized dan idempotent;
- UI active marker selalu sesuai runtime;
- create/rename/archive flow tidak merusak isolation;
- restart konsisten;
- navigation regression PASS;
- secret audit PASS;
- regression STEP 00–05 PASS.

Setelah itu baru STEP 07 — Shortcut / Workspace boleh dimulai.
