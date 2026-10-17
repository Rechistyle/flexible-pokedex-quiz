@echo off
cd /d "%~dp0"
echo Abriendo el quiz en el navegador... (cierra esta ventana para pararlo)
start "" http://localhost:3000
node scripts\serve.js
pause
