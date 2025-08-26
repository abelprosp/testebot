#!/bin/bash

echo "🚀 Deploying Testebot..."

# Parar se estiver rodando
pm2 stop testebot-whatsapp 2>/dev/null || echo "Bot não estava rodando"

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Configurar variáveis de ambiente
export NODE_ENV=production
export ENABLE_WHATSAPP=true
export GROQ_API_KEY="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"
export PUPPETEER_EXECUTABLE_PATH="/usr/bin/google-chrome-stable"

# Criar pasta de logs
mkdir -p logs

# Iniciar com PM2
echo "🔄 Iniciando bot com PM2..."
pm2 start ecosystem.config.js --env production

# Salvar configuração
pm2 save

echo "✅ Deploy concluído!"
echo "📊 Para ver status: pm2 status"
echo "📝 Para ver logs: pm2 logs testebot-whatsapp"
echo "🔄 Para reiniciar: pm2 restart testebot-whatsapp"
