@echo off
echo ===================================================
echo   KHOI DONG HE THONG QUAN LY PHONG TRO (HOSTELMATE)
echo ===================================================
echo.
echo Dang khoi dong may chu web va he thong du lieu...
start cmd /k "npm run dev:all"

echo Dang khoi dong he thong nhan thong bao tu dong (Cloudflare Tunnel)...
start cmd /k "cloudflared.exe tunnel --url http://localhost:5000"

echo.
echo HOAN TAT! 
echo - Ban co the thu nho 2 cua so mau den vua hien ra (Khong duoc dong bang dau X).
echo - Vao trinh duyet va truy cap: http://localhost:5173
echo.
pause
