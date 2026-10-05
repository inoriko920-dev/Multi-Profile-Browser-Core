@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo Multi-Profile-Browser-Core - STEP 02 Manual Test
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js tidak ditemukan di PATH.
  echo Install Node.js 24 lalu jalankan file ini lagi.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm tidak ditemukan di PATH.
  echo Pastikan instalasi Node.js/npm benar.
  echo.
  pause
  exit /b 1
)

echo Launcher akan menjalankan seluruh preflight STEP 02,
echo membuat evidence lokal, lalu membuka browser untuk login manual.
echo Password, OTP, cookie, dan token TIDAK dibaca oleh launcher.
echo.

call npm run step02:manual
set EXIT_CODE=%ERRORLEVEL%

echo.
if "%EXIT_CODE%"=="0" (
  echo STEP 02 launcher selesai.
) else (
  echo STEP 02 launcher berhenti karena salah satu gate gagal.
  echo Periksa pesan error di atas sebelum mencoba lagi.
)
echo.
pause
exit /b %EXIT_CODE%
