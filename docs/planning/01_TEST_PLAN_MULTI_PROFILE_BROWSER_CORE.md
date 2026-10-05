# 01 — TEST PLAN MULTI-PROFILE BROWSER CORE

> **Tujuan:** membuktikan bahwa pondasi browser multi-profile benar-benar stabil sebelum fitur lain dibangun.  
> **Aturan utama:** satu STEP gagal = STOP. Jangan lanjut ke STEP berikutnya.

## 1. Prinsip pengujian

Setiap test case wajib mempunyai:

- Test ID.
- STEP terkait.
- Preconditions.
- Langkah uji.
- Expected result.
- Actual result.
- Evidence.
- Status: PASS / FAIL / BLOCKED.
- Catatan bug bila FAIL.

Status pondasi hanya boleh naik milestone bila seluruh test wajib untuk milestone tersebut PASS.

## 2. Evidence wajib

Evidence yang diterima:

- screenshot keadaan UI;
- log aplikasi;
- crash report;
- test output;
- database/registry verification;
- resource measurement;
- catatan waktu dan profile ID yang diuji.

Jangan menyimpan password, token, recovery code, cookie value, atau credential lain sebagai evidence.

## 3. Environment baseline

Minimal catat:

```text
OS: Windows 11
App version / commit SHA
Electron version
Chromium version
Node version
Architecture: x64
Test date
Test operator
```

Gunakan dependency lock yang sama selama regression cycle.

---

# 4. STEP 00 — Project Foundation Tests

## T00-01 App boot

**Precondition:** dependency terpasang bersih.

**Steps:**
1. Start app.
2. Tunggu main window.
3. Tutup app normal.

**PASS:** window muncul, tidak ada fatal exception, app process berhenti bersih.

## T00-02 Repeated start/close

Ulangi start/close minimal 10 kali.

**PASS:** tidak ada zombie process, duplicate process, atau crash progresif.

## T00-03 Logging lifecycle

Pastikan event `app_started` dan `app_shutdown` tercatat.

**PASS:** log dapat dibaca dan tidak berisi credential sensitif.

---

# 5. STEP 01 — Browser Engine Minimal Tests

## T01-01 Open normal HTTPS page

Buka beberapa halaman HTTPS umum.

**PASS:** content tampil dan navigation complete tercatat.

## T01-02 Back / Forward / Reload

Lakukan navigasi A -> B -> back -> forward -> reload.

**PASS:** history dan reload bekerja tanpa membuat view baru yang tidak perlu.

## T01-03 Invalid URL handling

Masukkan URL salah/tidak tersedia.

**PASS:** app tidak crash dan memberi error yang dapat dipahami.

## T01-04 Renderer cleanup

Buka dan tutup browser surface berulang.

**PASS:** renderer lama tidak tertinggal tanpa pemilik.

---

# 6. STEP 02 — Google Login Compatibility Gate

Ini adalah **hard gate**.

## T02-01 Google login page

1. Buka halaman Google menggunakan browser core.
2. Login manual dengan akun uji yang pengguna berwenang kelola.
3. Selesaikan 2FA secara manual bila diminta.

**PASS:** login dilakukan melalui alur normal layanan tanpa bypass.

## T02-02 Google service access

Setelah login, buka layanan target seperti YouTube atau YouTube Studio.

**PASS:** halaman dapat digunakan normal.

## T02-03 No bypass configuration

Periksa konfigurasi browser.

**PASS:** tidak ada anti-detection hack, CAPTCHA bypass, fingerprint spoofing, `webSecurity: false`, atau pencurian cookie/token.

**STOP CONDITION:** bila Google login tidak kompatibel, STEP 03–16 tidak boleh digunakan untuk menutupi masalah. Evaluasi browser backend lebih dahulu.

---

# 7. STEP 03 — Persistent Single Profile

## T03-01 App restart persistence

1. Login profile_001.
2. Tutup app normal.
3. Start app kembali.
4. Buka profile_001.

**PASS:** session yang masih valid tetap login.

## T03-02 Windows restart persistence

1. Pastikan profile_001 login.
2. Tutup app.
3. Restart Windows.
4. Start app.
5. Buka profile_001.

**PASS:** persistent browser data tetap tersedia.

## T03-03 Multiple restart cycle

Ulangi minimal 10 app restart.

**PASS:** tidak terjadi random logout akibat kesalahan aplikasi sendiri.

## T03-04 Profile path consistency

Verifikasi profile yang sama selalu menggunakan partition/path yang sama.

**PASS:** tidak ada session baru tanpa sengaja.

---

# 8. STEP 04 — Profile Registry & Lifecycle

## T04-01 Create profile

Buat profile baru.

**PASS:** ID unik, metadata valid, partition unik.

## T04-02 Rename

Rename profile.

**PASS:** hanya display name berubah; ID/partition tetap.

## T04-03 Archive / Restore

Archive lalu restore.

**PASS:** session tidak terhapus karena archive.

## T04-04 Permanent delete

Gunakan profile uji kosong.

**PASS:** delete memerlukan tindakan eksplisit dan registry tidak meninggalkan referensi rusak.

## T04-05 Invalid state transition

Coba operasi tidak valid terhadap profile.

**PASS:** operasi ditolak dengan error terkontrol, bukan crash.

---

# 9. STEP 05 — Multi-Profile Isolation

Gunakan minimal tiga profile berbeda.

```text
profile_001 -> Account A
profile_002 -> Account B
profile_003 -> Account C
```

## T05-01 Cookie isolation

Login akun berbeda di masing-masing profile.

**PASS:** membuka profile A tidak pernah menampilkan login B/C akibat kebocoran session aplikasi.

## T05-02 Local/session storage isolation

Verifikasi storage tidak digunakan silang antar-partition.

## T05-03 Concurrent active profiles

Aktifkan 2–3 profile sesuai resource limit.

**PASS:** semua tetap memakai session masing-masing.

## T05-04 Close/reopen isolation

Tutup semua profile lalu buka dalam urutan berbeda.

**PASS:** mapping profile -> account tetap benar.

**SEVERITY:** setiap cross-profile session leak = BLOCKER.

---

# 10. STEP 06 — Profile Launcher

## T06-01 Correct partition launch

Klik profile pada daftar.

**PASS:** launcher memakai partition yang tercatat pada profile tersebut.

## T06-02 Rapid switching

Switch profile berulang A/B/C.

**PASS:** tidak ada salah account, duplicate view, atau stale view.

## T06-03 Reopen same profile

Buka/tutup profile yang sama berulang.

**PASS:** lifecycle idempotent dan listener tidak bertambah liar.

---

# 11. STEP 07 — Workspace / Shortcut

## T07-01 Shortcut navigation

Uji shortcut Google, YouTube Studio, Drive, Flow, Gemini, ChatGPT, Claude, dan Custom URL.

**PASS:** shortcut hanya menavigasi profile aktif ke URL yang tepat.

## T07-02 Shortcut isolation

Buka shortcut yang sama pada profile berbeda.

**PASS:** session mengikuti profile, bukan shortcut global.

---

# 12. STEP 08 — Resource Management

## T08-01 Active renderer limit

Set limit 1 lalu coba membuka beberapa profile.

**PASS:** app mematuhi kebijakan active profile yang ditetapkan.

## T08-02 Memory trend

Siklus buka/tutup profile minimal 50 kali sambil mengamati RAM.

**PASS:** tidak ada growth tak terbatas yang menunjukkan leak besar.

## T08-03 Listener leak

Pantau warning duplicate/max listener.

**PASS:** tidak ada listener bertambah pada setiap reopen.

## T08-04 Idle profile

Profile tersimpan tetapi tidak aktif tidak boleh memiliki renderer aktif sendiri.

---

# 13. STEP 09 — Recovery Tests

## T09-01 Renderer crash recovery

Simulasikan renderer failure.

**PASS:** profile lain dan main shell tetap hidup; user dapat retry/reopen.

## T09-02 Abnormal app termination

Hentikan app tidak normal lalu start kembali.

**PASS:** registry tetap konsisten dan tidak menghapus profile.

## T09-03 Corrupt metadata simulation

Gunakan fixture registry rusak.

**PASS:** aplikasi mendeteksi masalah, membuat recovery path, dan tidak diam-diam menulis data lebih buruk.

## T09-04 Disk write failure

Simulasikan kegagalan write bila memungkinkan.

**PASS:** error terkontrol dan registry sebelumnya tetap recoverable.

---

# 14. STEP 10 — Diagnostics Tests

## T10-01 Structured event coverage

Pastikan event penting tercatat dengan timestamp dan profile ID jika relevan.

## T10-02 Sanitization

Cari pola credential/token/cookie di log.

**PASS:** nilai sensitif tidak muncul.

## T10-03 Correlation

Satu kegagalan navigation harus dapat dihubungkan ke profile dan waktu kejadian.

---

# 15. STEP 11 — 3 Profile Stability Gate

Minimal tiga profile nyata harus melalui:

```text
create
login manual
close
reopen
switch
app restart
Windows restart
```

**PASS:** tidak ada session tertukar dan persistence konsisten.

Gate ini wajib sebelum scale test.

---

# 16. STEP 12 — 10 Profile Gate

## T12-01 Registry 10 profiles

Buat/daftarkan 10 profile.

**PASS:** startup/list/search tetap benar.

## T12-02 Sequential open

Buka 10 profile satu per satu, tidak harus bersamaan.

**PASS:** mapping dan lifecycle benar.

## T12-03 Regression core

Jalankan ulang persistence + isolation + recovery smoke tests.

---

# 17. STEP 13 — 25 Profile Gate

Uji:

- create/read/update/archive metadata;
- sequential launch;
- app restart;
- sorting/searching profile;
- registry integrity;
- cleanup setelah banyak open/close.

**PASS:** tidak ada error yang meningkat karena jumlah registry.

---

# 18. STEP 14 — 50 Profile Gate

Tambahkan endurance cycle:

```text
50 profile tersimpan
1–3 profile aktif sesuai limit
100+ switch/open/close operations
```

**PASS:** tidak ada cross-profile leak, database corruption, atau resource growth fatal.

---

# 19. STEP 15 — 100 Profile Registry Gate

Tujuan tahap ini adalah menguji **registry dan lifecycle**, bukan membuka 100 Chromium sekaligus.

## T15-01 Create/load 100 profiles

**PASS:** seluruh profile mempunyai ID/partition unik.

## T15-02 Search/list performance

UI tetap dapat mencari dan memilih profile dengan wajar.

## T15-03 Random sequential launch

Pilih profile secara acak, buka, verifikasi, tutup, ulangi.

**PASS:** profile yang dibuka selalu benar.

## T15-04 Restart with 100-profile registry

Restart app beberapa kali.

**PASS:** registry tidak berubah/korup.

## T15-05 Archive/restore batch

Uji lifecycle pada subset profile.

**PASS:** operasi metadata tidak memengaruhi session profile lain.

---

# 20. STEP 16 — Foundation v1.0 Release Gate

Foundation v1.0 dinyatakan PASS hanya bila seluruh poin berikut terpenuhi:

- STEP 00–15 wajib PASS;
- Google compatibility gate PASS;
- persistence app restart PASS;
- persistence Windows restart PASS;
- 3-profile isolation PASS;
- 10/25/50/100 registry scale PASS;
- recovery PASS;
- security regression PASS;
- no credential leak di logs;
- no known BLOCKER;
- no known HIGH severity cross-profile/session bug;
- dependency lock tercatat;
- commit/tag release dapat direproduksi.

---

# 21. Security Regression Pack

Jalankan sebelum release dan setelah perubahan browser/session/IPC.

Checklist:

- remote content tidak mempunyai Node integration;
- context isolation aktif;
- IPC channel whitelist;
- IPC sender validation;
- payload validation;
- navigation policy valid;
- new-window behavior valid;
- permission request handler valid;
- no `webSecurity: false`;
- no plaintext credential database;
- log sanitization PASS;
- profile partition uniqueness PASS.

Satu failure security kritis = release BLOCKED.

---

# 22. Persistence Regression Pack

Jalankan setelah perubahan profile/session/storage:

1. login profile A;
2. app restart;
3. verify A;
4. open B;
5. verify B berbeda;
6. close/reopen A;
7. restart Windows;
8. verify A dan B;
9. archive/restore A;
10. verify session mapping tidak berubah.

---

# 23. Crash & Recovery Pack

Minimal mencakup:

- renderer crash;
- forced app termination;
- navigation process failure;
- invalid profile metadata fixture;
- failed registry write fixture;
- shutdown ketika profile aktif;
- startup setelah shutdown tidak bersih.

Target utama: data profile lain tidak boleh ikut rusak.

---

# 24. Endurance Test

Untuk kandidat v1.0:

- jalankan aplikasi dalam sesi panjang;
- lakukan ratusan navigasi dan profile switch;
- buka/tutup renderer berulang;
- monitor RAM/process count/log size;
- lakukan beberapa app restart.

**FAIL indicators:**

- RAM meningkat terus tanpa kembali pada kisaran stabil;
- process count terus bertambah;
- event listener warning;
- profile salah session;
- registry berubah sendiri;
- crash rate meningkat seiring waktu.

---

# 25. Severity

## BLOCKER

- cross-profile login/session leak;
- registry corruption massal;
- credential exposure;
- app tidak bisa start;
- Google compatibility gate tidak dapat dilewati secara normal.

## HIGH

- session sering hilang karena aplikasi;
- renderer crash berulang;
- profile launcher membuka partition salah;
- recovery merusak profile.

## MEDIUM

- navigation edge case;
- error UI tidak jelas;
- performance menurun tetapi core masih benar.

## LOW

- cosmetic/minor usability issue yang tidak memengaruhi pondasi.

Foundation v1.0 tidak boleh dirilis dengan BLOCKER atau HIGH yang diketahui.

---

# 26. Template laporan test

```text
TEST ID:
STEP:
APP VERSION / COMMIT:
DATE:
TESTER:
ENVIRONMENT:

PRECONDITION:

STEPS:
1.
2.
3.

EXPECTED:

ACTUAL:

EVIDENCE:

STATUS: PASS / FAIL / BLOCKED

BUG / NOTES:
```

---

# 27. Aturan kerja SOL saat testing

1. Jangan menandai PASS hanya karena aplikasi dapat dibuka.
2. Setiap PASS harus sesuai expected result.
3. Setiap FAIL yang reproduktif harus mempunyai evidence/log.
4. Bug harus diperbaiki pada akar masalah.
5. Setelah bug core diperbaiki, jalankan regression pack terkait.
6. Jangan melompati compatibility gate atau isolation gate.
7. Jangan mengubah security baseline hanya agar test terlihat PASS.
8. 100-profile test berarti registry scalability, bukan memaksa 100 renderer aktif.

---

Baca dokumen ini bersama `00_MASTER_PLAN_MULTI_PROFILE_BROWSER_CORE.md`. Master Plan menentukan apa yang dibangun; Test Plan menentukan kapan implementasi boleh dianggap benar dan stabil.
