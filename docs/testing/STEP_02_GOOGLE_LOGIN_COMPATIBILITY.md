# STEP 02 — Google Login Compatibility Gate

## Tujuan

Membuktikan bahwa browser core dapat menjalankan login Google **secara normal** pada satu akun uji yang pengguna berwenang kelola, sebelum persistent session dan multi-profile dibuat.

STEP ini adalah hard gate. Jangan lanjut STEP 03 bila login Google belum terbukti kompatibel.

## Penting

- Login dilakukan manual oleh pengguna.
- Jangan masukkan password, OTP, recovery code, cookie, token, atau credential ke log/issue/screenshot.
- Jangan menambahkan user-agent spoofing, anti-detection, CAPTCHA bypass, cookie injection, atau `webSecurity: false` untuk memaksa login.
- STEP 02 masih memakai session in-memory/non-persistent. Restart persistence baru diuji di STEP 03.
- Google dapat menolak authorization flow tertentu di embedded user-agent. Bila muncul error seperti `disallowed_useragent` atau pesan unsupported browser, catat error dan STOP; jangan diakali.

## Persiapan Windows

Pada clone terbaru branch `main`:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run smoke
npm run smoke:browser
npm start
```

Pastikan semua command otomatis PASS sebelum login manual dimulai.

## T02-01 — Buka halaman Google

1. Jalankan `npm start`.
2. Pada URL bar, buka `https://accounts.google.com/`.
3. Pastikan halaman Google tampil di browser surface utama.

**PASS:** halaman autentikasi tampil normal tanpa crash atau error arsitektur.

## T02-02 — Login manual

1. Gunakan satu akun uji milik/yang sah dikelola pengguna.
2. Ketik email/password sendiri pada halaman Google.
3. Selesaikan 2FA sendiri bila Google meminta.
4. Jangan mengotomatisasi CAPTCHA atau security challenge.

**PASS:** Google menerima login melalui flow normal.

**FAIL/BLOCKER:** Google menolak browser/embedded user-agent atau flow tidak dapat diselesaikan secara normal.

## T02-03 — Google service access

Setelah login, buka berurutan:

```text
https://www.google.com/
https://www.youtube.com/
https://studio.youtube.com/
```

**PASS:** status login konsisten di ketiga target selama aplikasi masih berjalan.

Catatan: belum ada kewajiban tetap login setelah app ditutup pada STEP 02.

## T02-04 — Navigation regression

Saat masih login:

1. Back.
2. Forward.
3. Reload.
4. Pindah antara YouTube dan YouTube Studio.

**PASS:** browser tidak crash, akun tidak berubah karena bug aplikasi, dan toolbar tetap bekerja.

## T02-05 — Evidence aman

Catat hanya:

```text
OS
commit SHA
Electron version
Chromium version
Node version
Tanggal test
T02-01 PASS/FAIL
T02-02 PASS/FAIL
T02-03 PASS/FAIL
T02-04 PASS/FAIL
Pesan error non-sensitif jika ada
```

Boleh screenshot halaman setelah login bila tidak memuat informasi sensitif; sensor email/nama/channel bila perlu.

Jangan unggah credential atau cookie value.

## STOP CONDITION

Bila login Google gagal karena kompatibilitas browser, STEP 03–16 tidak boleh digunakan untuk menutupi masalah. Evaluasi `BrowserBackend` atau pendekatan login yang didukung layanan terlebih dahulu.

## PASS FINAL STEP 02

STEP 02 hanya PASS bila:

- halaman login Google dapat dibuka;
- login manual selesai tanpa bypass;
- Google, YouTube, dan YouTube Studio dapat digunakan dalam session yang sama;
- Back/Forward/Reload tetap normal;
- log tidak mengandung credential;
- tidak ada konfigurasi keamanan yang diturunkan untuk memaksa login.
