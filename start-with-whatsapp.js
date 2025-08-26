#!/usr/bin/env node

// Define as variáveis de ambiente necessárias
process.env.ENABLE_WHATSAPP = 'true';
process.env.NODE_ENV = 'development';

// Verifica se GROQ_API_KEY está definida
if (!process.env.GROQ_API_KEY) {
  console.log('⚠️  ATENÇÃO: GROQ_API_KEY não está definida!');
  console.log('📝 Para definir a API key:');
  console.log('   Windows: set GROQ_API_KEY=sua_chave_aqui && npm run start:whatsapp');
  console.log('   Linux/Mac: GROQ_API_KEY=sua_chave_aqui npm run start:whatsapp');
  console.log('   Ou crie um arquivo .env com: GROQ_API_KEY=sua_chave_aqui');
  console.log('');
}

console.log('🚀 Iniciando servidor com WhatsApp habilitado...');
console.log('📋 Variáveis definidas:', {
  ENABLE_WHATSAPP: process.env.ENABLE_WHATSAPP,
  NODE_ENV: process.env.NODE_ENV,
  RENDER: process.env.RENDER || 'undefined',
  GROQ_API_KEY: process.env.GROQ_API_KEY ? '✅ Definida' : '❌ Não definida'
});

// Carrega o servidor principal
require('./src/index.js');
