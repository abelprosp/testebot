#!/bin/bash

echo "🔧 Instalando dependências do Chrome/Puppeteer para Linux..."

# Detecta a distribuição Linux
if [ -f /etc/debian_version ]; then
    # Ubuntu/Debian
    echo "📋 Detectado sistema Debian/Ubuntu"
    
    echo "🔄 Atualizando pacotes..."
    sudo apt-get update
    
    echo "📦 Instalando dependências do Chrome..."
    sudo apt-get install -y \
        ca-certificates \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        wget \
        xdg-utils

elif [ -f /etc/redhat-release ]; then
    # CentOS/RHEL/Fedora
    echo "📋 Detectado sistema Red Hat/CentOS/Fedora"
    
    echo "🔄 Atualizando pacotes..."
    sudo yum update -y
    
    echo "📦 Instalando dependências do Chrome..."
    sudo yum install -y \
        alsa-lib \
        atk \
        cairo \
        cups-libs \
        dbus-glib \
        expat \
        fontconfig \
        freetype \
        gcc \
        gdk-pixbuf2 \
        glib2 \
        glibc \
        gtk3 \
        libgcc \
        libstdc++ \
        libX11 \
        libX11-xcb \
        libxcb \
        libXcomposite \
        libXcursor \
        libXdamage \
        libXext \
        libXfixes \
        libXi \
        libXrandr \
        libXrender \
        libXScrnSaver \
        libXtst \
        nspr \
        nss \
        pango \
        wget

elif [ -f /etc/alpine-release ]; then
    # Alpine Linux
    echo "📋 Detectado sistema Alpine Linux"
    
    echo "🔄 Atualizando pacotes..."
    sudo apk update
    
    echo "📦 Instalando dependências do Chrome..."
    sudo apk add --no-cache \
        chromium \
        nss \
        freetype \
        freetype-dev \
        harfbuzz \
        ca-certificates \
        ttf-freefont \
        udev \
        xvfb

else
    echo "❌ Distribuição Linux não reconhecida"
    echo "   Por favor, instale manualmente as dependências do Chrome"
    exit 1
fi

echo ""
echo "✅ Dependências instaladas com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo "1. Execute: npm install"
echo "2. Execute: npm run start:whatsapp"
echo ""
echo "💡 Se ainda tiver problemas, tente usar Chrome instalado do sistema:"
echo "   export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome"
echo "   ou"
echo "   export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser"
echo ""
