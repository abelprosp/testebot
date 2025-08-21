const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Database = require('../database/database');
const GroqClient = require('../ai/groqClient');
const config = require('../config/config');

class WhatsAppClient {
  constructor() {
    // Configuração do Puppeteer
    const puppeteerConfig = {
      headless: config.whatsapp.headless,
      args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-field-trial-config',
          '--disable-ipc-flooding-protection',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-default-browser-check',
          '--safebrowsing-disable-auto-update',
          '--ignore-certificate-errors',
          '--ignore-ssl-errors',
          '--ignore-certificate-errors-spki-list',
          '--allow-running-insecure-content',
          '--disable-features=TranslateUI',
          '--disable-component-extensions-with-background-pages',
          '--disable-extension-network-service',
          '--disable-features=NetworkService',
          '--force-color-profile=srgb',
          '--metrics-recording-only',
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
        timeout: 60000,
        protocolTimeout: 60000
      };

    // Adiciona caminho do executável apenas se estiver configurado
    if (config.whatsapp.executablePath) {
      puppeteerConfig.executablePath = config.whatsapp.executablePath;
      console.log(`🔧 Usando Chrome em: ${config.whatsapp.executablePath}`);
    } else {
      console.log('🔧 Usando Chrome embutido do Puppeteer');
    }

    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: puppeteerConfig
    });

    this.database = new Database();
    this.groqClient = new GroqClient();
    this.isReady = false;

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    // Evento quando o QR Code é gerado
    this.client.on('qr', (qr) => {
      console.log('QR Code gerado. Escaneie com o WhatsApp:');
      qrcode.generate(qr, { small: true });
    });

    // Evento quando o cliente está pronto
    this.client.on('ready', () => {
      console.log('✅ Cliente WhatsApp conectado e pronto!');
      this.isReady = true;
    });

    // Evento quando uma mensagem é recebida
    this.client.on('message', async (message) => {
      await this.handleMessage(message);
    });

    // Evento de autenticação
    this.client.on('authenticated', () => {
      console.log('🔐 WhatsApp autenticado com sucesso!');
    });

    // Evento de desconexão
    this.client.on('disconnected', (reason) => {
      console.log('❌ Cliente WhatsApp desconectado:', reason);
      this.isReady = false;
    });

    // Evento de erro
    this.client.on('auth_failure', (msg) => {
      console.error('❌ Falha na autenticação:', msg);
    });

    // Evento de loading
    this.client.on('loading_screen', (percent, message) => {
      console.log(`📱 Carregando WhatsApp: ${percent}% - ${message}`);
    });
  }

  async handleMessage(message) {
    try {
      // Ignora mensagens do próprio bot
      if (message.fromMe) return;

      const phoneNumber = message.from;
      const messageText = message.body;

      console.log(`📱 Nova mensagem de ${phoneNumber}: ${messageText}`);

      // Verifica se a conversa foi finalizada
      const conversation = await this.database.getConversation(phoneNumber);
      if (conversation && conversation.status === 'finalized') {
        console.log(`🆕 Nova mensagem após finalização para ${phoneNumber} - criando nova conversa`);
        // Cria uma nova conversa para a nova mensagem
        await this.database.createConversation(phoneNumber, 'unknown');
        // Continua o processamento normalmente
      }

      // Salva a mensagem do usuário
      await this.saveUserMessage(phoneNumber, messageText);

      // Verifica se é controle manual
      const manualControl = await this.database.isManualControlEnabled(phoneNumber);
      if (manualControl.enabled) {
        console.log(`👤 Mensagem de ${phoneNumber} em controle manual - ignorando IA`);
        return; // Não processa com IA, apenas salva a mensagem
      }

      // Verifica se é primeira mensagem
      const isFirstMessage = await this.database.isFirstMessage(phoneNumber);
      if (isFirstMessage) {
        console.log(`🆕 Primeira mensagem de ${phoneNumber} - aguardando liberação manual`);
        await this.sendMessage(phoneNumber, this.getFirstMessageResponse());
        return;
      }

      // IMPORTANTE: Verifica se o controle manual foi habilitado por um atendente
      // Se não foi habilitado manualmente, não processa automaticamente
      if (!manualControl.enabled && !isFirstMessage) {
        console.log(`🤖 Bot em modo automático para ${phoneNumber} - processando mensagem`);
        
        // Processa a mensagem e gera resposta
        const response = await this.processMessage(phoneNumber, messageText);

        // Envia a resposta
        await this.sendMessage(phoneNumber, response);

        // Salva a resposta do agente
        await this.saveAgentMessage(phoneNumber, response);
      }

    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      await this.sendMessage(message.from, 'Desculpe, ocorreu um erro. Tente novamente em alguns instantes.');
    }
  }

  async processMessage(phoneNumber, messageText) {
    try {
      // Obtém ou cria conversa
      let conversation = await this.database.getConversation(phoneNumber);
      
      if (!conversation) {
        // Se é a primeira mensagem, envia mensagem inicial
        return await this.groqClient.getInitialMessage();
      }

      // Obtém histórico da conversa
      const history = await this.database.getConversationHistory(conversation.id, 10);
      
      // Se ainda não foi classificado o tipo de usuário
      if (!conversation.user_type || conversation.user_type === 'unknown') {
        const userType = await this.groqClient.classifyUserType(messageText);
        await this.database.updateConversationUserType(conversation.id, userType);
        conversation.user_type = userType;
      }

      // Processa baseado no tipo de usuário com fluxo específico
      if (conversation.user_type === 'company') {
        return await this.handleCompanyFlow(messageText, phoneNumber);
      } else if (conversation.user_type === 'candidate') {
        return await this.handleCandidateFlow(messageText, history, phoneNumber);
      } else {
        // Se não conseguiu classificar, pergunta novamente
        return await this.groqClient.getInitialMessage();
      }

    } catch (error) {
      console.error('Erro no processamento da mensagem:', error);
      return 'Desculpe, estou enfrentando dificuldades técnicas. Tente novamente em alguns instantes.';
    }
  }

  // Fluxo específico para empresas
  async handleCompanyFlow(messageText, phoneNumber) {
    const messageLower = messageText.toLowerCase();
    
    // Verifica se está pedindo por atendente humano
    if (messageLower.includes('atendente') || messageLower.includes('humano') || 
        messageLower.includes('pessoa') || messageLower.includes('falar com alguém') ||
        messageLower.includes('conversar com alguém') || messageLower.includes('atendimento direto')) {
      return this.getCompanyAttendantResponse();
    }

    // Verifica se quer contratar a Evolux
    if (messageLower.includes('contratar') || messageLower.includes('serviços') ||
        messageLower.includes('evolux') || messageLower.includes('rh') ||
        messageLower.includes('recrutamento') || messageLower.includes('seleção')) {
      return this.getCompanyWaitResponse();
    }

    // Resposta padrão para empresas
    return await this.groqClient.handleCompanyFlow(messageText);
  }

  // Fluxo específico para candidatos
  async handleCandidateFlow(messageText, history, phoneNumber) {
    const messageLower = messageText.toLowerCase();
    
    // Verifica se está tentando enviar currículo
    if (messageLower.includes('currículo') || messageLower.includes('curriculo') ||
        messageLower.includes('cv') || messageLower.includes('enviar') ||
        messageLower.includes('mandar') || messageLower.includes('anexar') ||
        messageLower.includes('arquivo') || messageLower.includes('pdf') ||
        messageLower.includes('documento')) {
      return this.getCandidateResumeResponse();
    }

    // Verifica se quer ver vagas
    if (messageLower.includes('vagas') || messageLower.includes('emprego') ||
        messageLower.includes('oportunidades') || messageLower.includes('trabalho') ||
        messageLower.includes('candidatar') || messageLower.includes('aplicar')) {
      return await this.getCandidateJobsResponse(messageText, history);
    }

    // Verifica se está pedindo por atendente humano
    if (messageLower.includes('atendente') || messageLower.includes('humano') ||
        messageLower.includes('pessoa') || messageLower.includes('falar com alguém')) {
      return this.getCandidateAttendantResponse();
    }

    // Resposta padrão para candidatos
    return await this.groqClient.handleCandidateFlow(messageText, history);
  }

  // Respostas específicas para empresas
  getCompanyAttendantResponse() {
    return `👤 **Solicitação de Atendente Humano**

Entendemos que você gostaria de falar com um atendente humano.

📞 Um de nossos especialistas em recrutamento e seleção irá atendê-lo em breve.

⏰ Por favor, aguarde um momento enquanto transferimos você para um atendente humano.

Enquanto isso, você pode conhecer mais sobre nossos serviços em: ${config.company.website}

Obrigado pela paciência! 🙏

---
*Um atendente humano entrará em contato em breve.*`;
  }

  getCompanyWaitResponse() {
    return `🏢 **Interesse em Serviços da Evolux**

Obrigado pelo seu interesse nos serviços da ${config.company.name}!

📞 Um de nossos especialistas em recrutamento e seleção irá atendê-lo em breve para discutir suas necessidades.

⏰ Por favor, aguarde um momento enquanto transferimos você para um atendente humano.

Enquanto isso, você pode conhecer mais sobre nossos serviços em: ${config.company.website}

Obrigado pela paciência! 🙏

---
*Um especialista entrará em contato em breve para discutir suas necessidades de RH.*`;
  }

  // Respostas específicas para candidatos
  getCandidateResumeResponse() {
    return `📄 **Envio de Currículo**

Para enviar seu currículo e se candidatar às vagas, acesse nosso formulário oficial:

🔗 **Link para Candidatura:** ${config.company.registrationLink}

📝 **No formulário você poderá:**
• Enviar seu currículo
• Preencher informações detalhadas
• Selecionar vagas de interesse
• Acompanhar o status da candidatura

💡 **Dica:** Mantenha seu currículo atualizado e detalhe suas experiências e habilidades.

Obrigado pelo interesse em fazer parte da nossa equipe! 🚀

---
*Use o link acima para enviar seu currículo de forma segura e organizada.*`;
  }

  async getCandidateJobsResponse(messageText, history) {
    try {
      // Busca vagas disponíveis
      const jobs = await this.groqClient.jobService.getAllJobs();
      
      if (jobs.length === 0) {
        return `📋 **Vagas Disponíveis**

No momento não temos vagas abertas, mas você pode se cadastrar em nosso banco de talentos:

🔗 **Cadastro:** ${config.company.registrationLink}

Assim que surgirem oportunidades compatíveis com seu perfil, entraremos em contato! 😊

---
*Cadastre-se para receber notificações de novas vagas.*`;
      }

      // Filtra vagas relevantes baseado no histórico
      const relevantJobs = jobs.slice(0, 5); // Mostra até 5 vagas
      
      let response = `🎯 **Vagas Encontradas para Você:**

`;
      
      relevantJobs.forEach((job, index) => {
        response += `${index + 1}. 🏢 **${job.title}**
📊 Senioridade: ${job.level || 'Não especificado'}
📍 Localização: ${job.location || 'Não especificado'}
📝 ${job.description ? job.description.substring(0, 100) + '...' : 'Descrição não disponível'}

`;
      });

      response += `📋 **Para se candidatar, acesse:** ${config.company.registrationLink}

💡 **Dica:** No formulário você poderá selecionar as vagas de interesse e enviar seu currículo.

Obrigado pelo interesse! 🚀

---
*Use o link acima para se candidatar às vagas de interesse.*`;

      return response;
    } catch (error) {
      console.error('Erro ao buscar vagas:', error);
      return `📋 **Vagas Disponíveis**

Para ver as vagas disponíveis e se candidatar, acesse:

🔗 **Link para Candidatura:** ${config.company.registrationLink}

Obrigado pelo interesse! 🚀`;
    }
  }

  getCandidateAttendantResponse() {
    return `👤 **Solicitação de Atendente Humano**

Entendemos que você gostaria de falar com um atendente humano.

📞 Um de nossos especialistas em recrutamento e seleção irá atendê-lo em breve.

⏰ Por favor, aguarde um momento enquanto transferimos você para um atendente humano.

Enquanto isso, você pode se cadastrar em: ${config.company.registrationLink}

Obrigado pela paciência! 🙏

---
*Um atendente humano entrará em contato em breve.*`;
  }

  async saveUserMessage(phoneNumber, message) {
    try {
      let conversation = await this.database.getConversation(phoneNumber);
      if (!conversation) {
        console.log(`📝 Criando nova conversa para ${phoneNumber}`);
        const conversationId = await this.database.createConversation(phoneNumber, 'unknown');
        conversation = { id: conversationId };
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

  async sendMessageToAll(message, userType = null) {
    try {
      // Implementar envio em massa se necessário
      console.log('Funcionalidade de envio em massa não implementada');
    } catch (error) {
      console.error('Erro no envio em massa:', error);
    }
  }

  // Método para resposta da primeira mensagem
  getFirstMessageResponse() {
    return `🆕 **Nova Mensagem Recebida**

Olá! Recebemos sua mensagem e um de nossos especialistas irá atendê-lo em breve.

⏰ Por favor, aguarde um momento enquanto um atendente humano assume o atendimento.

📞 Nossos especialistas estão prontos para ajudá-lo com:
• Busca de vagas de emprego
• Serviços de RH para empresas
• Orientação profissional
• Informações sobre candidaturas

Obrigado pela paciência! 🙏

---
*Um atendente humano entrará em contato em breve.*`;
  }

  // Método para mensagem de finalização
  getFinalizationMessage() {
    return `✅ **Atendimento Finalizado**

Obrigado por escolher a ${config.company.name}!

O atendimento foi finalizado por atendente.

Se precisar de mais informações, sinta-se à vontade para enviar uma nova mensagem a qualquer momento!

Obrigado pela confiança! 🙏

---
*Atendimento encerrado*`;
  }

  // Método para mensagem de liberação de controle
  getReleaseMessage() {
    return `🤖 **Controle Liberado**

O atendimento manual foi liberado e o assistente virtual da ${config.company.name} está de volta!

Como posso ajudá-lo hoje?

Digite "empresa" se você representa uma empresa interessada em nossos serviços de RH
Digite "candidato" se você está procurando oportunidades de emprego

---
*Bot em modo automático*`;
  }

  // Métodos para controle manual
  async enableManualControl(phoneNumber, agentId) {
    try {
      await this.database.enableManualControl(phoneNumber, agentId);
      console.log(`👤 Controle manual habilitado para ${phoneNumber} por ${agentId}`);
      return true;
    } catch (error) {
      console.error('Erro ao habilitar controle manual:', error);
      return false;
    }
  }

  async disableManualControl(phoneNumber) {
    try {
      await this.database.disableManualControl(phoneNumber);
      console.log(`🤖 Controle manual desabilitado para ${phoneNumber} - Bot em modo automático`);
      return true;
    } catch (error) {
      console.error('Erro ao desabilitar controle manual:', error);
      return false;
    }
  }

  // Método para habilitar modo automático do bot
  async enableAutoMode(phoneNumber) {
    try {
      await this.database.disableManualControl(phoneNumber);
      console.log(`🤖 Modo automático habilitado para ${phoneNumber}`);
      return true;
    } catch (error) {
      console.error('Erro ao habilitar modo automático:', error);
      return false;
    }
  }

  // Método para liberar controle e finalizar conversa
  async releaseControlAndFinalize(phoneNumber) {
    try {
      console.log(`🔚 Liberando controle para ${phoneNumber}`);
      
      // Desabilita controle manual
      await this.database.disableManualControl(phoneNumber);
      
      // Envia mensagem de liberação
      const releaseMessage = this.getReleaseMessage();
      await this.sendMessage(phoneNumber, releaseMessage);
      
      // Salva a mensagem de liberação
      await this.saveAgentMessage(phoneNumber, releaseMessage);
      
      console.log(`✅ Controle liberado para ${phoneNumber} - Bot em modo automático`);
      
      return {
        success: true,
        message: releaseMessage
      };
    } catch (error) {
      console.error('Erro ao liberar controle:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async markFirstMessageHandled(phoneNumber) {
    try {
      await this.database.markFirstMessageHandled(phoneNumber);
      console.log(`✅ Primeira mensagem marcada como tratada para ${phoneNumber}`);
      return true;
    } catch (error) {
      console.error('Erro ao marcar primeira mensagem:', error);
      return false;
    }
  }

  async getManualControlStatus(phoneNumber) {
    try {
      return await this.database.isManualControlEnabled(phoneNumber);
    } catch (error) {
      console.error('Erro ao obter status de controle manual:', error);
      return { enabled: false, agentId: null, takenAt: null };
    }
  }

  async getChats() {
    try {
      return await this.client.getChats();
    } catch (error) {
      console.error('Erro ao obter chats:', error);
      return [];
    }
  }

  async getChatById(chatId) {
    try {
      return await this.client.getChatById(chatId);
    } catch (error) {
      console.error('Erro ao obter chat:', error);
      return null;
    }
  }

  async initialize() {
    try {
      console.log('🚀 Iniciando cliente WhatsApp...');
      console.log('⏳ Aguarde, isso pode levar alguns minutos...');
      
      // Adiciona timeout mais longo para inicialização
      const initPromise = this.client.initialize();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na inicialização do WhatsApp')), 120000); // 2 minutos
      });

      await Promise.race([initPromise, timeoutPromise]);
      
    } catch (error) {
      console.error('Erro ao inicializar cliente WhatsApp:', error);
      
      // Tenta reinicializar se for erro de protocolo
      if (error.message.includes('Protocol error') || error.message.includes('Execution context was destroyed')) {
        console.log('🔄 Tentando reinicializar com configurações alternativas...');
        await this.retryInitialize();
      } else {
        throw error;
      }
    }
  }

  async retryInitialize() {
    try {
      // Limpa a sessão anterior
      await this.client.destroy();
      
      // Cria novo cliente com configurações mais simples
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
            '--no-default-browser-check'
          ],
          timeout: 90000,
          protocolTimeout: 90000
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
      await this.client.destroy();
      this.database.close();
      console.log('Cliente WhatsApp destruído');
    } catch (error) {
      console.error('Erro ao destruir cliente:', error);
    }
  }

  isConnected() {
    return this.isReady;
  }

  getActiveConversationsStats() {
    try {
      // Retorna estatísticas básicas para compatibilidade
      return {
        total: 0,
        conversations: [],
        manualControl: {
          total: 0,
          conversations: []
        }
      };
    } catch (error) {
      console.error('Erro ao obter estatísticas de conversas ativas:', error);
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

module.exports = WhatsAppClient;
