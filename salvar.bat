@echo off
echo 🚀 Sincronizando com o GitHub e Nuvem...
"C:\Program Files\Git\bin\git.exe" add .
"C:\Program Files\Git\bin\git.exe" commit -m "Atualizacao automatica"
"C:\Program Files\Git\bin\git.exe" push origin main
echo ✅ TUDO SALVO E SINCRONIZADO!
pause
