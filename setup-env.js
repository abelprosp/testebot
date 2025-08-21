const fs = require('fs');
const path = require('path');

// Conteúdo do arquivo .env
const envContent = `# Configurações da API Groq (opcional - usa padrão se não configurado)
GROQ_API_KEY=sua_chave_api_groq_aqui

# Configurações do Supabase (obrigatório para vagas)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima_supabase

# Token de autenticação do dashboard (padrão: Jornada2024@)
DASHBOARD_TOKEN=Jornada2024@

# Configurações da empresa (opcionais - usam padrão se não configuradas)
COMPANY_NAME=Evolux Soluções de RH
COMPANY_WEBSITE=https://evoluxrh.com.br
COMPANY_EMAIL=contato@evoluxrh.com.br

# Número do WhatsApp (opcional - usa padrão se não configurado)
WHATSAPP_NUMBER=5511999999999

# Portas dos servidores (opcionais - usam padrão se não configuradas)
PORT=3000
DASHBOARD_PORT=3003

# Configuração do Chrome para Windows
CHROME_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
`;

// Verifica se o arquivo .env já existe
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('⚠️ Arquivo .env já existe. Não será sobrescrito.');
} else {
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Arquivo .env criado com sucesso!');
    console.log('📝 Configure suas chaves de API no arquivo .env');
  } catch (error) {
    console.error('❌ Erro ao criar arquivo .env:', error.message);
  }
}

console.log('\n🔍 Verificando configuração do Chrome...');
const config = require('./src/config/config');
console.log('🌐 Chrome Path:', config.whatsapp.executablePath);
console.log('👁️ Headless:', config.whatsapp.headless);
