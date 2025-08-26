#!/bin/bash

echo "🚀 Configurando ambiente de produção..."

# Função para instalar Google Chrome
install_chrome() {
    echo "📦 Instalando Google Chrome..."
    
    if [ -f /etc/debian_version ]; then
        # Ubuntu/Debian
        wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
        echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
        sudo apt-get update
        sudo apt-get install -y google-chrome-stable
        
    elif [ -f /etc/redhat-release ]; then
        # CentOS/RHEL/Fedora
        sudo yum install -y wget
        wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
        sudo yum localinstall -y google-chrome-stable_current_x86_64.rpm
        rm google-chrome-stable_current_x86_64.rpm
        
    else
        echo "⚠️ Não foi possível instalar Chrome automaticamente"
        echo "   Instalando Chromium como alternativa..."
        
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get install -y chromium-browser
        elif command -v yum >/dev/null 2>&1; then
            sudo yum install -y chromium
        elif command -v apk >/dev/null 2>&1; then
            sudo apk add --no-cache chromium
        fi
    fi
}

# Verifica se Chrome está instalado
if ! command -v google-chrome >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1; then
    echo "🔍 Chrome/Chromium não encontrado, instalando..."
    install_chrome
else
    echo "✅ Chrome/Chromium já está instalado"
fi

# Instala dependências
echo "🔧 Instalando dependências do sistema..."
bash scripts/install-linux-deps.sh

# Configura variáveis de ambiente para produção
echo "🌍 Configurando variáveis de ambiente..."

# Detecta caminho do Chrome
CHROME_PATH=""
if command -v google-chrome >/dev/null 2>&1; then
    CHROME_PATH=$(which google-chrome)
elif command -v chromium-browser >/dev/null 2>&1; then
    CHROME_PATH=$(which chromium-browser)
elif command -v chromium >/dev/null 2>&1; then
    CHROME_PATH=$(which chromium)
fi

if [ ! -z "$CHROME_PATH" ]; then
    echo "🔍 Chrome encontrado em: $CHROME_PATH"
    export PUPPETEER_EXECUTABLE_PATH="$CHROME_PATH"
    echo "export PUPPETEER_EXECUTABLE_PATH=\"$CHROME_PATH\"" >> ~/.bashrc
fi

# Configura argumentos do Puppeteer para produção
export PUPPETEER_ARGS="--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-gpu,--no-first-run,--no-zygote,--single-process"
echo "export PUPPETEER_ARGS=\"$PUPPETEER_ARGS\"" >> ~/.bashrc

echo ""
echo "✅ Configuração de produção concluída!"
echo ""
echo "📋 Configurações aplicadas:"
echo "   - Chrome/Chromium instalado"
echo "   - Dependências do sistema instaladas"
echo "   - PUPPETEER_EXECUTABLE_PATH: $CHROME_PATH"
echo "   - Argumentos de segurança configurados"
echo ""
echo "🚀 Para iniciar o servidor:"
echo "   source ~/.bashrc"
echo "   npm run start:whatsapp"
echo ""
