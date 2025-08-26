const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Database = require('../database/database');
const config = require('../config/config');

class APIServer {
  constructor(database, whatsappClient = null) {
    this.app = express();
    this.database = database || new Database();
    this.whatsappClient = whatsappClient; // Pode ser null
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Segurança
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' ? config.company.website : '*'
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutos
      max: 100 // limite de 100 requests por IP
    });
    this.app.use(limiter);

    // Parsing JSON
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Rota de saúde
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Evolux Agent API',
        version: '2.0.0',
        environment: process.env.RENDER ? 'render' : 'local',
        features: {
          whatsapp: this.whatsappClient !== null,
          database: true,
          api: true
        }
      });
    });

    // Rota de status do WhatsApp
    this.app.get('/whatsapp/status', (req, res) => {
      if (!this.whatsappClient) {
        return res.json({
          connected: false,
          available: false,
          reason: 'WhatsApp desabilitado temporariamente',
          message: 'O sistema está funcionando apenas com API e Dashboard.',
          timestamp: new Date().toISOString()
        });
      }
      
      const isConnected = this.whatsappClient.isConnected();
      const status = {
        connected: isConnected,
        available: true,
        details: {
          hasClient: !!this.whatsappClient.client,
          hasPupPage: !!this.whatsappClient.client?.pupPage,
          isReady: this.whatsappClient.isReady,
          qrCodeAvailable: !!this.whatsappClient.qrCode
        },
        timestamp: new Date().toISOString()
      };
      
      if (!isConnected) {
        status.reason = 'WhatsApp não está completamente inicializado';
        status.message = 'Tente gerar um novo QR Code para conectar.';
      }
      
      res.json(status);
    });

    // Rota para gerar QR Code do WhatsApp
    this.app.get('/whatsapp/qrcode', async (req, res) => {
      const requestId = Math.random().toString(36).substring(7);
      const startTime = Date.now();
      
      try {
        console.log(`🔍 [${requestId}] Requisição QR Code recebida`, {
          timestamp: new Date().toISOString(),
          hasWhatsappClient: !!this.whatsappClient,
          clientType: this.whatsappClient ? this.whatsappClient.constructor.name : 'null',
          userAgent: req.get('User-Agent')?.substring(0, 50) || 'não fornecido'
        });

        if (!this.whatsappClient) {
          console.log(`❌ [${requestId}] WhatsApp client não disponível`, {
            whatsappClient: this.whatsappClient,
            nodeEnv: process.env.NODE_ENV || 'development',
            isRender: !!process.env.RENDER,
            enableWhatsApp: process.env.ENABLE_WHATSAPP !== 'false'
          });
          
          return res.json({
            success: false,
            error: 'WhatsApp não disponível',
            message: 'O WhatsApp está desabilitado temporariamente. O sistema está funcionando apenas com API e Dashboard.',
            available: false,
            debug: {
              hasClient: false,
              timestamp: new Date().toISOString(),
              requestId: requestId
            }
          });
        }

        console.log(`🔧 [${requestId}] WhatsApp client disponível, verificando estado`, {
          isConnected: this.whatsappClient.isConnected ? this.whatsappClient.isConnected() : 'método não disponível',
          isReady: this.whatsappClient.isReady,
          hasClient: !!this.whatsappClient.client,
          hasPupPage: !!this.whatsappClient.client?.pupPage,
          qrCodeExists: !!this.whatsappClient.qrCode,
          isInitializing: this.whatsappClient.isInitializing
        });

        console.log(`🚀 [${requestId}] Chamando generateQRCode()...`);
        const qrCode = await this.whatsappClient.generateQRCode();
        
        const duration = Date.now() - startTime;
        
        if (qrCode) {
          console.log(`✅ [${requestId}] QR Code gerado com sucesso`, {
            qrCodeLength: qrCode.length,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
          });
          
          res.json({
            success: true,
            data: {
              qrCode: qrCode,
              message: 'QR Code gerado com sucesso. Escaneie com o WhatsApp.',
              timestamp: new Date().toISOString(),
              requestId: requestId,
              duration: duration
            }
          });
        } else {
          console.log(`⚠️ [${requestId}] QR Code não foi gerado`, {
            qrCodeResult: qrCode,
            clientState: {
              isConnected: this.whatsappClient.isConnected ? this.whatsappClient.isConnected() : 'método não disponível',
              isReady: this.whatsappClient.isReady,
              qrCodeExists: !!this.whatsappClient.qrCode
            },
            duration: `${duration}ms`
          });
          
          res.json({
            success: false,
            error: 'Não foi possível gerar QR Code. WhatsApp pode estar conectado.',
            debug: {
              qrCodeResult: qrCode,
              clientConnected: this.whatsappClient.isConnected ? this.whatsappClient.isConnected() : false,
              timestamp: new Date().toISOString(),
              requestId: requestId,
              duration: duration
            }
          });
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ [${requestId}] Erro crítico ao gerar QR Code:`, error);
        console.error(`📋 [${requestId}] Detalhes completos do erro:`, {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 10),
          duration: `${duration}ms`,
          clientState: this.whatsappClient ? {
            hasClient: !!this.whatsappClient.client,
            isReady: this.whatsappClient.isReady,
            isInitializing: this.whatsappClient.isInitializing
          } : 'cliente não disponível',
          timestamp: new Date().toISOString()
        });
        
        res.status(500).json({ 
          success: false, 
          error: 'Erro interno do servidor ao gerar QR Code',
          debug: {
            message: error.message,
            requestId: requestId,
            duration: duration,
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    // Rota para forçar desconexão do WhatsApp
    this.app.post('/whatsapp/disconnect', async (req, res) => {
      try {
        if (!this.whatsappClient) {
          return res.status(500).json({ 
            success: false, 
            error: 'Cliente WhatsApp não inicializado' 
          });
        }

        const result = await this.whatsappClient.forceDisconnect();
        
        if (result) {
          res.json({
            success: true,
            message: 'WhatsApp desconectado com sucesso. Novo QR Code será gerado.'
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Erro ao desconectar WhatsApp'
          });
        }
      } catch (error) {
        console.error('Erro ao desconectar WhatsApp:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Erro ao desconectar WhatsApp' 
        });
      }
    });

    // Rota para enviar mensagem manual
    this.app.post('/whatsapp/send', async (req, res) => {
      try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber || !message) {
          return res.status(400).json({
            success: false,
            error: 'Número de telefone e mensagem são obrigatórios'
          });
        }

        if (!this.whatsappClient || !this.whatsappClient.isConnected()) {
          return res.status(503).json({
            success: false,
            error: 'Cliente WhatsApp não está conectado'
          });
        }

        await this.whatsappClient.sendMessage(phoneNumber, message);
        
        res.json({
          success: true,
          message: 'Mensagem enviada com sucesso'
        });
      } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({
          success: false,
          error: 'Erro interno do servidor'
        });
      }
    });

    // Rota para assumir controle manual
    this.app.post('/whatsapp/take-control', async (req, res) => {
      try {
        const { phoneNumber, agentId = 'human' } = req.body;
        
        if (!phoneNumber) {
          return res.status(400).json({
            success: false,
            error: 'Número de telefone é obrigatório'
          });
        }

        if (!this.whatsappClient || !this.whatsappClient.isConnected()) {
          return res.status(503).json({
            success: false,
            error: 'Cliente WhatsApp não está conectado'
          });
        }

        const result = await this.whatsappClient.enableManualControl(phoneNumber, agentId);
        
        if (result) {
          res.json({
            success: true,
            message: `Controle manual assumido para ${phoneNumber}`,
            data: {
              phoneNumber,
              agentId,
              takenAt: new Date().toISOString()
            }
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Erro ao assumir controle manual'
          });
        }
      } catch (error) {
        console.error('Erro ao assumir controle:', error);
        res.status(500).json({
          success: false,
          error: 'Erro interno do servidor'
        });
      }
    });

    // Rota para liberar controle manual e finalizar conversa
    this.app.post('/whatsapp/release-control', async (req, res) => {
      try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
          return res.status(400).json({
            success: false,
            error: 'Número de telefone é obrigatório'
          });
        }

        if (!this.whatsappClient || !this.whatsappClient.isConnected()) {
          return res.status(503).json({
            success: false,
            error: 'Cliente WhatsApp não está conectado'
          });
        }

        // Libera o controle manual e finaliza a conversa
        const result = await this.whatsappClient.releaseControlAndFinalize(phoneNumber);
        
        if (result.success) {
          res.json({
            success: true,
            message: `Conversa finalizada para ${phoneNumber}`,
            data: {
              phoneNumber,
              finalizedAt: new Date().toISOString(),
              finalMessage: result.finalMessage
            }
          });
        } else {
          res.status(500).json({
            success: false,
            error: result.error || 'Erro ao finalizar conversa'
          });
        }
      } catch (error) {
        console.error('Erro ao finalizar conversa:', error);
        res.status(500).json({
          success: false,
          error: 'Erro interno do servidor'
        });
      }
    });

    // Rota para verificar status de controle
    this.app.get('/whatsapp/control-status/:phoneNumber', async (req, res) => {
      try {
        const { phoneNumber } = req.params;
        
        if (!this.whatsappClient) {
          return res.json({
            success: true,
            data: {
              phoneNumber,
              isManualControl: false,
              manualInfo: null
            }
          });
        }

        const status = await this.whatsappClient.getManualControlStatus(phoneNumber);
        
        res.json({
          success: true,
          data: {
            phoneNumber,
            isManualControl: status.enabled,
            manualInfo: status.enabled ? {
              agentId: status.agentId,
              takenAt: status.takenAt
            } : null
          }
        });
      } catch (error) {
        console.error('Erro ao verificar status de controle:', error);
        res.status(500).json({ success: false, error: 'Erro ao verificar status' });
      }
    });

    // Rota para marcar primeira mensagem como tratada
    this.app.post('/whatsapp/first-message-handled', async (req, res) => {
      try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
          return res.status(400).json({
            success: false,
            error: 'Número de telefone é obrigatório'
          });
        }

        if (!this.whatsappClient || !this.whatsappClient.isConnected()) {
          return res.status(503).json({
            success: false,
            error: 'Cliente WhatsApp não está conectado'
          });
        }

        const result = await this.whatsappClient.markFirstMessageHandled(phoneNumber);
        
        if (result) {
          res.json({
            success: true,
            message: `Primeira mensagem marcada como tratada para ${phoneNumber}`,
            data: {
              phoneNumber,
              handledAt: new Date().toISOString()
            }
          });
        } else {
          res.status(500).json({
            success: false,
            error: 'Erro ao marcar primeira mensagem como tratada'
          });
        }
      } catch (error) {
        console.error('Erro ao marcar primeira mensagem:', error);
        res.status(500).json({
          success: false,
          error: 'Erro interno do servidor'
        });
      }
    });

    // Rota para verificar se é primeira mensagem
    this.app.get('/whatsapp/first-message-status/:phoneNumber', async (req, res) => {
      try {
        const { phoneNumber } = req.params;
        
        if (!this.whatsappClient) {
          return res.json({
            success: true,
            data: {
              phoneNumber,
              isFirstMessage: false
            }
          });
        }

        const isFirstMessage = await this.database.isFirstMessage(phoneNumber);
        
        res.json({
          success: true,
          data: {
            phoneNumber,
            isFirstMessage
          }
        });
      } catch (error) {
        console.error('Erro ao verificar primeira mensagem:', error);
        res.status(500).json({ success: false, error: 'Erro ao verificar primeira mensagem' });
      }
    });

    // Rotas para vagas
    this.app.get('/jobs', async (req, res) => {
      try {
        const jobs = await this.database.getActiveJobs();
        res.json({
          success: true,
          data: jobs,
          count: jobs.length
        });
      } catch (error) {
        console.error('Erro ao buscar vagas:', error);
        res.status(500).json({
          success: false,
          error: 'Erro interno do servidor'
        });
      }
    });

    this.app.post('/jobs', async (req, res) => {
      try {
        const jobData = req.body;
        const jobId = await this.database.createJob(jobData);
        res.json({
          success: true,
          data: { id: jobId, ...jobData }
        });
      } catch (error) {
        console.error('Erro ao criar vaga:', error);
        res.status(500).json({
          success: false,
          error: 'Erro interno do servidor'
        });
      }
    });

    // Rotas para candidatos
    this.app.get('/candidates', async (req, res) => {
      try {
        const candidates = await this.database.getCandidates();
        res.json({
          success: true,
          data: candidates,
          count: candidates.length
        });
      } catch (error) {
        console.error('Erro ao buscar candidatos:', error);
        res.status(500).json({
          success: false,
          error: 'Erro interno do servidor'
        });
      }
    });

    // Rotas para conversas
    this.app.get('/conversations', async (req, res) => {
      try {
        const conversations = await this.database.getConversations();
        res.json({
          success: true,
          data: conversations,
          count: conversations.length
        });
      } catch (error) {
        console.error('Erro ao buscar conversas:', error);
        res.status(500).json({
          success: false,
          error: 'Erro interno do servidor'
        });
      }
    });

    // Endpoints para notificações
    this.app.get('/notifications/companies', async (req, res) => {
      try {
        const notifications = await this.database.getNotifications('company');
        res.json({ success: true, data: notifications });
      } catch (error) {
        console.error('Erro ao buscar notificações de empresas:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
      }
    });

    this.app.get('/notifications/others', async (req, res) => {
      try {
        const notifications = await this.database.getNotifications('other');
        res.json({ success: true, data: notifications });
      } catch (error) {
        console.error('Erro ao buscar outras notificações:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
      }
    });

    this.app.get('/notifications/candidates', async (req, res) => {
      try {
        const notifications = await this.database.getNotifications('candidate');
        res.json({ success: true, data: notifications });
      } catch (error) {
        console.error('Erro ao buscar notificações de candidatos:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
      }
    });

    this.app.get('/notifications/all', async (req, res) => {
      try {
        const notifications = await this.database.getNotifications();
        res.json({ success: true, data: notifications });
      } catch (error) {
        console.error('Erro ao buscar todas as notificações:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
      }
    });

    this.app.post('/notifications/read', async (req, res) => {
      try {
        const { notificationId } = req.body;
        await this.database.markNotificationAsRead(notificationId);
        res.json({ success: true, message: 'Notificação marcada como lida' });
      } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
      }
    });

    // Endpoints para mensagens de empresas
    this.app.get('/company-messages', async (req, res) => {
      try {
        const { phoneNumber, status } = req.query;
        const messages = await this.database.getCompanyMessages(phoneNumber, status);
        res.json({ success: true, data: messages });
      } catch (error) {
        console.error('Erro ao buscar mensagens de empresas:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
      }
    });

    this.app.get('/company-messages/pending', async (req, res) => {
      try {
        const messages = await this.database.getPendingCompanyMessages();
        res.json({ success: true, data: messages });
      } catch (error) {
        console.error('Erro ao buscar mensagens pendentes:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
      }
    });

    this.app.post('/company-messages/:messageId/status', async (req, res) => {
      try {
        const { messageId } = req.params;
        const { status, agentId, notes } = req.body;
        
        await this.database.updateCompanyMessageStatus(messageId, status, agentId, notes);
        res.json({ success: true, message: 'Status atualizado com sucesso' });
      } catch (error) {
        console.error('Erro ao atualizar status da mensagem:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
      }
    });

    this.app.get('/company-messages/stats', async (req, res) => {
      try {
        const stats = await this.database.getCompanyMessageStats();
        res.json({ success: true, data: stats });
      } catch (error) {
        console.error('Erro ao buscar estatísticas de mensagens:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor' });
      }
    });

    // Endpoint para chat (simulado se não houver WhatsApp)
    this.app.post('/api/chat', async (req, res) => {
      try {
        const { message, phoneNumber } = req.body;
        
        if (!message || !phoneNumber) {
          return res.status(400).json({
            success: false,
            error: 'Mensagem e número de telefone são obrigatórios'
          });
        }

        if (!this.whatsappClient) {
          // Simula resposta se não houver WhatsApp
          const response = {
            success: true,
            data: {
              message: `Mensagem recebida: "${message}"\n\nWhatsApp não disponível.\nEsta é uma resposta simulada.`,
              timestamp: new Date().toISOString(),
              phoneNumber: phoneNumber
            }
          };
          return res.json(response);
        }

        // Processa com WhatsApp se disponível
        const response = await this.whatsappClient.processMessage(phoneNumber, message);
        res.json(response);
      } catch (error) {
        console.error('Erro no chat:', error);
        res.status(500).json({
          success: false,
          error: 'Erro interno do servidor'
        });
      }
    });

    // Endpoint para informações da empresa
    this.app.get('/api/company', (req, res) => {
      res.json({
        success: true,
        data: {
          name: config.company.name,
          website: config.company.website,
          email: config.company.email,
          phone: config.whatsapp.number,
          description: 'Soluções de Recursos Humanos',
          services: [
            'Recrutamento e Seleção',
            'Gestão de RH',
            'Consultoria em RH',
            'Treinamento e Desenvolvimento'
          ]
        }
      });
    });

    // Rota para estatísticas
    this.app.get('/stats', async (req, res) => {
      try {
        const jobs = await this.database.getActiveJobs();
        
        let activeConversations = { total: 0, conversations: [], manualControl: { total: 0, conversations: [] } };
        
        if (this.whatsappClient && this.whatsappClient.isConnected()) {
          try {
            activeConversations = this.whatsappClient.getActiveConversationsStats();
          } catch (conversationError) {
            console.error('Erro ao obter estatísticas de conversas:', conversationError);
          }
        }
        
        const stats = {
          success: true,
          data: {
            activeJobs: jobs.length,
            whatsappConnected: this.whatsappClient ? this.whatsappClient.isConnected() : false,
            activeConversations: activeConversations,
            timestamp: new Date().toISOString()
          }
        };
        
        res.json(stats);
      } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({
          success: false,
          error: 'Erro interno do servidor'
        });
      }
    });

    // Rota para estatísticas de tokens Groq (monitoramento de uso)
    this.app.get('/token-stats', (req, res) => {
      try {
        if (this.whatsappClient?.groqClient) {
          const stats = this.whatsappClient.groqClient.getTokenUsageStats();
          res.json({
            success: true,
            data: {
              ...stats,
              timestamp: new Date().toISOString(),
              isOptimized: true
            }
          });
        } else {
          res.json({
            success: false,
            error: 'GroqClient não disponível',
            data: {
              totalCalls: 0,
              totalTokens: 0,
              cacheHits: 0,
              cacheMisses: 0,
              cacheHitRate: 0,
              cacheSize: 0
            }
          });
        }
      } catch (error) {
        console.error('Erro ao obter estatísticas de tokens:', error);
        res.status(500).json({
          success: false,
          error: 'Erro interno'
        });
      }
    });

    // Middleware para rotas não encontradas
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Rota não encontrada',
        availableRoutes: [
          'GET /health',
          'GET /whatsapp/status',
          'GET /whatsapp/qrcode',
          'POST /whatsapp/disconnect',
          'POST /whatsapp/send',
          'POST /whatsapp/take-control',
          'POST /whatsapp/release-control',
          'GET /whatsapp/control-status/:phoneNumber',
          'GET /jobs',
          'POST /jobs',
          'GET /candidates',
          'GET /conversations',
          'GET /notifications/companies',
          'GET /notifications/others',
          'GET /notifications/candidates',
          'GET /notifications/all',
          'POST /notifications/read',
          'GET /company-messages',
          'GET /company-messages/pending',
          'POST /company-messages/:messageId/status',
          'GET /company-messages/stats',
          'POST /api/chat',
          'GET /api/company',
          'GET /stats',
          'GET /token-stats'
        ]
      });
    });
  }

  // Método para definir o cliente WhatsApp (opcional)
  setWhatsAppClient(whatsappClient) {
    this.whatsappClient = whatsappClient;
  }

  // Método para obter a aplicação Express
  getApp() {
    return this.app;
  }
}

module.exports = APIServer;
