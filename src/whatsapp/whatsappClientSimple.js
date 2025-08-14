const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const Database = require('../database/database');
const GroqClient = require('../ai/groqClient');
const BusinessHoursService = require('../services/businessHoursService');
const config = require('../config/config');

class WhatsAppClientSimple {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
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
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-first-run',
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
          '--disable-component-extensions-with-background-pages'
        ],
        timeout: 180000,
        protocolTimeout: 180000
      }
    });

    this.database = new Database();
    this.groqClient = new GroqClient();
    this.isReady = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.isInitializing = false;
    this.initializePromise = null;
    
    // Sistema de timeout
    this.activeConversations = new Map(); // phoneNumber -> { timeoutId, lastActivity }
    this.timeoutDuration = config.conversation.timeoutDuration || 120000; // 2 minutos em millisegundos

    // Sistema de controle manual
    this.manualControl = new Map(); // phoneNumber -> { isManual: boolean, agentId: string, takenAt: Date }

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Evento quando o QR Code é gerado
    this.client.on('qr', (qr) => {
      console.log('📱 QR Code gerado pelo WhatsApp!');
      console.log('📋 QR Code details:', {
        length: qr.length,
        startsWith: qr.substring(0, 20) + '...',
        timestamp: new Date().toISOString(),
        clientStatus: {
          isReady: this.isReady,
          hasClient: !!this.client,
          hasPupPage: !!this.client?.pupPage,
          isConnected: this.isConnected()
        }
      });
      
      // Salva o QR Code para uso posterior
      this.qrCode = qr;
      console.log('💾 QR Code salvo na memória:', {
        qrCodeSaved: !!this.qrCode,
        qrCodeLength: this.qrCode?.length
      });
      
      // Gera QR Code no terminal
      try {
        qrcodeTerminal.generate(qr, { small: true });
        console.log('📱 QR Code gerado no terminal com sucesso');
      } catch (error) {
        console.error('❌ Erro ao gerar QR Code no terminal:', error);
      }
    });

    // Evento quando o cliente está pronto
    this.client.on('ready', () => {
      console.log('✅ Cliente WhatsApp conectado e pronto!');
      console.log('📋 Status antes de marcar como pronto:', {
        isReady: this.isReady,
        qrCode: !!this.qrCode,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage
      });
      
      this.isReady = true;
      this.retryCount = 0; // Reset retry count on success
      
      // Limpa o QR Code quando conectado
      if (this.qrCode) {
        console.log('🧹 Limpando QR Code após conexão');
        this.qrCode = null;
      }
      
      console.log('📋 Status após marcar como pronto:', {
        isReady: this.isReady,
        qrCode: !!this.qrCode,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage,
        isConnected: this.isConnected()
      });
    });

    // Evento quando uma mensagem é recebida
    this.client.on('message', async (message) => {
      await this.handleMessage(message);
    });

    // Evento de autenticação
    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp autenticado com sucesso!');
      console.log('📋 Status após autenticação:', {
        isReady: this.isReady,
        qrCode: !!this.qrCode,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage
      });
    });

    // Evento de desconexão
    this.client.on('disconnected', (reason) => {
      console.log('❌ Cliente WhatsApp desconectado:', reason);
      console.log('📋 Status antes de marcar como desconectado:', {
        isReady: this.isReady,
        qrCode: !!this.qrCode,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage
      });
      
      this.isReady = false;
      
      console.log('📋 Status após marcar como desconectado:', {
        isReady: this.isReady,
        qrCode: !!this.qrCode,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage
      });
    });

    // Evento de loading screen
    this.client.on('loading_screen', (percent, message) => {
      console.log(`📱 Carregando WhatsApp: ${percent}% - ${message}`);
      console.log('📋 Status durante carregamento:', {
        isReady: this.isReady,
        qrCode: !!this.qrCode,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage,
        percent: percent
      });
    });

    // Evento de auth_failure
    this.client.on('auth_failure', (message) => {
      console.log('❌ Falha na autenticação WhatsApp:', message);
      console.log('📋 Status após falha de autenticação:', {
        isReady: this.isReady,
        qrCode: !!this.qrCode,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage
      });
    });

    console.log('📱 Event handlers configurados com sucesso');
  }

  // Sistema de controle manual
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

      // Envia mensagem de encerramento do atendimento manual
      const closingMessage = `✅ *Atendimento Manual Encerrado*

O atendimento manual foi encerrado e o assistente virtual da Evolux Soluções de RH está de volta!

🤖 Como posso ajudá-lo hoje?

*Digite "empresa" se você representa uma empresa interessada em nossos serviços de RH*
*Digite "candidato" se você está procurando oportunidades de emprego*

---
*Sistema reiniciado automaticamente*`;

      await this.sendMessage(phoneNumber, closingMessage);
      console.log(`📤 Mensagem de encerramento enviada para ${phoneNumber}`);

      // Limpa o histórico da conversa para reiniciar o fluxo
      await this.database.clearConversationData(phoneNumber);
      console.log(`🔄 Histórico da conversa limpo para ${phoneNumber}`);

      // Cria nova conversa
      await this.database.createConversation(phoneNumber, 'candidate');
      console.log(`🆕 Nova conversa criada para ${phoneNumber}`);

      // Envia mensagem inicial
      const initialMessage = await this.groqClient.getInitialMessage();
      await this.sendMessage(phoneNumber, initialMessage);
      console.log(`👋 Mensagem inicial enviada para ${phoneNumber}`);

      // Reativa timeout
      this.manageConversationTimeout(phoneNumber);

      console.log(`🤖 Controle manual liberado e fluxo reiniciado para ${phoneNumber}`);
      
      return {
        success: true,
        message: `Controle manual liberado e fluxo reiniciado para ${phoneNumber}`,
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
      }, 300000); // 5 minutos adicionais

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

      console.log(`📱 Nova mensagem de ${phoneNumber}: ${messageText}`);

      // Verifica se é uma conversa reiniciada
      const isRestarted = this.isConversationRestarted(phoneNumber);
      if (isRestarted) {
        console.log(`🔄 Conversa reiniciada com ${phoneNumber}`);
        // Limpa dados anteriores da conversa
        await this.database.clearConversationData(phoneNumber);
        // NÃO remove controle manual em conversas reiniciadas
        // this.manualControl.delete(phoneNumber);
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

      // Detecta anexos/documentos/links e orienta cadastro
      const containsUrl = (text) => {
        if (!text || typeof text !== 'string') return false;
        const urlRegex = /\b((?:https?:\/\/|www\.)[\w-]+(?:\.[\w-]+)+(?:[\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?)\b/i;
        return urlRegex.test(text);
      };

      const isAttachment = !!message.hasMedia || (message.type && message.type !== 'chat');
      const isDocument = message.type === 'document';
      const isLinkOnly = containsUrl(messageText);

      if (isAttachment || isDocument || isLinkOnly) {
        try {
          const registrationLink = (config.company && config.company.registrationLink) ? config.company.registrationLink : (config.company && config.company.website ? config.company.website : '');
          const noticeParts = [];
          if (isDocument) noticeParts.push('documento');
          else if (isAttachment) noticeParts.push('anexo');
          if (isLinkOnly) noticeParts.push('link');
          const whatReceived = noticeParts.length ? noticeParts.join(' e ') : 'conteúdo';

          const guidance = `📄 Recebi ${whatReceived}.

Para prosseguir com o envio de documentos/arquivos, utilize nosso formulário de cadastro:
${registrationLink}

No WhatsApp não processamos documentos diretamente. Após concluir o cadastro, nossa equipe dará continuidade ao seu atendimento.`;

          await this.sendMessage(phoneNumber, guidance);
          await this.saveAgentMessage(phoneNumber, guidance);
          return;
        } catch (sendError) {
          console.error('Erro ao orientar cadastro para anexos/links:', sendError);
        }
      }

      // Processa a mensagem e gera resposta
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
      
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  }

  async initialize() {
    try {
      if (this.isInitializing) {
        console.log('⏳ Inicialização do WhatsApp já em andamento...');
        return this.initializePromise;
      }
      this.isInitializing = true;
      console.log('🚀 Iniciando cliente WhatsApp (versão simplificada)...');
      console.log('⏳ Aguarde, isso pode levar alguns minutos...');
      console.log('🔧 Configurações do Puppeteer:', {
        headless: true,
        timeout: 120000,
        protocolTimeout: 120000,
        args: this.client?.puppeteer?.args?.length || 'não disponível',
        executablePath: process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || (require('../config/config').whatsapp.executablePath || 'auto')
      });
      
      console.log('📋 Status inicial:', {
        isReady: this.isReady,
        qrCode: !!this.qrCode,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage,
        retryCount: this.retryCount
      });
      
      // Timeout muito longo para inicialização
      const initPromise = this.client.initialize();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Inicialização timeout')), 180000)
      );
      
      console.log('🔄 Aguardando inicialização do WhatsApp...');
      console.log('⏰ Timeout configurado para 180 segundos');
      
      this.initializePromise = Promise.race([initPromise, timeoutPromise]);
      await this.initializePromise;
      
      console.log('✅ Promise.race concluída - WhatsApp inicializado!');
      console.log('📋 Status após Promise.race:', {
        isReady: this.isReady,
        qrCode: !!this.qrCode,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage
      });
      
      // Aguarda um pouco mais para garantir que está realmente pronto
      console.log('⏳ Aguardando 5 segundos extras para estabilização...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('📋 Status final após estabilização:', {
        isReady: this.isReady,
        qrCode: !!this.qrCode,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage,
        isConnected: this.isConnected()
      });
      
      console.log('✅ WhatsApp inicializado com sucesso!');
      
    } catch (error) {
      console.error('❌ Erro ao inicializar cliente WhatsApp:', error);
      console.error('📋 Detalhes do erro:', {
        message: error.message,
        stack: error.stack?.split('\n')[0],
        retryCount: this.retryCount,
        maxRetries: this.maxRetries
      });
      
      console.log('📋 Status no momento do erro:', {
        isReady: this.isReady,
        qrCode: !!this.qrCode,
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage
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
      // Limpa todos os timeouts ativos
      for (const [phoneNumber, { timeoutId }] of this.activeConversations) {
        clearTimeout(timeoutId);
        console.log(`⏰ Timeout limpo para ${phoneNumber}`);
      }
      this.activeConversations.clear();
      
      // Limpa controle manual
      this.manualControl.clear();
      
      await this.client.destroy();
      this.database.close();
      console.log('Cliente WhatsApp destruído');
    } catch (error) {
      console.error('Erro ao destruir cliente:', error);
    }
  }

  async generateQRCode() {
    try {
      console.log('📱 Iniciando geração de QR Code...');
      console.log('📋 Status do cliente:', {
        isConnected: this.isConnected(),
        hasClient: !!this.client,
        hasPupPage: !!this.client?.pupPage,
        qrCodeAvailable: !!this.qrCode,
        isReady: this.isReady
      });

      if (this.isConnected()) {
        console.log('📱 WhatsApp já está conectado');
        return null;
      }

      if (!this.client) {
        console.log('📱 Cliente WhatsApp não inicializado');
        return null;
      }

      // Verifica se há um QR Code disponível
      if (this.qrCode) {
        console.log('📱 QR Code já disponível, gerando base64...');
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
        // Remove o prefixo data:image/png;base64, para retornar apenas o base64
        return qrCodeBase64.split(',')[1];
      }

      // Se não há QR Code disponível, tenta forçar uma nova geração
      console.log('📱 Forçando geração de novo QR Code...');
      
      // Limpa QR Code anterior
      this.qrCode = null;
      
      // Se não estiver conectado, inicia a inicialização em background (não bloqueia)
      if (!this.isConnected()) {
        console.log('📱 WhatsApp não está conectado, reinicializando (background)...');
        try {
          // Dispara a inicialização sem aguardar, evitando concorrência
          if (!this.isReady && !this.isInitializing) {
            this.initialize().catch((error) => {
              console.error('❌ Erro ao reinicializar WhatsApp (background):', error);
            });
          } else if (this.isInitializing) {
            console.log('⏳ Já existe uma inicialização em andamento, aguardando QR...');
          }
        } catch (error) {
          console.error('❌ Erro ao agendar reinicialização do WhatsApp:', error);
        }
      }
      
      // Aguarda até 90 segundos para o QR Code ser gerado
      let attempts = 0;
      const maxAttempts = 90;
      
      while (!this.qrCode && attempts < maxAttempts) {
        console.log(`📱 Tentativa ${attempts + 1}/${maxAttempts} - Aguardando QR Code...`);
        console.log('📋 Status atual:', {
          qrCode: !!this.qrCode,
          isReady: this.isReady,
          hasPupPage: !!this.client?.pupPage,
          isConnected: this.isConnected()
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (this.qrCode) {
        console.log('📱 QR Code gerado com sucesso!');
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
        // Remove o prefixo data:image/png;base64, para retornar apenas o base64
        return qrCodeBase64.split(',')[1];
      } else {
        console.log('📱 QR Code não disponível após tentativas');
        console.log('📋 Status final:', {
          qrCode: !!this.qrCode,
          isReady: this.isReady,
          hasPupPage: !!this.client?.pupPage,
          attempts: attempts,
          isConnected: this.isConnected()
        });
        return null;
      }
    } catch (error) {
      console.error('❌ Erro ao gerar QR Code:', error);
      console.error('📋 Detalhes do erro:', {
        message: error.message,
        stack: error.stack?.split('\n')[0]
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
            executablePath: process.platform === 'win32' ? undefined : '/usr/bin/google-chrome-stable'
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

module.exports = WhatsAppClientSimple;

