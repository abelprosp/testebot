@echo off
echo 🔑 Configurador de GROQ_API_KEY
echo ==============================

if "%1"=="" (
    echo ❌ Uso: set-groq-key.bat SUA_CHAVE_AQUI
    echo.
    echo 📝 Exemplo: set-groq-key.bat gsk_1234567890abcdef
    echo.
    echo Para obter sua chave:
    echo 1. Acesse: https://console.groq.com/keys
    echo 2. Crie uma nova API key
    echo 3. Execute: set-groq-key.bat SUA_CHAVE
    pause
    exit /b 1
)

echo 💾 Definindo GROQ_API_KEY...
set GROQ_API_KEY=%1

echo ✅ GROQ_API_KEY definida para esta sessão!
echo.
echo 🚀 Agora execute: npm run start:whatsapp
echo.
echo 📝 Para tornar permanente, adicione ao arquivo .env:
echo    GROQ_API_KEY=%1
echo.

pause
