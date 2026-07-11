@echo off
setlocal EnableExtensions EnableDelayedExpansion
title HOSTELMATE - KHOI DONG HE THONG TU DONG
color 0A

echo ==========================================================
echo        HOSTELMATE - KHOI DONG HE THONG TU DONG
echo ==========================================================
echo.

REM ==========================================================
REM 1. Kiem tra cloudflared
REM ==========================================================
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay cloudflared trong PATH.
    echo Hay cai dat cloudflared hoac dat cloudflared.exe trong PATH.
    pause
    exit /b 1
)

REM ==========================================================
REM 2. Khoi dong du an
REM ==========================================================
echo [1/5] Dang khoi dong npm run dev:all...
start "HOSTELMATE - DEV SERVER" cmd /k "npm run dev:all"

echo Dang cho server khoi dong...
timeout /t 5 /nobreak >nul

REM ==========================================================
REM 3. Khoi dong Cloudflare Tunnel va ghi log
REM ==========================================================
echo [2/5] Dang khoi dong Cloudflare Tunnel...

set "LOGFILE=%TEMP%\hostelmate_cloudflared.log"
if exist "%LOGFILE%" del /f /q "%LOGFILE%" >nul 2>&1

start "HOSTELMATE - CLOUDFLARE TUNNEL" cmd /k "cloudflared tunnel --url http://localhost:5000 2^>^&1 ^| powershell -NoProfile -Command ""$input | Tee-Object -FilePath '%LOGFILE%' -Append"""

echo [3/5] Dang doi URL trycloudflare moi...
set "TUNNEL_URL="

for /L %%I in (1,1,30) do (
    if exist "%LOGFILE%" (
        for /f "usebackq delims=" %%U in (`powershell -NoProfile -Command "$m = Select-String -Path '%LOGFILE%' -Pattern 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' -AllMatches -ErrorAction SilentlyContinue | Select-Object -Last 1; if ($m) { $m.Matches.Value }"`) do (
            set "TUNNEL_URL=%%U"
        )
    )

    if defined TUNNEL_URL goto :FOUND_URL
    timeout /t 1 /nobreak >nul
)

echo.
echo [CANH BAO] Khong tu dong lay duoc URL Cloudflare sau 30 giay.
echo Hay xem cua so "HOSTELMATE - CLOUDFLARE TUNNEL" va copy URL thu cong.
goto :OPEN_APP

:FOUND_URL
set "WEBHOOK_URL=!TUNNEL_URL!/api/webhooks/sepay"

echo.
echo ==========================================================
echo  CLOUDFLARE URL:
echo  !TUNNEL_URL!
echo.
echo  SEPAY WEBHOOK URL:
echo  !WEBHOOK_URL!
echo ==========================================================
echo.

echo !WEBHOOK_URL! | clip
echo [4/5] Da copy URL webhook SePay vao clipboard.
echo Chi can Ctrl+V vao muc Webhook URL cua SePay.

(
    echo Cloudflare URL: !TUNNEL_URL!
    echo SePay Webhook URL: !WEBHOOK_URL!
) > "%~dp0SEPAY_WEBHOOK_URL.txt"

echo Da luu URL vao:
echo %~dp0SEPAY_WEBHOOK_URL.txt
echo.

REM Mo trang SePay de cap nhat webhook thu cong
start "" "https://my.sepay.vn/"

:OPEN_APP
echo [5/5] Dang mo HostelMate...
start "" "http://localhost:5173"

echo.
echo ==========================================================
echo  HE THONG DA DUOC KHOI DONG
echo ==========================================================
echo.
echo - Cua so 1: npm run dev:all
echo - Cua so 2: Cloudflare Tunnel
echo - Web app: http://localhost:5173
echo - URL webhook da duoc copy vao clipboard neu lay thanh cong
echo.
echo LUU Y:
echo Khong dong 2 cua so CMD dang chay server va tunnel.
echo Moi lan khoi dong Cloudflare Quick Tunnel, URL co the thay doi.
echo.
pause
endlocal
