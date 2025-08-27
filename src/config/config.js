require('dotenv').config();

module.exports = {
  groq: {
    apiKey: process.env.GROQ_API_KEY || '', // Chave padrão para desenvolvimento
    model: 'llama3-8b-8192'
  },
  
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_ANON_KEY || ''
  },
  
  company: {
    name: 'Evolux Soluções de RH',
    website: 'https://evoluxrh.com.br',
    email: 'contato@evoluxrh.com.br',
    registrationLink: 'https://app.pipefy.com/public/form/a19wdDh_'
  },
  
  server: {
    port: process.env.PORT || 3000
  },
  
  dashboard: {
    port: process.env.DASHBOARD_PORT || 3003,
    token: process.env.DASHBOARD_TOKEN || ''
  },
  
  conversation: {
    maxHistory: 10,
    responseTimeout: 30000,
    timeoutDuration: 600000, // 10 minutos
    // Configuração para controlar quando a IA responde
    // true = só responde quando recebe mensagem (quando alguém te chama)
    // false = responde sempre (incluindo quando você chama alguém)
    onlyRespondToIncoming: true
  },
  
  jobs: {
    // Configurações para verificação de vagas ativas
    maxAgeDays: 90, // Vagas com mais de 90 dias são consideradas inativas (se não tiverem data de expiração)
    cacheDuration: 300000, // 5 minutos em cache
    requireActiveStatus: true, // Sempre verificar se a vaga está ativa
    showExpirationDate: true, // Mostrar data de expiração nas vagas
    autoRefresh: true // Atualizar automaticamente o cache de vagas
  },
  
  database: {
    path: './database/evolux_agent.db'
  },
  
  whatsapp: {
    number: process.env.WHATSAPP_NUMBER || '5511999999999',
    headless: process.env.WHATSAPP_HEADLESS ? process.env.WHATSAPP_HEADLESS !== 'false' : true,
    // Usar Chrome embutido do Puppeteer se não houver caminho específico configurado
    executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || null
  }
};

// Função para detectar automaticamente o caminho do Chrome
function getChromePath() {
  if (process.platform === 'win32') {
    // Windows
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ];
    
    for (const path of possiblePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(path)) {
          return path;
        }
      } catch (error) {
        // Ignora erros de verificação
      }
    }
  } else if (process.platform === 'linux') {
    // Linux - verifica se o Chrome está instalado
    const possiblePaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium'
    ];
    
    for (const path of possiblePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(path)) {
          console.log('🔍 Chrome detectado em:', path);
          return path;
        }
      } catch (error) {
        // Ignora erros de verificação
      }
    }
  }
  return null;
}
