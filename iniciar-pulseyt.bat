@echo off
title Open Analytic YT - Monitor de Canais YouTube
cd /d "%~dp0"

echo ============================================
echo   Open Analytic YT - Iniciando servidor...
echo ============================================
echo.

if not exist "node_modules" (
    echo Instalando dependencias pela primeira vez...
    call npm.cmd install
    if errorlevel 1 (
        echo Erro ao instalar dependencias.
        pause
        exit /b 1
    )
)

echo Abrindo o navegador em http://localhost:5173 ...
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:5173"

echo Servidor rodando! Mantenha esta janela aberta enquanto usar o painel.
call npm.cmd run dev -- --port 5173

pause
