#!/usr/bin/env node

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupEnv() {
  console.log('🔧 CONFIGURAÇÃO DO ARQUIVO .ENV');
  console.log('='.repeat(50));
  
  console.log('\n📝 Este script irá criar/atualizar o arquivo .env com suas configurações.');
  console.log('⚠️  IMPORTANTE: Você precisa ter uma chave da API Groq válida!');
  console.log('🔗 Obtenha sua chave em: https://console.groq.com/\n');

  // Verifica se já existe um arquivo .env
  const envExists = fs.existsSync('.env');
  if (envExists) {
    console.log('📁 Arquivo .env já existe. Vou atualizar as configurações.');
  }

  // Coleta as configurações
  const groqApiKey = await question('🔑 Digite sua chave da API Groq (OBRIGATÓRIO): ');
  
  if (!groqApiKey || groqApiKey === '') {
    console.log('\n❌ ERRO: Você precisa fornecer uma chave válida da API Groq!');
    console.log('🔗 Acesse: https://console.groq.com/ para obter sua chave.');
    rl.close();
    return;
  }

  const whatsappNumber = await question('📱 Número do WhatsApp (Enter para usar padrão 5511999999999): ') || '5511999999999';
  const port = await question('🌐 Porta do servidor (Enter para usar padrão 3000): ') || '3000';
  const dashboardPort = await question('📊 Porta do dashboard (Enter para usar padrão 3003): ') || '3003';
  const dashboardToken = await question('🔐 Token do dashboard (Enter para usar padrão Jornada2024@): ') || 'Jornada2024@';

  // Cria o conteúdo do arquivo .env
  const envContent = `# Configurações da API Groq (OBRIGATÓRIO)
GROQ_API_KEY=${groqApiKey}

# Configurações do Supabase (opcional - para vagas)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima_supabase

# Token de autenticação do dashboard
DASHBOARD_TOKEN=${dashboardToken}

# Configurações da empresa
COMPANY_NAME=Evolux Soluções de RH
COMPANY_WEBSITE=https://evoluxrh.com.br
COMPANY_EMAIL=contato@evoluxrh.com.br

# Número do WhatsApp
WHATSAPP_NUMBER=${whatsappNumber}

# Portas dos servidores
PORT=${port}
DASHBOARD_PORT=${dashboardPort}

# Configurações do WhatsApp
WHATSAPP_HEADLESS=true

# NOTA: Para usar Chrome embutido do Puppeteer, NÃO configure CHROME_PATH
# CHROME_PATH=C:\\caminho\\para\\chrome.exe
`;

  // Salva o arquivo .env
  try {
    fs.writeFileSync('.env', envContent);
    console.log('\n✅ Arquivo .env criado/atualizado com sucesso!');
    
    console.log('\n📋 RESUMO DAS CONFIGURAÇÕES:');
    console.log(`🔑 API Groq: ${groqApiKey.substring(0, 10)}...`);
    console.log(`📱 WhatsApp: ${whatsappNumber}`);
    console.log(`🌐 Porta: ${port}`);
    console.log(`📊 Dashboard: ${dashboardPort}`);
    console.log(`🔐 Token: ${dashboardToken}`);
    
    console.log('\n🚀 PRÓXIMOS PASSOS:');
    console.log('1. Verifique se a chave da API Groq está correta');
    console.log('2. Execute: npm start');
    console.log('3. O sistema usará o Chrome embutido do Puppeteer');
    
  } catch (error) {
    console.error('\n❌ Erro ao criar arquivo .env:', error.message);
  }

  rl.close();
}

// Executa o setup
setupEnv().catch(console.error);
