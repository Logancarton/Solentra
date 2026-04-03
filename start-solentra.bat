@echo off
echo Starting Solentra...

echo Starting Redis...
net start memurai 2>nul || net start redis 2>nul || echo Redis already running

echo Starting Solentra Server...
start "Solentra Server" cmd /k "cd /d C:\Users\Logan\Solentra\packages\server && npm run dev"

timeout /t 5 /nobreak >nul

echo Starting Solentra App...
start "Solentra App" cmd /k "cd /d C:\Users\Logan\Solentra\packages\app && npm run dev"

timeout /t 3 /nobreak >nul

echo Opening Solentra...
start http://localhost:3000

echo Solentra is starting! Browser will open shortly.
