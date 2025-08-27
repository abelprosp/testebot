const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const Database = require('../database/database');
const GroqClient = require('../ai/groqClient');
const BusinessHoursService = require('../services/businessHoursService');
const config = require('../config/config');

class WhatsAppClientSimple {
  constructor() {
    // Configurações otimizadas do Puppeteer
    const puppeteerConfig = {
      headless: config.whatsapp.headless,
      executablePath: getChromeExecutablePath(),
      defaultViewport: null,
      // Configurações específicas para Linux
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-default-browser-check',
        '--disable-web-security',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--allow-running-insecure-content',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--no-zygote',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--memory-pressure-off',
        '--max_old_space_size=4096',
        // Configurações específicas para Linux headless
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-component-extensions-with-background-pages',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--enable-features=NetworkService,NetworkServiceLogging',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update'
      ],
      timeout: 60000, // Reduzido para 60s
      protocolTimeout: 60000
    };

    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: puppeteerConfig
    });

    this.database = new Database();
    this.groqClient = new GroqClient();
    this.isReady = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.isInitializing = false;
    this.initializePromise = null;
    this.lastHealthCheck = Date.now();
    this.healthCheckInterval = null;
    
    // Sistema de timeout otimizado
    this.activeConversations = new Map(); // phoneNumber -> { timeoutId, lastActivity }
    this.timeoutDuration = config.conversation.timeoutDuration || 120000; // 2 minutos

    // Sistema de controle manual
    this.manualControl = new Map(); // phoneNumber -> { isManual: boolean, agentId: string, takenAt: Date }

    // Sistema de retry automático
    this.autoReconnectEnabled = true;
    this.reconnectInterval = null;
    this.maxReconnectAttempts = 5;
    this.reconnectAttempts = 0;

    this.setupEventHandlers();
    this.startHealthCheck();
  }

  // Sistema de health check para detectar problemas
  startHealthCheck() {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // A cada 30 segundos
  }

  async performHealthCheck() {
    try {
      const now = Date.now();
      const timeSinceLastCheck = now - this.lastHealthCheck;
      
      // Verifica se o cliente está respondendo
      if (this.client && this.client.pupPage) {
        try {
          // Teste simples de conectividade
          await this.client.pupPage.evaluate(() => true);
          this.lastHealthCheck = now;
          this.reconnectAttempts = 0; // Reset contador de tentativas
        } catch (error) {
          console.warn('⚠️ Health check falhou:', error.message);
          this.handleConnectionIssue();
        }
      } else if (this.isReady) {
        console.warn('⚠️ Cliente marcado como pronto mas sem pupPage');
        this.handleConnectionIssue();
      }
    } catch (error) {
      console.error('❌ Erro no health check:', error);
    }
  }

  handleConnectionIssue() {
    if (this.autoReconnectEnabled && this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log(`🔄 Tentativa de reconexão ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);
      this.reconnectAttempts++;
      
      // Agenda reconexão em 10 segundos
      setTimeout(() => {
        this.attemptReconnect();
      }, 10000);
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Máximo de tentativas de reconexão atingido');
      this.autoReconnectEnabled = false;
    }
  }

  async attemptReconnect() {
    try {
      console.log('🔄 Tentando reconectar WhatsApp...');
      this.isReady = false;
      
      if (this.client) {
        await this.client.destroy();
      }
      
      // Recria o cliente
      const puppeteerConfig = {
        headless: config.whatsapp.headless,
        executablePath: config.whatsapp.executablePath || undefined,
        defaultViewport: null,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-default-browser-check',
          '--disable-web-security',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--allow-running-insecure-content',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-site-isolation-trials',
          '--no-zygote',
          '--disable-ipc-flooding-protection',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-client-side-phishing-detection',
          '--disable-component-extensions-with-background-pages',
          '--memory-pressure-off',
          '--max_old_space_size=4096'
        ],
        timeout: 60000,
        protocolTimeout: 60000
      };

      this.client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: puppeteerConfig
      });

      this.setupEventHandlers();
      await this.client.initialize();
      
      console.log('✅ Reconexão bem-sucedida!');
      this.reconnectAttempts = 0;
      
    } catch (error) {
      console.error('❌ Falha na reconexão:', error);
      this.handleConnectionIssue();
    }
  }

  setupEventHandlers() {
    // Evento quando o QR Code é gerado
    this.client.on('qr', (qr) => {
      console.log('📱 QR Code gerado pelo WhatsApp!');
      console.log('📋 Detalhes do QR Code recebido:', {
        timestamp: new Date().toISOString(),
        qrLength: qr ? qr.length : 0,
        qrPreview: qr ? qr.substring(0, 50) + '...' : 'null',
        previousQrExists: !!this.qrCode,
        clientStatus: {
          isReady: this.isReady,
          hasClient: !!this.client,
          hasPupPage: !!this.client?.pupPage,
          isInitializing: this.isInitializing
        }
      });
      
      // Salva o QR Code para uso posterior
      this.qrCode = qr;
      console.log('💾 QR Code salvo em this.qrCode');
      
      // Gera QR Code no terminal
      try {
        console.log('🖥️ Tentando gerar QR Code no terminal...');
        qrcodeTerminal.generate(qr, { small: true });
        console.log('📱 QR Code gerado no terminal com sucesso');
      } catch (error) {
        console.error('❌ Erro ao gerar QR Code no terminal:', error);
        console.error('📋 Detalhes do erro no terminal:', {
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 3),
          qrCodeValid: !!qr && qr.length > 0
        });
      }
    });

    // Evento quando o cliente está pronto
    this.client.on('ready', () => {
      console.log('✅ Cliente WhatsApp conectado e pronto!');
      console.log('📋 Estado pós-conexão:', {
        timestamp: new Date().toISOString(),
        isReady: true,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage,
        qrCodeExisted: !!this.qrCode,
        retryCount: this.retryCount,
        reconnectAttempts: this.reconnectAttempts,
        clientInfo: this.client.info || 'não disponível'
      });
      
      this.isReady = true;
      this.retryCount = 0; // Reset retry count on success
      this.reconnectAttempts = 0; // Reset reconexão
      
      // Limpa o QR Code quando conectado
      if (this.qrCode) {
        console.log('🧹 Limpando QR Code após conexão');
        console.log('📋 QR Code removido:', {
          qrCodeLength: this.qrCode.length,
          timestamp: new Date().toISOString()
        });
        this.qrCode = null;
      } else {
        console.log('📋 Nenhum QR Code para limpar');
      }
    });

    // Evento quando uma mensagem é recebida
    this.client.on('message', async (message) => {
      await this.handleMessage(message);
    });

    // Evento de autenticação
    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp autenticado com sucesso!');
      console.log('📋 Status detalhado após autenticação:', {
        timestamp: new Date().toISOString(),
        isReady: this.isReady,
        qrCode: !!this.qrCode,
        qrCodeLength: this.qrCode ? this.qrCode.length : 0,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage,
        isInitializing: this.isInitializing,
        retryCount: this.retryCount,
        reconnectAttempts: this.reconnectAttempts,
        authStrategy: this.client.authStrategy ? 'LocalAuth' : 'desconhecido'
      });
    });

    // Evento de desconexão
    this.client.on('disconnected', (reason) => {
      console.log('❌ Cliente WhatsApp desconectado:', reason);
      console.log('📋 Detalhes da desconexão:', {
        reason: reason,
        timestamp: new Date().toISOString(),
        wasReady: this.isReady,
        qrCodeExisted: !!this.qrCode,
        hasClient: !!this.client,
        retryCount: this.retryCount,
        reconnectAttempts: this.reconnectAttempts,
        autoReconnectEnabled: this.autoReconnectEnabled,
        isInitializing: this.isInitializing
      });
      
      this.isReady = false;
      
      // Tenta reconectar automaticamente
      if (this.autoReconnectEnabled) {
        console.log('🔄 Tentando reconexão automática...');
        console.log('📋 Configuração de reconexão:', {
          autoReconnectEnabled: this.autoReconnectEnabled,
          reconnectAttempts: this.reconnectAttempts,
          retryCount: this.retryCount,
          maxRetries: this.maxRetries
        });
        this.handleConnectionIssue();
      } else {
        console.log('🚫 Reconexão automática desabilitada');
      }
    });

    // Evento de loading screen
    this.client.on('loading_screen', (percent, message) => {
      console.log(`📱 Carregando WhatsApp: ${percent}% - ${message}`);
      if (percent % 20 === 0 || percent >= 90) { // Log mais detalhado a cada 20% ou nos últimos %
        console.log('📋 Detalhes do carregamento:', {
          percent: percent,
          message: message,
          timestamp: new Date().toISOString(),
          isReady: this.isReady,
          hasClient: !!this.client,
          isInitializing: this.isInitializing
        });
      }
    });

    // Evento de auth_failure
    this.client.on('auth_failure', (message) => {
      console.log('❌ Falha na autenticação WhatsApp:', message);
      console.error('📋 Detalhes da falha de autenticação:', {
        failureMessage: message,
        timestamp: new Date().toISOString(),
        isReady: this.isReady,
        qrCodeExists: !!this.qrCode,
        hasClient: !!this.client,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        isInitializing: this.isInitializing,
        authStrategy: this.client.authStrategy ? 'LocalAuth' : 'desconhecido'
      });
    });

    console.log('📱 Event handlers configurados com sucesso');
  }

  // Sistema de controle manual
  async enableManualControl(phoneNumber, agentId = 'human') {
    // Alias para takeManualControl para compatibilidade
    return await this.takeManualControl(phoneNumber, agentId);
  }

  async takeManualControl(phoneNumber, agentId = 'human') {
    try {
      // Remove timeout da conversa mas mantém na lista ativa
      if (this.activeConversations.has(phoneNumber)) {
        const { timeoutId } = this.activeConversations.get(phoneNumber);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // Mantém a conversa na lista mas sem timeout
        this.activeConversations.set(phoneNumber, {
          timeoutId: null,
          lastActivity: Date.now(),
          isManualControl: true
        });
      } else {
        // Se não estava na lista, adiciona sem timeout
        this.activeConversations.set(phoneNumber, {
          timeoutId: null,
          lastActivity: Date.now(),
          isManualControl: true
        });
      }

      // Marca conversa como controle manual
      this.manualControl.set(phoneNumber, {
        isManual: true,
        agentId: agentId,
        takenAt: new Date()
      });

      // Atualiza no banco de dados
      await this.database.updateConversationStatus(phoneNumber, 'manual_control');

      // Envia mensagem informando que o atendimento foi iniciado
      const startMessage = `👤 *Atendimento Iniciado*

Olá! Meu nome é ${agentId} e vou atendê-lo agora.

Como posso ajudá-lo hoje?

---
*Atendimento iniciado em ${new Date().toLocaleString('pt-BR')}*`;

      await this.sendMessage(phoneNumber, startMessage);
      console.log(`📤 Mensagem de início de atendimento enviada para ${phoneNumber}`);

      console.log(`👤 Controle manual assumido para ${phoneNumber} por ${agentId}`);
      
      return {
        success: true,
        message: `Controle manual assumido para ${phoneNumber}`,
        agentId: agentId,
        takenAt: new Date()
      };

    } catch (error) {
      console.error('Erro ao assumir controle manual:', error);
      return {
        success: false,
        error: 'Erro ao assumir controle manual'
      };
    }
  }

  async releaseManualControl(phoneNumber) {
    try {
      // Obtém informações do controle manual antes de remover
      const manualInfo = this.getManualControlInfo(phoneNumber);
      const agentId = manualInfo ? manualInfo.agentId : 'atendente';

      // Remove controle manual
      this.manualControl.delete(phoneNumber);

      // Atualiza no banco de dados
      await this.database.updateConversationStatus(phoneNumber, 'active');

      // Envia mensagem informando que o atendimento foi finalizado
      const finishMessage = `✅ *Atendimento Finalizado*

Obrigado por escolher a ${config.company.name}!

O atendimento foi finalizado por ${agentId}.

Se precisar de mais informações, sinta-se à vontade para enviar uma nova mensagem a qualquer momento!

Obrigado pela confiança! 🙏

---
*Atendimento finalizado em ${new Date().toLocaleString('pt-BR')}*`;

      await this.sendMessage(phoneNumber, finishMessage);
      console.log(`📤 Mensagem de finalização de atendimento enviada para ${phoneNumber}`);

      // REMOVIDO: Não reinicia automaticamente o fluxo
      // O bot deve aguardar uma nova mensagem do usuário para retomar

      console.log(`🤖 Controle manual liberado para ${phoneNumber} - aguardando nova mensagem do usuário`);
      
      return {
        success: true,
        message: `Controle manual liberado para ${phoneNumber}`,
        agentId: agentId,
        releasedAt: new Date()
      };

    } catch (error) {
      console.error('Erro ao liberar controle manual:', error);
      return {
        success: false,
        error: 'Erro ao liberar controle manual'
      };
    }
  }

  isUnderManualControl(phoneNumber) {
    return this.manualControl.has(phoneNumber);
  }

  getManualControlInfo(phoneNumber) {
    return this.manualControl.get(phoneNumber) || null;
  }

  // Gerencia o timeout da conversa
  manageConversationTimeout(phoneNumber) {
    // Cancela timeout anterior se existir
    if (this.activeConversations.has(phoneNumber)) {
      const { timeoutId } = this.activeConversations.get(phoneNumber);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    // Configura novo timeout
    const timeoutId = setTimeout(async () => {
      await this.handleConversationTimeout(phoneNumber);
    }, this.timeoutDuration);

    // Atualiza registro da conversa
    this.activeConversations.set(phoneNumber, {
      timeoutId,
      lastActivity: Date.now()
    });

    console.log(`⏰ Timeout configurado para ${phoneNumber} (${this.timeoutDuration/1000}s)`);
  }

  // Trata timeout da conversa baseado no tipo de usuário
  async handleConversationTimeout(phoneNumber) {
    try {
      // Verifica o tipo de usuário
      const conversation = await this.database.getConversation(phoneNumber);
      
      if (conversation && (conversation.user_type === 'company' || conversation.user_type === 'other')) {
        // Para empresas e outros assuntos, envia mensagem de follow-up em vez de finalizar
        await this.sendCompanyFollowUp(phoneNumber);
      } else {
        // Para candidatos, finaliza normalmente
        await this.finalizeConversation(phoneNumber);
      }
    } catch (error) {
      console.error('Erro ao tratar timeout da conversa:', error);
      // Em caso de erro, finaliza normalmente
      await this.finalizeConversation(phoneNumber);
    }
  }

  // Envia mensagem de follow-up para empresas
  async sendCompanyFollowUp(phoneNumber) {
    try {
      console.log(`🏢 Enviando follow-up para empresa ${phoneNumber}`);
      
      const followUpMessage = `⏰ *Ainda está conosco?*

Olá! Percebemos que você não interagiu conosco nos últimos minutos.

🤔 Você ainda deseja conversar com a Evolux Soluções de RH?

📞 Todos os nossos atendentes estão ocupados no momento, mas retornaremos assim que possível!

💬 Se ainda estiver interessado, responda com "sim" ou envie uma nova mensagem.

Obrigado pela paciência! 🙏

---
*Esta mensagem foi enviada automaticamente após 2 minutos de inatividade.*`;

      await this.sendMessage(phoneNumber, followUpMessage);
      
      // Configura um novo timeout mais longo para finalizar se não responder
      const finalTimeoutId = setTimeout(async () => {
        await this.finalizeConversation(phoneNumber);
      }, 600000); // 10 minutos adicionais

      // Atualiza o registro da conversa
      this.activeConversations.set(phoneNumber, {
        timeoutId: finalTimeoutId,
        lastActivity: Date.now()
      });

      console.log(`✅ Follow-up enviado para empresa ${phoneNumber}`);
      
    } catch (error) {
      console.error('Erro ao enviar follow-up para empresa:', error);
    }
  }

  // Método para liberar controle e finalizar conversa (compatibilidade)
  async releaseControlAndFinalize(phoneNumber) {
    try {
      console.log(`🔚 Finalizando conversa para ${phoneNumber}`);
      
      // Obtém informações do controle manual antes de remover
      const manualInfo = this.getManualControlInfo(phoneNumber);
      const agentId = manualInfo ? manualInfo.agentId : 'atendente';

      // Remove controle manual
      this.manualControl.delete(phoneNumber);

      // Remove da lista de conversas ativas
      this.activeConversations.delete(phoneNumber);

      // Envia mensagem de finalização definitiva
      const finalMessage = `✅ **Atendimento Finalizado**

Obrigado por escolher a ${config.company.name}!

O atendimento foi finalizado por ${agentId}.

📞 Se precisar de mais informações, sinta-se à vontade para enviar uma nova mensagem a qualquer momento!

Obrigado pela confiança! 🙏

---
*Atendimento finalizado em ${new Date().toLocaleString('pt-BR')}*`;

      await this.sendMessage(phoneNumber, finalMessage);
      
      // Salva a mensagem de finalização
      await this.saveAgentMessage(phoneNumber, finalMessage);
      
      // Desabilita controle manual no banco de dados
      await this.database.disableManualControl(phoneNumber);
      
      // Finaliza a conversa no banco de dados
      await this.database.finalizeConversation(phoneNumber);
      
      console.log(`✅ Conversa finalizada definitivamente para ${phoneNumber}`);
      
      // REMOVIDO: Não reinicia automaticamente o fluxo
      // O bot deve aguardar uma nova mensagem do usuário para retomar
      
      return {
        success: true,
        finalMessage: finalMessage,
        finalizedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erro ao finalizar conversa:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Finaliza a conversa após timeout
  async finalizeConversation(phoneNumber) {
    try {
      console.log(`⏰ Finalizando conversa com ${phoneNumber} por inatividade`);
      
      // Remove da lista de conversas ativas
      this.activeConversations.delete(phoneNumber);
      
      // Remove controle manual se existir
      this.manualControl.delete(phoneNumber);
      
      // Envia mensagem de finalização
      const finalMessage = `⏰ *Atendimento Finalizado*

Olá! Percebemos que você não interagiu conosco nos últimos minutos.

📞 Se precisar de mais informações, sinta-se à vontade para enviar uma nova mensagem a qualquer momento!

Obrigado por escolher a ${config.company.name}! 🙏

---
*Este atendimento foi finalizado automaticamente por inatividade.*`;

      await this.sendMessage(phoneNumber, finalMessage);
      
      // Marca conversa como finalizada no banco
      await this.database.finalizeConversation(phoneNumber);
      
      console.log(`✅ Conversa com ${phoneNumber} finalizada`);
      
    } catch (error) {
      console.error('Erro ao finalizar conversa:', error);
    }
  }

  // Método para obter status de controle manual (compatibilidade)
  async getManualControlStatus(phoneNumber) {
    try {
      const manualInfo = this.getManualControlInfo(phoneNumber);
      return {
        enabled: !!manualInfo,
        agentId: manualInfo ? manualInfo.agentId : null,
        takenAt: manualInfo ? manualInfo.takenAt : null
      };
    } catch (error) {
      console.error('Erro ao obter status de controle manual:', error);
      return { enabled: false, agentId: null, takenAt: null };
    }
  }

  // Verifica se a conversa foi reiniciada
  isConversationRestarted(phoneNumber) {
    if (!this.activeConversations.has(phoneNumber)) {
      return true; // Nova conversa ou reiniciada
    }
    
    const { lastActivity } = this.activeConversations.get(phoneNumber);
    const timeSinceLastActivity = Date.now() - lastActivity;
    
    // Se passou mais de 5 minutos, considera reiniciada
    return timeSinceLastActivity > 300000; // 5 minutos
  }

  async handleMessage(message) {
    try {
      // Ignora mensagens do próprio bot
      if (message.fromMe) return;

      const phoneNumber = message.from;
      const messageText = message.body;
      const messageType = message.type;

      console.log(`📱 Nova mensagem de ${phoneNumber}: ${messageText}`);

      // Verifica se a conversa foi finalizada
      const conversation = await this.database.getConversation(phoneNumber);
      if (conversation && conversation.status === 'finalized') {
        console.log(`🆕 Nova mensagem após finalização para ${phoneNumber} - criando nova conversa`);
        // Cria uma nova conversa para a nova mensagem
        await this.database.createConversation(phoneNumber, 'unknown');
        // Continua o processamento normalmente
      }

      // Intercepta imediatamente anexos/documentos reais antes de qualquer lógica
      // MAS apenas se não estiver sob controle manual
      if (!this.isUnderManualControl(phoneNumber)) {
        const mediaTypes = new Set(['image','video','ptt','audio','document','sticker','location','vcard','multi_vcard','contact_card','contact_card_multiple']);
        const isMediaMessage = !!message.hasMedia || mediaTypes.has(messageType);
        const isDocument = message.type === 'document';
        const isImage = message.type === 'image';
        const isVideo = message.type === 'video';
        const isAudio = message.type === 'audio' || message.type === 'ptt';

        // SÓ responde para anexos reais (documentos, imagens, vídeos, áudios)
        console.log(`🔍 [DEBUG] Verificando anexo:`, {
          phoneNumber,
          messageType,
          hasMedia: !!message.hasMedia,
          isMediaMessage,
          isDocument,
          isImage,
          isVideo,
          isAudio,
          messageText: messageText.substring(0, 50) + '...'
        });
        
        if (isMediaMessage || isDocument || isImage || isVideo || isAudio) {
          try {
            const registrationLink = (config.company && config.company.registrationLink) ? config.company.registrationLink : (config.company && config.company.website ? config.company.website : '');
            let whatReceived = 'um anexo';
            
            if (isDocument) whatReceived = 'um documento';
            else if (isImage) whatReceived = 'uma imagem';
            else if (isVideo) whatReceived = 'um vídeo';
            else if (isAudio) whatReceived = 'um áudio';
            
            const guidance = `📄 Recebi ${whatReceived}.

Para prosseguir com o envio de documentos/arquivos, utilize nosso formulário de cadastro:
${registrationLink}

No WhatsApp não processamos documentos diretamente. Após concluir o cadastro, nossa equipe dará continuidade ao seu atendimento.`;
            await this.sendMessage(phoneNumber, guidance);
            await this.saveAgentMessage(phoneNumber, guidance);
            return;
          } catch (earlyErr) {
            console.error('Erro ao enviar orientação inicial de anexos:', earlyErr);
          }
        }
      }

      // Verifica se é uma conversa reiniciada
      const isRestarted = this.isConversationRestarted(phoneNumber);
      if (isRestarted) {
        console.log(`🔄 Conversa retomada com ${phoneNumber} após inatividade. Mantendo histórico da sessão.`);
        // Mantemos o histórico da conversa para garantir fluidez
        // e apenas reiniciamos timers de inatividade abaixo
      }

      // Verifica se está sob controle manual
      if (this.isUnderManualControl(phoneNumber)) {
        console.log(`👤 Mensagem de ${phoneNumber} em controle manual - ignorando IA`);
        // Salva a mensagem mas não processa com IA
        await this.saveUserMessage(phoneNumber, messageText);
        return; // Não processa com IA
      }

      // Gerencia timeout da conversa
      this.manageConversationTimeout(phoneNumber);

      // Salva a mensagem do usuário
      await this.saveUserMessage(phoneNumber, messageText);

      // Detecta anexos/documentos reais e orienta cadastro
      // MAS apenas se não estiver sob controle manual
      if (!this.isUnderManualControl(phoneNumber)) {
        const isAttachment = !!message.hasMedia || (message.type && message.type !== 'chat');
        const isDocument = message.type === 'document';
        const isImage = message.type === 'image';
        const isVideo = message.type === 'video';
        const isAudio = message.type === 'audio' || message.type === 'ptt';

        // SÓ responde para anexos reais (documentos, imagens, vídeos, áudios)
        console.log(`🔍 [DEBUG] Verificando anexo (segunda verificação):`, {
          phoneNumber,
          messageType,
          hasMedia: !!message.hasMedia,
          isAttachment,
          isDocument,
          isImage,
          isVideo,
          isAudio,
          messageText: messageText.substring(0, 50) + '...'
        });
        
        if (isAttachment || isDocument || isImage || isVideo || isAudio) {
          try {
            const registrationLink = (config.company && config.company.registrationLink) ? config.company.registrationLink : (config.company && config.company.website ? config.company.website : '');
            let whatReceived = 'um anexo';
            
            if (isDocument) whatReceived = 'um documento';
            else if (isImage) whatReceived = 'uma imagem';
            else if (isVideo) whatReceived = 'um vídeo';
            else if (isAudio) whatReceived = 'um áudio';

            const guidance = `📄 Recebi ${whatReceived}.

Para prosseguir com o envio de documentos/arquivos, utilize nosso formulário de cadastro:
${registrationLink}

No WhatsApp não processamos documentos diretamente. Após concluir o cadastro, nossa equipe dará continuidade ao seu atendimento.`;

            await this.sendMessage(phoneNumber, guidance);
            await this.saveAgentMessage(phoneNumber, guidance);
            return;
          } catch (sendError) {
            console.error('Erro ao orientar cadastro para anexos:', sendError);
          }
        }
      }

      // Processa a mensagem e gera resposta apenas se não estiver sob controle manual
      if (!this.isUnderManualControl(phoneNumber)) {
        const response = await this.processMessage(phoneNumber, messageText);

        // Se a resposta for null, significa que a conversa foi encerrada
        if (response === null) {
          console.log(`✅ Conversa encerrada pelo usuário ${phoneNumber}`);
          return;
        }

        // Envia a resposta
        await this.sendMessage(phoneNumber, response);

        // Salva a resposta do agente
        await this.saveAgentMessage(phoneNumber, response);
      } else {
        console.log(`👤 Mensagem de ${phoneNumber} em controle manual - não processando com IA`);
      }

    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      await this.sendMessage(message.from, 'Desculpe, ocorreu um erro. Tente novamente em alguns instantes.');
    }
  }

  async processMessage(phoneNumber, messageText) {
    try {
      console.log(`📱 Processando mensagem de ${phoneNumber}: "${messageText}"`);

      // Salva a mensagem do usuário
      await this.saveUserMessage(phoneNumber, messageText);

      // Obtém ou cria a conversa
      let conversation = await this.database.getConversation(phoneNumber);
      if (!conversation) {
        const conversationId = await this.database.createConversation(phoneNumber, 'unknown');
        conversation = { id: conversationId, user_type: 'unknown' };
      }

      // Se é a primeira mensagem, envia mensagem inicial
      const conversationHistory = await this.database.getConversationHistory(conversation.id, 10);
      if (conversationHistory.length === 0) {
        console.log(`🆕 Primeira mensagem - enviando mensagem inicial`);
        return await this.groqClient.getInitialMessage();
      }

      // Obtém histórico da conversa
      const history = await this.database.getConversationHistory(conversation.id, 10);
      console.log(`📜 Histórico da conversa: ${history.length} mensagens`);

      // Verifica se quer encerrar a conversa (mas não se for candidato no meio do fluxo)
      if (this.groqClient.wantsToEndConversation(messageText)) {
        // Se é candidato e tem histórico de conversa, não finaliza automaticamente
        if (conversation.user_type === 'candidate' && history.length > 2) {
          console.log(`🤔 Candidato ${phoneNumber} disse algo que pode ser finalização, mas está no meio do fluxo - continuando conversa`);
        } else {
          console.log(`👋 Usuário ${phoneNumber} quer encerrar a conversa`);
          
          const endMessage = await this.groqClient.handleEndConversation(messageText);
          await this.sendMessage(phoneNumber, endMessage);
          await this.finalizeConversation(phoneNumber);
          return null;
        }
      }

      // Verifica se quer falar com atendente
      if (this.groqClient.wantsToTalkToAttendant(messageText)) {
        console.log(`👤 Usuário ${phoneNumber} quer falar com atendente`);
        
        // Cria notificação para atendimento manual
        try {
          await this.database.createNotification(
            'candidate',
            phoneNumber,
            '👤 Usuário Quer Atendente',
            `Usuário ${phoneNumber} solicitou atendimento humano: "${messageText}"`
          );
          console.log(`🔔 Notificação de atendente criada: ${phoneNumber}`);
        } catch (error) {
          console.error('Erro ao criar notificação de atendente:', error);
        }
        
        return await this.groqClient.handleAttendantRequest(messageText);
      }

      // Verifica se a mensagem está fora do escopo de RH
      if (this.groqClient.isOutOfScope(messageText)) {
        console.log(`🚫 Mensagem fora do escopo detectada: ${phoneNumber} - "${messageText}"`);
        return this.groqClient.getOutOfScopeResponse(messageText);
      }

      // Detecta se é uma empresa querendo contratar a Evolux
      const userType = this.groqClient.detectUserType(messageText, history);
      if (userType === 'company' && (!conversation.user_type || conversation.user_type === 'unknown')) {
        console.log(`🏢 Empresa detectada: ${phoneNumber} - "${messageText}"`);
        
        // Atualiza o tipo de usuário no banco
        await this.database.updateConversationUserType(conversation.id, 'company');
        conversation.user_type = 'company';
        
        // Cria notificação para empresa no dashboard
        try {
          await this.database.createNotification(
            'company',
            phoneNumber,
            '🏢 Nova Empresa Interessada',
            `Empresa ${phoneNumber} entrou em contato para contratar serviços da Evolux: "${messageText}"`
          );
          console.log(`🔔 Notificação de empresa criada no dashboard: ${phoneNumber}`);
        } catch (error) {
          console.error('Erro ao criar notificação de empresa:', error);
        }
      }

      // Processa a mensagem de forma inteligente e contextual
      const response = await this.groqClient.handleConversation(messageText, history);
      
      // Salva a resposta do agente
      await this.saveAgentMessage(phoneNumber, response);

      return response;

    } catch (error) {
      console.error('❌ Erro no processamento da mensagem:', error);
      return 'Desculpe, estou enfrentando dificuldades técnicas. Tente novamente em alguns instantes.';
    }
  }

  async saveUserMessage(phoneNumber, message) {
    try {
      let conversation = await this.database.getConversation(phoneNumber);
      if (!conversation) {
        // Se a mensagem é "candidato" ou "empresa", usa diretamente
        let userType = 'unknown';
        if (message.toLowerCase().includes('candidato')) {
          userType = 'candidate';
        } else if (message.toLowerCase().includes('empresa')) {
          userType = 'company';
        }
        
        const conversationId = await this.database.createConversation(phoneNumber, userType);
        conversation = { id: conversationId, user_type: userType };
      }
      
      await this.database.saveMessage(conversation.id, message, 'user');
    } catch (error) {
      console.error('Erro ao salvar mensagem do usuário:', error);
    }
  }

  async saveAgentMessage(phoneNumber, message) {
    try {
      const conversation = await this.database.getConversation(phoneNumber);
      if (conversation) {
        await this.database.saveMessage(conversation.id, message, 'agent');
      }
    } catch (error) {
      console.error('Erro ao salvar mensagem do agente:', error);
    }
  }

  async sendMessage(phoneNumber, message) {
    try {
      if (!this.isReady) {
        console.log('Cliente WhatsApp não está pronto');
        return;
      }

      // Formata o número do telefone se necessário
      const formattedNumber = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
      
      await this.client.sendMessage(formattedNumber, message);
      console.log(`✅ Mensagem enviada para ${phoneNumber}`);
      
      // REMOVIDO: Não assume controle automaticamente após enviar mensagem
      // O controle deve ser assumido apenas pelo dashboard
      
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  }

  async initialize() {
    const initStartTime = Date.now();
    try {
      if (this.isInitializing) {
        console.log('⏳ Inicialização do WhatsApp já em andamento...');
        console.log('📋 Estado da inicialização em andamento:', {
          hasInitializePromise: !!this.initializePromise,
          isReady: this.isReady,
          hasClient: !!this.client,
          retryCount: this.retryCount
        });
        return this.initializePromise;
      }
      
      this.isInitializing = true;
      console.log('🚀 Iniciando cliente WhatsApp (versão simplificada)...');
      console.log('📋 Estado inicial da inicialização:', {
        timestamp: new Date().toISOString(),
        isReady: this.isReady,
        hasClient: !!this.client,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        qrCodeExists: !!this.qrCode,
        reconnectAttempts: this.reconnectAttempts
      });
      console.log('⏳ Aguarde, isso pode levar alguns minutos...');
      
      // Timeout reduzido para inicialização
      console.log('🔧 Configurando promises de inicialização...');
      const initPromise = this.client.initialize();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Inicialização timeout')), 120000) // 2 minutos
      );
      
      console.log('🔄 Aguardando inicialização do WhatsApp...');
      console.log('⏰ Timeout configurado para 120 segundos');
      console.log('📋 Configuração do cliente:', {
        hasAuthStrategy: !!this.client.authStrategy,
        hasPuppeteer: !!this.client.puppeteer,
        clientInitialized: !!this.client
      });
      
      this.initializePromise = Promise.race([initPromise, timeoutPromise]);
      
      console.log('⏳ Executando inicialização...');
      await this.initializePromise;
      
      const initTime = Math.floor((Date.now() - initStartTime) / 1000);
      console.log(`✅ WhatsApp inicializado com sucesso em ${initTime} segundos!`);
      console.log('📋 Estado pós-inicialização:', {
        isReady: this.isReady,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage,
        qrCodeExists: !!this.qrCode,
        totalInitTime: `${initTime}s`,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const initTime = Math.floor((Date.now() - initStartTime) / 1000);
      console.error(`❌ Erro ao inicializar cliente WhatsApp após ${initTime}s:`, error);
      console.error('📋 Detalhes completos do erro de inicialização:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 8),
        initTimeSeconds: initTime,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        clientState: {
          hasClient: !!this.client,
          isReady: this.isReady,
          qrCodeExists: !!this.qrCode,
          isInitializing: this.isInitializing
        },
        timestamp: new Date().toISOString()
      });
      
      // Tenta reinicializar se for erro de protocolo e ainda não excedeu tentativas
      if ((error.message.includes('Protocol error') || 
           error.message.includes('Execution context was destroyed') ||
           error.message.includes('Navigation timeout') ||
           error.message.includes('Inicialização timeout')) && 
          this.retryCount < this.maxRetries) {
        
        this.retryCount++;
        console.log(`🔄 Tentativa ${this.retryCount}/${this.maxRetries} - Reinicializando...`);
        
        // Aguarda um pouco antes de tentar novamente
        console.log('⏳ Aguardando 10 segundos antes da próxima tentativa...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        await this.retryInitialize();
      } else {
        console.error('❌ Máximo de tentativas atingido ou erro não recuperável');
        throw error;
      }
    } finally {
      this.isInitializing = false;
    }
  }

  async retryInitialize() {
    try {
      // Limpa a sessão anterior
      await this.client.destroy();
      
      // Cria novo cliente com configurações ainda mais básicas
      this.client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
          headless: true,
          executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || (require('../config/config').whatsapp.executablePath || undefined),
          defaultViewport: null,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--mute-audio',
            '--no-default-browser-check',
            '--disable-web-security',
            '--ignore-certificate-errors',
            '--ignore-ssl-errors',
            '--allow-running-insecure-content',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials',
            '--no-zygote'
          ],
          timeout: 120000,
          protocolTimeout: 120000
        }
      });

      this.setupEventHandlers();
      await this.client.initialize();
      
    } catch (error) {
      console.error('❌ Falha na reinicialização:', error);
      throw error;
    }
  }

  async destroy() {
    try {
      console.log('🛑 Destruindo cliente WhatsApp...');
      
      // Para health check
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      // Para reconexão automática
      if (this.reconnectInterval) {
        clearTimeout(this.reconnectInterval);
        this.reconnectInterval = null;
      }
      
      // Limpa todos os timeouts ativos
      for (const [phoneNumber, { timeoutId }] of this.activeConversations) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
      this.activeConversations.clear();
      
      // Limpa controle manual
      this.manualControl.clear();
      
      // Desabilita reconexão automática
      this.autoReconnectEnabled = false;
      
      if (this.client) {
        await this.client.destroy();
      }
      
      if (this.database) {
        this.database.close();
      }
      
      console.log('✅ Cliente WhatsApp destruído com sucesso');
    } catch (error) {
      console.error('❌ Erro ao destruir cliente:', error);
    }
  }

  async generateQRCode() {
    try {
      console.log('📱 Iniciando geração de QR Code...');
      console.log('📋 Status detalhado do cliente:', {
        timestamp: new Date().toISOString(),
        isConnected: this.isConnected(),
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage,
        qrCodeAvailable: !!this.qrCode,
        qrCodeLength: this.qrCode ? this.qrCode.length : 0,
        isReady: this.isReady,
        isInitializing: this.isInitializing,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
        reconnectAttempts: this.reconnectAttempts
      });

      if (this.isConnected()) {
        console.log('📱 WhatsApp já está conectado - não é necessário gerar QR Code');
        console.log('📋 Status de conexão:', {
          isReady: this.isReady,
          hasClient: !!this.client,
          hasPupPage: !!this.client?.pupPage
        });
        return null;
      }

      if (!this.client) {
        console.log('📱 Cliente WhatsApp não inicializado');
        console.log('📋 Estado do cliente:', {
          client: this.client,
          isInitializing: this.isInitializing,
          retryCount: this.retryCount
        });
        return null;
      }

      // Verifica se há um QR Code disponível
      if (this.qrCode) {
        console.log('📱 QR Code já disponível, gerando base64...');
        console.log('📋 Detalhes do QR Code existente:', {
          qrLength: this.qrCode.length,
          qrPreview: this.qrCode.substring(0, 30) + '...',
          generationTime: new Date().toISOString()
        });
        
        try {
          // Gera QR Code em base64
          console.log('🔄 Convertendo QR Code para base64...');
          const qrCodeBase64 = await qrcode.toDataURL(this.qrCode, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          
          console.log('📱 QR Code base64 gerado com sucesso!');
          console.log('📋 Informações do base64:', {
            totalLength: qrCodeBase64.length,
            prefix: qrCodeBase64.substring(0, 30),
            hasComma: qrCodeBase64.includes(','),
            splitParts: qrCodeBase64.split(',').length
          });
          
          // Remove o prefixo data:image/png;base64, para retornar apenas o base64
          return qrCodeBase64.split(',')[1];
        } catch (qrGenError) {
          console.error('❌ Erro ao converter QR Code para base64:', qrGenError);
          console.error('📋 Detalhes do erro de conversão:', {
            message: qrGenError.message,
            stack: qrGenError.stack?.split('\n').slice(0, 5),
            qrCodeValid: !!this.qrCode && this.qrCode.length > 0,
            qrCodeType: typeof this.qrCode
          });
          throw qrGenError;
        }
      }

      // Se não há QR Code disponível, tenta forçar uma nova geração
      console.log('📱 Forçando geração de novo QR Code...');
      console.log('📋 Estado antes da geração forçada:', {
        qrCodeExists: !!this.qrCode,
        isConnected: this.isConnected(),
        isInitializing: this.isInitializing,
        isReady: this.isReady
      });
      
      // Limpa QR Code anterior
      this.qrCode = null;
      console.log('🧹 QR Code anterior removido');
      
      // Se não estiver conectado, inicia a inicialização em background (não bloqueia)
      if (!this.isConnected()) {
        console.log('📱 WhatsApp não está conectado, reinicializando (background)...');
        console.log('📋 Condições de inicialização:', {
          isReady: this.isReady,
          isInitializing: this.isInitializing,
          hasClient: !!this.client
        });
        
        try {
          // Dispara a inicialização sem aguardar, evitando concorrência
          if (!this.isReady && !this.isInitializing) {
            console.log('🚀 Iniciando processo de inicialização em background...');
            this.initialize().catch((error) => {
              console.error('❌ Erro ao reinicializar WhatsApp (background):', error);
              console.error('📋 Detalhes do erro de inicialização:', {
                message: error.message,
                stack: error.stack?.split('\n').slice(0, 3),
                isInitializing: this.isInitializing,
                retryCount: this.retryCount
              });
            });
          } else if (this.isInitializing) {
            console.log('⏳ Já existe uma inicialização em andamento, aguardando QR...');
          } else {
            console.log('⚠️ Cliente está pronto mas não conectado - situação inesperada');
          }
        } catch (error) {
          console.error('❌ Erro ao agendar reinicialização do WhatsApp:', error);
          console.error('📋 Detalhes do erro de agendamento:', {
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 3)
          });
        }
      }
      
      // Aguarda até 90 segundos para o QR Code ser gerado
      let attempts = 0;
      const maxAttempts = 90;
      const startTime = Date.now();
      
      console.log(`⏱️ Iniciando espera por QR Code (máximo ${maxAttempts} segundos)...`);
      
      while (!this.qrCode && attempts < maxAttempts) {
        const currentTime = Date.now();
        const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
        
        if (attempts % 10 === 0 || attempts < 5) { // Log a cada 10 tentativas ou primeiras 5
          console.log(`📱 Tentativa ${attempts + 1}/${maxAttempts} - Aguardando QR Code... (${elapsedSeconds}s)`);
          console.log('📋 Status detalhado atual:', {
            qrCode: !!this.qrCode,
            qrCodeLength: this.qrCode ? this.qrCode.length : 0,
            isReady: this.isReady,
            isInitializing: this.isInitializing,
            hasPupPage: !!this.client?.pupPage,
            isConnected: this.isConnected(),
            elapsedTime: `${elapsedSeconds}s`,
            clientExists: !!this.client
          });
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (this.qrCode) {
        const totalTime = Math.floor((Date.now() - startTime) / 1000);
        console.log(`📱 QR Code gerado com sucesso após ${totalTime} segundos!`);
        console.log('📋 Sucesso na geração:', {
          qrLength: this.qrCode.length,
          qrPreview: this.qrCode.substring(0, 30) + '...',
          attempts: attempts,
          totalTimeSeconds: totalTime,
          timestamp: new Date().toISOString()
        });
        
        try {
          console.log('🔄 Convertendo QR Code final para base64...');
          // Gera QR Code em base64
          const qrCodeBase64 = await qrcode.toDataURL(this.qrCode, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          
          console.log('📱 QR Code base64 gerado com sucesso!');
          console.log('📋 Informações finais do base64:', {
            totalLength: qrCodeBase64.length,
            prefix: qrCodeBase64.substring(0, 30),
            hasComma: qrCodeBase64.includes(','),
            splitParts: qrCodeBase64.split(',').length
          });
          
          // Remove o prefixo data:image/png;base64, para retornar apenas o base64
          const finalBase64 = qrCodeBase64.split(',')[1];
          console.log(`✅ QR Code processado com sucesso! Base64 length: ${finalBase64.length}`);
          return finalBase64;
          
        } catch (finalError) {
          console.error('❌ Erro na conversão final para base64:', finalError);
          console.error('📋 Detalhes do erro final:', {
            message: finalError.message,
            stack: finalError.stack?.split('\n').slice(0, 5),
            qrCodeValid: !!this.qrCode,
            qrCodeLength: this.qrCode ? this.qrCode.length : 0
          });
          throw finalError;
        }
      } else {
        const totalTime = Math.floor((Date.now() - startTime) / 1000);
        console.log(`📱 QR Code não disponível após ${attempts} tentativas (${totalTime}s)`);
        console.log('📋 Status final detalhado:', {
          qrCode: !!this.qrCode,
          qrCodeValue: this.qrCode || 'null',
          isReady: this.isReady,
          isInitializing: this.isInitializing,
          hasPupPage: !!this.client?.pupPage,
          hasClient: !!this.client,
          attempts: attempts,
          maxAttempts: maxAttempts,
          totalTimeSeconds: totalTime,
          isConnected: this.isConnected(),
          retryCount: this.retryCount,
          timestamp: new Date().toISOString()
        });
        return null;
      }
    } catch (error) {
      console.error('❌ Erro crítico ao gerar QR Code:', error);
      console.error('📋 Detalhes completos do erro:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 10),
        timestamp: new Date().toISOString(),
        clientStatus: {
          hasClient: !!this.client,
          isReady: this.isReady,
          isInitializing: this.isInitializing,
          qrCodeExists: !!this.qrCode,
          isConnected: this.isConnected()
        },
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage()
        }
      });
      return null;
    }
  }

  isConnected() {
    // Verifica se está realmente conectado
    return this.isReady && this.client && this.client.pupPage;
  }

  // Método para forçar desconexão e gerar novo QR Code
  async forceDisconnect() {
    try {
      console.log('📱 Forçando desconexão do WhatsApp...');
      this.isReady = false;
      this.qrCode = null;
      
      if (this.client) {
        await this.client.destroy();
        this.client = new Client({
          authStrategy: new LocalAuth(),
          puppeteer: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--no-first-run',
              '--disable-extensions',
              '--disable-default-apps',
              '--disable-sync',
              '--disable-translate',
              '--hide-scrollbars',
              '--mute-audio',
              '--no-default-browser-check',
              '--disable-web-security',
              '--ignore-certificate-errors',
              '--ignore-ssl-errors',
              '--allow-running-insecure-content'
            ],
            timeout: 60000,
            protocolTimeout: 60000,
            executablePath: config.whatsapp.executablePath || undefined
          }
        });
        
        this.setupEventHandlers();
        await this.client.initialize();
        
        console.log('📱 Cliente WhatsApp reinicializado');
        return true;
      }
    } catch (error) {
      console.error('❌ Erro ao forçar desconexão:', error);
      return false;
    }
  }

  // Método para obter estatísticas de conversas ativas
  getActiveConversationsStats() {
    try {
      const now = Date.now();
      const stats = {
        total: this.activeConversations ? this.activeConversations.size : 0,
        conversations: [],
        manualControl: {
          total: this.manualControl ? this.manualControl.size : 0,
          conversations: []
        }
      };

      if (!this.activeConversations) {
        console.warn('activeConversations não está inicializado');
        return stats;
      }

      for (const [phoneNumber, conversationData] of this.activeConversations) {
        try {
          const { lastActivity, isManualControl } = conversationData;
          const timeSinceLastActivity = now - lastActivity;
          const timeRemaining = this.timeoutDuration - timeSinceLastActivity;
          
          const conversationInfo = {
            phoneNumber,
            lastActivity: new Date(lastActivity).toISOString(),
            timeSinceLastActivity: Math.floor(timeSinceLastActivity / 1000),
            timeRemaining: Math.max(0, Math.floor(timeRemaining / 1000)),
            isManualControl: this.isUnderManualControl(phoneNumber) || isManualControl
          };

          if (this.isUnderManualControl(phoneNumber) || isManualControl) {
            const manualInfo = this.getManualControlInfo(phoneNumber);
            conversationInfo.manualControl = {
              agentId: manualInfo ? manualInfo.agentId : 'unknown',
              takenAt: manualInfo ? manualInfo.takenAt.toISOString() : new Date().toISOString()
            };
            stats.manualControl.conversations.push(conversationInfo);
          } else {
            stats.conversations.push(conversationInfo);
          }
        } catch (convError) {
          console.error(`Erro ao processar conversa ${phoneNumber}:`, convError);
          // Continua com a próxima conversa
        }
      }

      return stats;
    } catch (error) {
      console.error('Erro ao obter estatísticas de conversas:', error);
      return {
        total: 0,
        conversations: [],
        manualControl: {
          total: 0,
          conversations: []
        }
      };
    }
  }
}

// Função para detectar o caminho do Chrome
function getChromeExecutablePath() {
  // PRIORIDADE: Variável de ambiente (definida pelo script de produção)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    console.log('🔍 Chrome configurado via env:', process.env.PUPPETEER_EXECUTABLE_PATH);
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  
  // Segundo: configuração do config
  if (config.whatsapp.executablePath) {
    console.log('🔍 Chrome configurado via config:', config.whatsapp.executablePath);
    return config.whatsapp.executablePath;
  }
  
  // Terceiro: detecta automaticamente
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
          console.log('🔍 Chrome detectado automaticamente em:', path);
          return path;
        }
      } catch (error) {
        // Ignora erros de verificação
      }
    }
  } else if (process.platform === 'linux') {
    // Linux - ordem de prioridade melhorada
    const possiblePaths = [
      '/usr/bin/google-chrome-stable', // Preferência para versão estável
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/opt/google/chrome/chrome', // Algumas distribuições instalam aqui
      '/snap/bin/chromium'         // Snap packages
    ];
    
    for (const path of possiblePaths) {
      try {
        const fs = require('fs');
        if (fs.existsSync(path)) {
          console.log('🔍 Chrome detectado automaticamente em:', path);
          return path;
        }
      } catch (error) {
        // Ignora erros de verificação
      }
    }
  }
  
  // Se não encontrar, avisa e usa padrão
  console.log('⚠️ Chrome não detectado! Para resolver:');
  console.log('   1. Execute: bash scripts/setup-production.sh');
  console.log('   2. Ou defina: export PUPPETEER_EXECUTABLE_PATH=/caminho/para/chrome');
  return undefined;
}

module.exports = WhatsAppClientSimple;

