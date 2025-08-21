#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Detectando caminho do Chrome no Windows...\n');

// Caminhos possíveis do Chrome no Windows
const possiblePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome Beta\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome Beta\\Application\\chrome.exe',
  'C:\\Program Files\\Chromium\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe',
  'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Chromium\\Application\\chrome.exe'
];

console.log('📋 Verificando caminhos possíveis:\n');

let foundChrome = false;

for (const chromePath of possiblePaths) {
  try {
    if (fs.existsSync(chromePath)) {
      console.log(`✅ Chrome encontrado: ${chromePath}`);
      foundChrome = true;
      
      // Verifica se é executável
      try {
        fs.accessSync(chromePath, fs.constants.X_OK);
        console.log(`   ✅ Arquivo é executável`);
      } catch (error) {
        console.log(`   ⚠️  Arquivo pode não ser executável`);
      }
      
      // Obtém informações do arquivo
      const stats = fs.statSync(chromePath);
      console.log(`   📅 Última modificação: ${stats.mtime}`);
      console.log(`   📏 Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      console.log('\n🔧 Para usar este caminho, adicione ao seu arquivo .env:');
      console.log(`CHROME_PATH="${chromePath}"`);
      console.log('\nOu execute:');
      console.log(`set CHROME_PATH="${chromePath}"`);
      
      break;
    } else {
      console.log(`❌ Não encontrado: ${chromePath}`);
    }
  } catch (error) {
    console.log(`❌ Erro ao verificar: ${chromePath} - ${error.message}`);
  }
}

if (!foundChrome) {
  console.log('\n❌ Chrome não foi encontrado nos caminhos padrão.');
  console.log('\n🔧 Soluções possíveis:');
  console.log('1. Instale o Google Chrome');
  console.log('2. Instale o Chromium');
  console.log('3. Configure manualmente o caminho no arquivo .env');
  console.log('4. Use o Puppeteer com Chrome embutido (recomendado)');
  
  console.log('\n📝 Para usar o Puppeteer com Chrome embutido, execute:');
  console.log('npm install puppeteer');
  console.log('E remova a configuração CHROME_PATH do .env');
}

console.log('\n🔍 Verificando variáveis de ambiente:');
console.log(`LOCALAPPDATA: ${process.env.LOCALAPPDATA || 'Não definido'}`);
console.log(`USERNAME: ${process.env.USERNAME || 'Não definido'}`);
console.log(`CHROME_PATH: ${process.env.CHROME_PATH || 'Não definido'}`);
console.log(`PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'Não definido'}`);

console.log('\n🎯 Recomendação:');
console.log('Se você não conseguir encontrar o Chrome, recomendo usar o Puppeteer com Chrome embutido:');
console.log('1. npm install puppeteer');
console.log('2. Remova CHROME_PATH do .env');
console.log('3. O Puppeteer baixará automaticamente o Chrome necessário');
