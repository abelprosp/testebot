#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), 'env.example');

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function validateSupabaseUrl(url) {
  if (!url || url.trim() === '') {
    return false;
  }
  
  // Verifica se tem formato básico do Supabase
  const supabasePattern = /^https:\/\/[a-z0-9]+\.supabase\.co$/;
  return supabasePattern.test(url.trim());
}

function validateSupabaseKey(key) {
  if (!key || key.trim() === '') {
    return false;
  }
  
  // Chaves anônimas do Supabase começam com 'eyJ' (JWT)
  return key.trim().startsWith('eyJ') && key.trim().length > 100;
}

async function setupSupabase() {
  console.log('==================================================');
  console.log('🔧 Configuração do Supabase para Vagas');
  console.log('==================================================');
  console.log('');
  console.log('📝 Este script irá configurar as credenciais do Supabase no arquivo .env');
  console.log('');
  console.log('⚠️  IMPORTANTE: Você precisa ter um projeto no Supabase configurado!');
  console.log('🔗 Acesse: https://supabase.com/dashboard');
  console.log('');

  try {
    // Verifica se já existe .env
    let envContent = '';
    let existingEnv = {};
    
    if (fs.existsSync(envPath)) {
      console.log('📁 Arquivo .env já existe. Vou atualizar as configurações do Supabase.');
      envContent = fs.readFileSync(envPath, 'utf8');
      
      // Parse das variáveis existentes
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          existingEnv[key.trim()] = value.trim();
        }
      });
    } else {
      console.log('📁 Arquivo .env não existe. Criando novo arquivo baseado em env.example...');
      if (fs.existsSync(envExamplePath)) {
        envContent = fs.readFileSync(envExamplePath, 'utf8');
      }
    }

    console.log('');
    console.log('🔑 Configure as credenciais do seu projeto Supabase:');
    console.log('');

    // URL do Supabase
    const currentUrl = existingEnv.SUPABASE_URL || '';
    const urlPrompt = currentUrl ? 
      `📍 URL do Supabase (atual: ${currentUrl}): ` : 
      '📍 URL do Supabase (ex: https://seuprojetoaqui.supabase.co): ';
    
    let supabaseUrl = await question(urlPrompt);
    if (!supabaseUrl.trim() && currentUrl) {
      supabaseUrl = currentUrl; // Mantém o atual se não digitou nada
    }

    if (!validateSupabaseUrl(supabaseUrl)) {
      console.log('❌ ERRO: URL do Supabase inválida!');
      console.log('   Formato esperado: https://seuprojetoaqui.supabase.co');
      process.exit(1);
    }

    // Chave anônima do Supabase
    const currentKey = existingEnv.SUPABASE_ANON_KEY || '';
    const keyPrompt = currentKey ? 
      `🔑 Chave Anônima do Supabase (atual configurada, digite nova ou ENTER para manter): ` : 
      '🔑 Chave Anônima do Supabase (ex: eyJhbGciOiJIUzI1...): ';
    
    let supabaseKey = await question(keyPrompt);
    if (!supabaseKey.trim() && currentKey) {
      supabaseKey = currentKey; // Mantém o atual se não digitou nada
    }

    if (!validateSupabaseKey(supabaseKey)) {
      console.log('❌ ERRO: Chave do Supabase inválida!');
      console.log('   A chave deve começar com "eyJ" e ter mais de 100 caracteres.');
      console.log('🔗 Encontre sua chave em: Settings > API > Project API keys > anon public');
      process.exit(1);
    }

    // Atualiza ou cria o arquivo .env
    if (fs.existsSync(envPath)) {
      // Atualiza arquivo existente
      let updatedContent = envContent;
      
      // Atualiza SUPABASE_URL
      if (updatedContent.includes('SUPABASE_URL=')) {
        updatedContent = updatedContent.replace(/SUPABASE_URL=.*/, `SUPABASE_URL=${supabaseUrl}`);
      } else {
        updatedContent += `\nSUPABASE_URL=${supabaseUrl}`;
      }
      
      // Atualiza SUPABASE_ANON_KEY
      if (updatedContent.includes('SUPABASE_ANON_KEY=')) {
        updatedContent = updatedContent.replace(/SUPABASE_ANON_KEY=.*/, `SUPABASE_ANON_KEY=${supabaseKey}`);
      } else {
        updatedContent += `\nSUPABASE_ANON_KEY=${supabaseKey}`;
      }
      
      fs.writeFileSync(envPath, updatedContent);
    } else {
      // Cria novo arquivo baseado no example
      let newContent = envContent;
      newContent = newContent.replace(/SUPABASE_URL=.*/, `SUPABASE_URL=${supabaseUrl}`);
      newContent = newContent.replace(/SUPABASE_ANON_KEY=.*/, `SUPABASE_ANON_KEY=${supabaseKey}`);
      
      fs.writeFileSync(envPath, newContent);
    }

    console.log('');
    console.log('✅ Configuração do Supabase salva com sucesso!');
    console.log('');
    console.log('📋 Próximos passos:');
    console.log('1. Certifique-se de que sua tabela "jobs" existe no Supabase');
    console.log('2. Certifique-se de que há vagas com is_active = true');
    console.log('3. Reinicie o servidor: npm run start:whatsapp');
    console.log('');
    console.log('📊 Estrutura esperada da tabela "jobs":');
    console.log('  - id (int, primary key)');
    console.log('  - title (text)');
    console.log('  - company (text)');
    console.log('  - description (text)');
    console.log('  - location (text)');
    console.log('  - is_active (boolean)');
    console.log('  - created_at (timestamp)');
    console.log('');

  } catch (error) {
    console.error('❌ Erro durante a configuração:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

if (require.main === module) {
  setupSupabase();
}

module.exports = { setupSupabase };
