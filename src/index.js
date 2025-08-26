// Carrega variáveis de ambiente primeiro
require('dotenv').config();

// Debug das variáveis de ambiente
console.log('🔧 Variáveis de ambiente carregadas:', {
  NODE_ENV: process.env.NODE_ENV || 'undefined',
  ENABLE_WHATSAPP: process.env.ENABLE_WHATSAPP || 'undefined',
  RENDER: process.env.RENDER || 'undefined',
  hasEnvFile: require('fs').existsSync('.env')
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/config');

// Importa os serviços
const Database = require('./database/database');
const GroqClient = require('./ai/groqClient');
const APIServer = require('./api/server');
const DashboardServer = require('./web/dashboard');

// Importa monitoramento
const healthMonitor = require('./utils/healthMonitor');
const { logError, logPerformance } = require('./utils/logger');

// Detecta se está em ambiente Render
const isRender = process.env.RENDER || process.env.NODE_ENV === 'production';

// Configuração do WhatsApp - pode ser controlada via variável de ambiente
const enableWhatsApp = process.env.ENABLE_WHATSAPP !== 'false'; // padrão true, false apenas se explicitamente definido

// Importa WhatsApp apenas se estiver habilitado
let WhatsAppClientSimple = null;
console.log('🔍 Condições para importar WhatsApp:', {
  isRender: isRender,
  enableWhatsApp: enableWhatsApp,
  shouldImport: !isRender && enableWhatsApp
});

if (!isRender && enableWhatsApp) {
  try {
    console.log('📦 Tentando importar WhatsAppClientSimple...');
    WhatsAppClientSimple = require('./whatsapp/whatsappClientSimple');
    console.log('✅ WhatsAppClientSimple importado com sucesso');
  } catch (error) {
    console.log('⚠️ WhatsApp não disponível:', error.message);
    console.error('📋 Erro detalhado na importação:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    });
  }
} else {
  console.log('🚫 Não importando WhatsApp devido às condições');
}

const app = express();

// Middleware de segurança
app.use(helmet({
  contentSecurityPolicy: false // Necessário para o dashboard
}));
app.use(cors());
app.use(express.json());

// Rate limiting mais permissivo para o dashboard
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500, // Aumentado de 100 para 500
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Pula rate limiting para health checks
    return req.path === '/health';
  }
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Evolux Agent',
    version: '2.0.0',
    environment: isRender ? 'render' : 'local',
    nodeVersion: process.version,
    features: {
      api: true,
      dashboard: true,
      whatsapp: enableWhatsApp && !isRender && WhatsAppClientSimple !== null,
      reason: enableWhatsApp ? 'WhatsApp disponível localmente' : 'WhatsApp desabilitado temporariamente'
    }
  });
});

// Variável global para tracking de tempo de inicialização
let systemStartTime = Date.now();

// Inicialização dos serviços
async function initializeServices() {
  try {
    systemStartTime = Date.now();
    
    console.log(`🚀 Iniciando Evolux Agent (${isRender ? 'Render' : 'Local'})...`);
    console.log(`📦 Node.js version: ${process.version}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📱 WhatsApp: ${enableWhatsApp ? 'Habilitado' : 'Desabilitado'}`);
    
    // Inicia monitoramento de saúde
    healthMonitor.start();
    console.log('✅ Monitoramento de saúde iniciado');
    
    // Inicializa banco de dados
    const database = new Database();
    console.log('✅ Banco de dados inicializado');
    
    // Inicializa cliente Groq
    const groqClient = new GroqClient();
    console.log('✅ Cliente Groq inicializado');
    
    // Cria instância do WhatsApp (mesmo antes de inicializar) para já disponibilizar rotas
    let whatsappClient = null;
    console.log('🔍 Verificando condições para criar instância WhatsApp:', {
      enableWhatsApp: enableWhatsApp,
      isRender: isRender,
      hasWhatsAppClientSimple: !!WhatsAppClientSimple,
      willCreateClient: enableWhatsApp && !isRender && WhatsAppClientSimple
    });
    
    if (enableWhatsApp && !isRender && WhatsAppClientSimple) {
      try {
        console.log('🔧 Criando instância WhatsApp...', {
          enableWhatsApp: enableWhatsApp,
          isRender: isRender,
          hasWhatsAppClientSimple: !!WhatsAppClientSimple,
          nodeEnv: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        });
        
        whatsappClient = new WhatsAppClientSimple();
        console.log('🧩 Instância WhatsApp criada (pré-inicialização)', {
          clientType: whatsappClient.constructor.name,
          hasClient: !!whatsappClient.client,
          isReady: whatsappClient.isReady,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.log('⚠️ Falha ao criar instância WhatsApp:', error.message);
        console.error('📋 Detalhes do erro de criação da instância:', {
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5),
          enableWhatsApp: enableWhatsApp,
          isRender: isRender,
          timestamp: new Date().toISOString()
        });
        whatsappClient = null;
      }
    } else {
      console.log('🚫 WhatsApp não será inicializado', {
        enableWhatsApp: enableWhatsApp,
        isRender: isRender,
        hasWhatsAppClientSimple: !!WhatsAppClientSimple,
        reasons: {
          whatsappDisabled: !enableWhatsApp,
          renderEnvironment: isRender,
          clientUnavailable: !WhatsAppClientSimple
        }
      });
    }

    // Inicializa servidor da API já com a instância (pode estar não pronta ainda)
    console.log('🔗 Passando cliente para APIServer:', {
      whatsappClientExists: !!whatsappClient,
      whatsappClientType: whatsappClient ? whatsappClient.constructor.name : 'null'
    });
    const apiServer = new APIServer(database, whatsappClient);
    console.log('✅ Servidor API inicializado com cliente:', !!apiServer.whatsappClient);
    
    // Monta as rotas da API no servidor principal
    app.use('/', apiServer.getApp());
    
    // Inicializa servidor do dashboard já com a mesma instância
    const dashboardServer = new DashboardServer(database, whatsappClient);
    console.log('✅ Servidor Dashboard inicializado');
    
    // Inicia o dashboard imediatamente
    dashboardServer.start();
    
    // Inicializa WhatsApp se habilitado (de forma assíncrona)
    if (whatsappClient) {
      console.log('🔄 Inicializando WhatsApp em background...');
      console.log('📋 Configuração de inicialização:', {
        timeoutSeconds: 240,
        hasClient: !!whatsappClient.client,
        clientReady: whatsappClient.isReady,
        timestamp: new Date().toISOString()
      });
      
      // Inicializa WhatsApp de forma assíncrona
      (async () => {
        const initStartTime = Date.now();
        try {
          console.log('🚀 Iniciando processo de inicialização do WhatsApp...');
          
          // Timeout estendido para 240 segundos para inicialização do WhatsApp
          const whatsappPromise = whatsappClient.initialize();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('WhatsApp timeout - 240 segundos')), 240000)
          );
          
          await Promise.race([whatsappPromise, timeoutPromise]);
          
          const initTime = Math.floor((Date.now() - initStartTime) / 1000);
          console.log(`✅ Cliente WhatsApp inicializado com sucesso em ${initTime}s!`);
          console.log('📋 Estado pós-inicialização:', {
            isReady: whatsappClient.isReady,
            hasClient: !!whatsappClient.client,
            hasPupPage: !!whatsappClient.client?.pupPage,
            qrCodeExists: !!whatsappClient.qrCode,
            initTimeSeconds: initTime,
            timestamp: new Date().toISOString()
          });
          
          // Garante que os servidores possuem a referência da instância
          console.log('🔗 Atualizando referências nos servidores...');
          apiServer.setWhatsAppClient(whatsappClient);
          dashboardServer.setWhatsAppClient(whatsappClient);
          console.log('✅ Servidores atualizados com cliente WhatsApp');
          
        } catch (error) {
          const initTime = Math.floor((Date.now() - initStartTime) / 1000);
          console.error(`❌ Erro ao inicializar WhatsApp após ${initTime}s:`, error.message);
          console.error('📋 Detalhes completos do erro de inicialização:', {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n').slice(0, 8),
            initTimeSeconds: initTime,
            clientState: {
              hasClient: !!whatsappClient.client,
              isReady: whatsappClient.isReady,
              qrCodeExists: !!whatsappClient.qrCode
            },
            timestamp: new Date().toISOString()
          });
          
          if ((error.message || '').includes('WhatsApp timeout')) {
            console.log('⏳ Inicialização do WhatsApp continua em background; tente gerar o QR novamente.');
            console.log('📋 Mantendo cliente nos servidores para tentativas futuras');
          } else {
            console.log('⚠️ Sistema continuará funcionando sem WhatsApp');
            console.log('🔧 Removendo cliente WhatsApp dos servidores devido ao erro...');
            apiServer.setWhatsAppClient(null);
            dashboardServer.setWhatsAppClient(null);
          }
        }
      })();
    } else {
      console.log('⚠️ WhatsApp não disponível neste ambiente');
      console.log('📋 Razões para não usar WhatsApp:', {
        enableWhatsApp: enableWhatsApp,
        isRender: isRender,
        hasWhatsAppClientSimple: !!WhatsAppClientSimple,
        timestamp: new Date().toISOString()
      });
    }
    
    const endTime = Date.now();
    const initializationTime = endTime - systemStartTime;
    
    console.log('🎉 Serviços inicializados com sucesso!');
    console.log(`⏱️ Tempo de inicialização: ${initializationTime}ms`);
    console.log(`📊 Dashboard: http://localhost:${config.dashboard.port}`);
    console.log(`🔗 API: http://localhost:${config.server.port}`);
    console.log(`✅ Health: http://localhost:${config.server.port}/health`);
    
    // Log de performance
    logPerformance('system_initialization', initializationTime, {
      environment: isRender ? 'render' : 'local',
      whatsappEnabled: enableWhatsApp
    });
    
    if (whatsappClient) {
      console.log('📱 WhatsApp conectado e funcionando');
    } else {
      console.log('⚠️ Sistema funcionando sem WhatsApp');
    }
    
  } catch (error) {
    console.error('❌ Erro ao inicializar serviços:', error);
    console.error('Stack trace:', error.stack);
    
    // Log do erro
    logError(error, { context: 'initializeServices' });
    
    // Para monitoramento antes de sair
    healthMonitor.stop();
    
    process.exit(1);
  }
}

// Inicializa serviços
initializeServices();

// Middleware de erro
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  
  // Log do erro
  logError(err, { 
    context: 'express_middleware',
    url: req.url,
    method: req.method,
    ip: req.ip
  });
  
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: err.message 
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor principal rodando na porta ${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Ambiente: ${isRender ? 'Render (API + Dashboard)' : 'Local (API + Dashboard)'}`);
  console.log(`📱 WhatsApp: ${enableWhatsApp ? 'Habilitado' : 'Desabilitado'}`);
  
  // Log de inicialização do servidor
  logPerformance('server_startup', Date.now() - systemStartTime, {
    port: PORT,
    environment: isRender ? 'render' : 'local'
  });
});

module.exports = app;