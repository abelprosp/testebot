#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔑 Configurador da GROQ API Key');
console.log('===============================\n');

// Verifica se já existe .env
const envPath = '.env';
const envExamplePath = 'env.example';

if (fs.existsSync(envPath)) {
  console.log('✅ Arquivo .env já existe');
  
  // Lê o arquivo .env
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  if (envContent.includes('GROQ_API_KEY=') && 
      !envContent.includes('GROQ_API_KEY=gsk_sua_chave_aqui_exemplo') &&
      !envContent.includes('GROQ_API_KEY=sua_chave_aqui') &&
      !envContent.includes('GROQ_API_KEY=')) {
    console.log('✅ GROQ_API_KEY já está configurada no .env');
  } else {
    console.log('⚠️  GROQ_API_KEY não está configurada no .env ou usando valor de exemplo');
    console.log('📝 Edite o arquivo .env e substitua:');
    console.log('   GROQ_API_KEY=gsk_sua_chave_aqui_exemplo');
    console.log('   por uma chave real da Groq');
  }
} else {
  console.log('📝 Criando arquivo .env a partir do env.example...');
  
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ Arquivo .env criado!');
    console.log('📝 Edite o arquivo .env e configure sua GROQ_API_KEY');
  } else {
    console.log('❌ Arquivo env.example não encontrado');
  }
}

console.log('\n🔗 **Como obter sua GROQ API Key:**');
console.log('1. Acesse: https://console.groq.com/keys');
console.log('2. Faça login ou crie uma conta');
console.log('3. Clique em "Create API Key"');
console.log('4. Copie a chave gerada');
console.log('5. Cole no arquivo .env substituindo "gsk_sua_chave_aqui_exemplo"');

console.log('\n🚀 **Depois de configurar:**');
console.log('npm run start:whatsapp');

console.log('\n💡 **Alternativa temporária (Windows):**');
console.log('set GROQ_API_KEY=sua_chave && npm run start:whatsapp');

console.log('\n💡 **Alternativa temporária (Linux/Mac):**');
console.log('GROQ_API_KEY=sua_chave npm run start:whatsapp');

// Verifica se a chave está definida agora
require('dotenv').config();
const apiKey = process.env.GROQ_API_KEY;
const isValidKey = apiKey && 
                   apiKey !== 'gsk_sua_chave_aqui_exemplo' && 
                   apiKey !== 'sua_chave_aqui' &&
                   apiKey.startsWith('gsk_') &&
                   apiKey.length > 30;

if (isValidKey) {
  console.log('\n✅ GROQ_API_KEY detectada e parece válida!');
  console.log(`📏 Comprimento: ${apiKey.length} caracteres`);
} else {
  console.log('\n⚠️  GROQ_API_KEY ainda não está configurada corretamente');
  if (apiKey) {
    console.log(`📏 Chave atual: ${apiKey.substring(0, 10)}... (${apiKey.length} caracteres)`);
    if (!apiKey.startsWith('gsk_')) {
      console.log('❌ Chave deve começar com "gsk_"');
    }
    if (apiKey.length <= 30) {
      console.log('❌ Chave parece muito curta (deve ter mais de 30 caracteres)');
    }
  }
}
