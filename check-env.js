require('dotenv').config();
const path = require('path');
const fs = require('fs');

console.log('🔍 Verificando variáveis de ambiente...\n');

// Verifica se o arquivo .env existe
const envPath = path.join(__dirname, '.env');
console.log(`📁 Caminho do arquivo .env: ${envPath}`);
console.log(`📁 Arquivo .env existe: ${fs.existsSync(envPath) ? '✅ Sim' : '❌ Não'}\n`);

// Lista todas as variáveis de ambiente relacionadas ao projeto
const envVars = {
  'GROQ_API_KEY': process.env.GROQ_API_KEY,
  'SUPABASE_URL': process.env.SUPABASE_URL,
  'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY,
  'DASHBOARD_TOKEN': process.env.DASHBOARD_TOKEN,
  'COMPANY_NAME': process.env.COMPANY_NAME,
  'COMPANY_WEBSITE': process.env.COMPANY_WEBSITE,
  'COMPANY_EMAIL': process.env.COMPANY_EMAIL,
  'WHATSAPP_NUMBER': process.env.WHATSAPP_NUMBER,
  'PORT': process.env.PORT,
  'DASHBOARD_PORT': process.env.DASHBOARD_PORT,
  'NODE_ENV': process.env.NODE_ENV,
  'RENDER': process.env.RENDER
};

console.log('📋 Variáveis de ambiente encontradas:');
console.log('=====================================');

let missingVars = [];
let configuredVars = [];

for (const [key, value] of Object.entries(envVars)) {
  if (value) {
    if (key.includes('KEY') || key.includes('TOKEN')) {
      console.log(`${key}: ${value.substring(0, 10)}... (${value.length} caracteres)`);
    } else {
      console.log(`${key}: ${value}`);
    }
    configuredVars.push(key);
  } else {
    console.log(`${key}: ❌ Não configurada`);
    missingVars.push(key);
  }
}

console.log('\n📊 Resumo:');
console.log(`✅ Configuradas: ${configuredVars.length}`);
console.log(`❌ Faltando: ${missingVars.length}`);

if (missingVars.length > 0) {
  console.log('\n⚠️ Variáveis faltando:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
}

// Verifica especificamente o Supabase
console.log('\n🔧 Verificação específica do Supabase:');
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  console.log('✅ Supabase configurado corretamente');
  console.log(`   URL: ${process.env.SUPABASE_URL}`);
  console.log(`   Chave: ${process.env.SUPABASE_ANON_KEY.substring(0, 10)}...`);
} else {
  console.log('❌ Supabase não configurado');
  if (!process.env.SUPABASE_URL) console.log('   - SUPABASE_URL faltando');
  if (!process.env.SUPABASE_ANON_KEY) console.log('   - SUPABASE_ANON_KEY faltando');
}

// Verifica Groq
console.log('\n🤖 Verificação específica do Groq:');
if (process.env.GROQ_API_KEY) {
  console.log('✅ Groq configurado');
  console.log(`   Chave: ${process.env.GROQ_API_KEY.substring(0, 10)}...`);
} else {
  console.log('❌ Groq não configurado');
  console.log('   - GROQ_API_KEY faltando');
}

// Testa carregamento do config
console.log('\n⚙️ Testando carregamento do config.js:');
try {
  const config = require('./src/config/config');
  console.log('✅ Config carregado com sucesso');
  console.log(`   Supabase URL: ${config.supabase.url}`);
  console.log(`   Supabase Key: ${config.supabase.key.substring(0, 10)}...`);
  console.log(`   Groq Key: ${config.groq.apiKey.substring(0, 10)}...`);
} catch (error) {
  console.log('❌ Erro ao carregar config:', error.message);
}

console.log('\n💡 Dicas:');
if (missingVars.length > 0) {
  console.log('- Execute "npm run setup-supabase" para configurar o Supabase');
  console.log('- Execute "npm run setup" para configuração geral');
}
console.log('- Verifique se o arquivo .env está no diretório raiz do projeto');
console.log('- Em produção, configure as variáveis no painel de controle do servidor');
