require('dotenv').config();
const fs = require('fs');
const path = require('path');

console.log('🔧 Verificação e Correção de Configuração do Servidor');
console.log('=====================================================\n');

// Verifica se está em produção
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER;

console.log(`🌍 Ambiente: ${isProduction ? 'Produção' : 'Desenvolvimento'}`);
console.log(`🏠 Servidor: ${process.env.RENDER ? 'Render' : 'Local/Outro'}\n`);

// Verifica variáveis críticas
const criticalVars = {
  'SUPABASE_URL': process.env.SUPABASE_URL,
  'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY,
  'GROQ_API_KEY': process.env.GROQ_API_KEY
};

console.log('🔍 Verificando variáveis críticas:');
let hasIssues = false;

for (const [key, value] of Object.entries(criticalVars)) {
  if (!value) {
    console.log(`❌ ${key}: Não configurada`);
    hasIssues = true;
  } else {
    console.log(`✅ ${key}: Configurada (${value.substring(0, 10)}...)`);
  }
}

if (hasIssues) {
  console.log('\n⚠️ Problemas encontrados!');
  
  if (isProduction) {
    console.log('\n🔧 Para servidor de produção:');
    console.log('1. Acesse o painel de controle do seu servidor');
    console.log('2. Configure as variáveis de ambiente:');
    console.log('   - SUPABASE_URL');
    console.log('   - SUPABASE_ANON_KEY');
    console.log('   - GROQ_API_KEY');
    console.log('3. Reinicie o serviço após configurar');
  } else {
    console.log('\n🔧 Para desenvolvimento local:');
    console.log('1. Execute: npm run setup-supabase');
    console.log('2. Execute: npm run setup');
    console.log('3. Verifique se o arquivo .env foi criado');
  }
} else {
  console.log('\n✅ Todas as variáveis críticas estão configuradas!');
}

// Verifica se o arquivo .env existe localmente
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

console.log(`\n📁 Arquivo .env local: ${envExists ? '✅ Existe' : '❌ Não existe'}`);

if (!envExists && !isProduction) {
  console.log('\n💡 Criando arquivo .env básico...');
  const basicEnv = `# Configurações básicas
# Adicione suas chaves aqui

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima_supabase

# Groq
GROQ_API_KEY=sua_chave_api_groq

# Dashboard
DASHBOARD_TOKEN=Jornada2024@

# Servidor
PORT=3000
DASHBOARD_PORT=3003
`;
  
  try {
    fs.writeFileSync(envPath, basicEnv);
    console.log('✅ Arquivo .env criado com configurações básicas');
    console.log('💡 Edite o arquivo .env com suas chaves reais');
  } catch (error) {
    console.log('❌ Erro ao criar arquivo .env:', error.message);
  }
}

// Testa carregamento do config
console.log('\n⚙️ Testando carregamento do sistema...');
try {
  const config = require('./src/config/config');
  console.log('✅ Configuração carregada com sucesso');
  
  // Verifica se as configurações estão sendo lidas corretamente
  if (config.supabase.url && config.supabase.url !== 'https://your-project.supabase.co') {
    console.log('✅ Supabase configurado corretamente');
  } else {
    console.log('⚠️ Supabase usando valores padrão');
  }
  
  if (config.groq.apiKey && config.groq.apiKey !== 'gsk_1234567890abcdef') {
    console.log('✅ Groq configurado corretamente');
  } else {
    console.log('⚠️ Groq usando valores padrão');
  }
  
} catch (error) {
  console.log('❌ Erro ao carregar configuração:', error.message);
}

console.log('\n📋 Próximos passos:');
if (hasIssues) {
  console.log('1. Configure as variáveis de ambiente');
  console.log('2. Execute: npm run check-env (para verificar)');
  console.log('3. Execute: npm run test-supabase (para testar Supabase)');
  console.log('4. Reinicie o sistema');
} else {
  console.log('1. Execute: npm run test-supabase (para testar Supabase)');
  console.log('2. Execute: npm run migrate-db (para migrar banco)');
  console.log('3. Reinicie o sistema');
}

console.log('\n🎯 Sistema pronto para uso!');
