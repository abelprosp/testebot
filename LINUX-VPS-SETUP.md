# 🐧 Configuração para VPS Linux

Este guia mostra como configurar o bot WhatsApp em um VPS Linux (Ubuntu, CentOS, etc.).

## 📋 Problema Comum

O erro `libnss3.so: cannot open shared object file` acontece porque faltam dependências do Chrome/Chromium no sistema Linux.

## 🚀 Solução Automática

Execute o script de configuração completa:

```bash
# 1. Tornar o script executável
chmod +x scripts/setup-production.sh

# 2. Executar configuração completa
bash scripts/setup-production.sh
```

Este script irá:
- ✅ Instalar Google Chrome ou Chromium
- ✅ Instalar todas as dependências necessárias
- ✅ Configurar variáveis de ambiente
- ✅ Otimizar argumentos do Puppeteer

## 🔧 Configuração Manual

Se preferir configurar manualmente:

### 1. Instalar Dependências

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y ca-certificates fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils

# CentOS/RHEL/Fedora
sudo yum install -y alsa-lib atk cairo cups-libs dbus-glib expat fontconfig freetype gcc gdk-pixbuf2 glib2 glibc gtk3 libgcc libstdc++ libX11 libX11-xcb libxcb libXcomposite libXcursor libXdamage libXext libXfixes libXi libXrandr libXrender libXScrnSaver libXtst nspr nss pango wget
```

### 2. Instalar Google Chrome

```bash
# Ubuntu/Debian
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt-get update
sudo apt-get install -y google-chrome-stable

# CentOS/RHEL/Fedora
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo yum localinstall -y google-chrome-stable_current_x86_64.rpm
```

### 3. Configurar Variáveis de Ambiente

```bash
# Definir caminho do Chrome
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome-stable"

# Adicionar ao perfil para persistir
echo 'export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome-stable"' >> ~/.bashrc
source ~/.bashrc
```

## 🎯 Executar o Bot

Após a configuração:

```bash
# Instalar dependências Node.js
npm install

# Iniciar o bot
npm run start:whatsapp
```

## 🛠️ Scripts Disponíveis

- `npm run install-deps` - Instala apenas as dependências do sistema
- `npm run setup-production` - Configuração completa para produção
- `npm run setup-groq` - Configurar API key da Groq
- `npm run setup-supabase` - Configurar credenciais do Supabase

## 🐳 Alternativa com Docker

Se tiver problemas com dependências, considere usar Docker:

```dockerfile
FROM node:18

# Instalar dependências do Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
EXPOSE 3000

CMD ["npm", "run", "start:whatsapp"]
```

## 📊 Verificação

Para verificar se tudo está funcionando:

```bash
# Verificar se Chrome está instalado
google-chrome-stable --version

# Verificar se as dependências estão OK
ldd /usr/bin/google-chrome-stable | grep "not found"
# Não deve mostrar nenhuma linha

# Testar o bot
npm run start:whatsapp
```

## ❌ Solução de Problemas

### Erro: "No usable sandbox!"
```bash
# O bot já tem --no-sandbox configurado, mas se persistir:
export PUPPETEER_ARGS="--no-sandbox,--disable-setuid-sandbox"
```

### Erro: "Failed to launch chrome"
```bash
# Verificar permissões
chmod +x /usr/bin/google-chrome-stable

# Ou usar Chromium como alternativa
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"
```

### Erro: "Cannot open display"
```bash
# Para servidores sem interface gráfica (normal em VPS)
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 &
# Ou simplesmente use headless: true (já configurado)
```

## 📞 Suporte

Se ainda tiver problemas:

1. Verifique os logs do bot
2. Execute `npm run setup-production` novamente
3. Tente usar Chromium: `export PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium-browser"`

**O bot está otimizado para funcionar em VPS Linux! 🚀**
