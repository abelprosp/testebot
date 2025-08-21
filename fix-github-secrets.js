const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔒 Corrigindo problema de chaves expostas no GitHub...\n');

// Função para executar comandos Git
function runGitCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    console.error(`❌ Erro ao executar: ${command}`);
    console.error(error.message);
    return null;
  }
}

// Função para verificar se um arquivo contém chaves sensíveis
function containsSecrets(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Padrões para detectar chaves da API Groq
    const groqPatterns = [
      /GROQ_API_KEY\s*=\s*[a-zA-Z0-9_-]{20,}/,
      /sk-[a-zA-Z0-9_-]{20,}/,
      /gsk_[a-zA-Z0-9_-]{20,}/
    ];
    
    return groqPatterns.some(pattern => pattern.test(content));
  } catch (error) {
    return false;
  }
}

// Função para limpar chaves sensíveis de um arquivo
function cleanSecretsFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Substituir chaves da API Groq por placeholders
    const groqKeyPattern = /(GROQ_API_KEY\s*=\s*)([a-zA-Z0-9_-]{20,})/g;
    if (groqKeyPattern.test(content)) {
      content = content.replace(groqKeyPattern, '$1SUA_CHAVE_GROQ_AQUI');
      modified = true;
    }
    
    // Substituir chaves Supabase por placeholders
    const supabaseUrlPattern = /(SUPABASE_URL\s*=\s*)(https:\/\/[a-zA-Z0-9_-]+\.supabase\.co)/g;
    if (supabaseUrlPattern.test(content)) {
      content = content.replace(supabaseUrlPattern, '$1SUA_URL_SUPABASE_AQUI');
      modified = true;
    }
    
    const supabaseKeyPattern = /(SUPABASE_ANON_KEY\s*=\s*)([a-zA-Z0-9_-]{20,})/g;
    if (supabaseKeyPattern.test(content)) {
      content = content.replace(supabaseKeyPattern, '$1SUA_CHAVE_SUPABASE_AQUI');
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Limpeza realizada em: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Erro ao limpar ${filePath}:`, error.message);
    return false;
  }
}

// Função principal
async function fixGitHubSecrets() {
  console.log('🔍 Verificando arquivos com chaves sensíveis...\n');
  
  // Lista de arquivos para verificar
  const filesToCheck = [
    'fix-env-file.js',
    '.env.backup',
    '.env',
    'env.example',
    'src/config/config.js'
  ];
  
  let foundSecrets = false;
  
  // Verificar cada arquivo
  for (const file of filesToCheck) {
    if (containsSecrets(file)) {
      console.log(`⚠️ Chaves sensíveis encontradas em: ${file}`);
      foundSecrets = true;
      
      // Limpar chaves sensíveis
      if (cleanSecretsFromFile(file)) {
        console.log(`✅ Chaves sensíveis removidas de: ${file}`);
      }
    }
  }
  
  if (!foundSecrets) {
    console.log('✅ Nenhuma chave sensível encontrada nos arquivos principais');
  }
  
  console.log('\n🔧 Próximos passos para resolver o problema:');
  console.log('1. Remover arquivos com chaves sensíveis do histórico do Git');
  console.log('2. Fazer commit das correções');
  console.log('3. Fazer push novamente');
  
  console.log('\n📋 Comandos recomendados:');
  console.log('git add .');
  console.log('git commit -m "fix: remove sensitive keys from codebase"');
  console.log('git push origin main');
  
  // Se encontrou chaves sensíveis, oferecer para executar os comandos
  if (foundSecrets) {
    console.log('\n🚀 Deseja executar os comandos Git automaticamente? (y/n)');
    // Aqui você pode adicionar lógica para interação se necessário
  }
}

// Executar a correção
fixGitHubSecrets().catch(console.error);
