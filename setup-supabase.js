const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 Configuração do Supabase');
console.log('==========================\n');

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupSupabase() {
  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    // Verifica se o arquivo .env já existe
    if (fs.existsSync(envPath)) {
      console.log('📁 Arquivo .env encontrado. Vou atualizar as configurações do Supabase...\n');
      envContent = fs.readFileSync(envPath, 'utf8');
    } else {
      console.log('📁 Criando novo arquivo .env...\n');
      // Conteúdo base do .env
      envContent = `# Configurações da API Groq (opcional - usa padrão se não configurado)
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
`;
    }

    console.log('📋 Por favor, forneça as informações do seu projeto Supabase:\n');

    const supabaseUrl = await question('🌐 URL do projeto Supabase (ex: https://abc123.supabase.co): ');
    const supabaseKey = await question('🔑 Chave anônima do Supabase: ');

    if (!supabaseUrl || !supabaseKey) {
      console.log('❌ URL e chave do Supabase são obrigatórias!');
      rl.close();
      return;
    }

    // Atualiza ou adiciona as configurações do Supabase
    const lines = envContent.split('\n');
    let supabaseUrlUpdated = false;
    let supabaseKeyUpdated = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('SUPABASE_URL=')) {
        lines[i] = `SUPABASE_URL=${supabaseUrl}`;
        supabaseUrlUpdated = true;
      } else if (lines[i].startsWith('SUPABASE_ANON_KEY=')) {
        lines[i] = `SUPABASE_ANON_KEY=${supabaseKey}`;
        supabaseKeyUpdated = true;
      }
    }

    // Adiciona as configurações se não existirem
    if (!supabaseUrlUpdated) {
      lines.push(`SUPABASE_URL=${supabaseUrl}`);
    }
    if (!supabaseKeyUpdated) {
      lines.push(`SUPABASE_ANON_KEY=${supabaseKey}`);
    }

    const newEnvContent = lines.join('\n');

    // Salva o arquivo .env
    fs.writeFileSync(envPath, newEnvContent);

    console.log('\n✅ Configurações do Supabase salvas com sucesso!');
    console.log(`📁 Arquivo: ${envPath}`);
    console.log(`🌐 URL: ${supabaseUrl}`);
    console.log(`🔑 Chave: ${supabaseKey.substring(0, 10)}...`);

    console.log('\n🔄 Para aplicar as mudanças, reinicie o sistema.');
    console.log('💡 Dica: Execute "npm start" ou reinicie o PM2 se estiver usando.');

  } catch (error) {
    console.error('❌ Erro ao configurar Supabase:', error.message);
  } finally {
    rl.close();
  }
}

setupSupabase();
