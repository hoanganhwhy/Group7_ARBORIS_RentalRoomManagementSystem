@echo off
chcp 65001 >nul
cd /d "%~dp0"
where cloudflared >nul 2>nul
if errorlevel 1 (
  if not exist "cloudflared.exe" (
    echo Khong tim thay cloudflared. Dang tu dong tai ve...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
  )
  echo Dang khoi dong cloudflared...
  .\cloudflared.exe tunnel --url http://localhost:5000
) else (
  cloudflared tunnel --url http://localhost:5000
)
