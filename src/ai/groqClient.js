const Groq = require('groq-sdk');
const config = require('../config/config');
const JobService = require('../services/jobService');
const BusinessHoursService = require('../services/businessHoursService');

class GroqClient {
  
  constructor() {
    // 🔑 COLOQUE SUA API KEY DA GROQ AQUI:
    const GROQ_API_KEY_DIRECT = '';
    
    // Usa a chave direta primeiro, depois tenta config
    const apiKey = GROQ_API_KEY_DIRECT || config.groq.apiKey;
    
    // Verifica se a API key está disponível
    if (!apiKey || apiKey === 'gsk_sua_chave_aqui_exemplo') {
      console.error('❌ GROQ_API_KEY não está definida! O sistema funcionará com respostas padrão.');
      this.groq = null;
    } else {
      console.log('✅ GROQ_API_KEY carregada com sucesso (direta do código)');
      this.groq = new Groq({
        apiKey: apiKey,
      });
    }
    
    this.model = config.groq.model;
    this.jobService = new JobService();
    this.businessHoursService = new BusinessHoursService();
    
    console.log('✅ JobService inicializado (conectado ao Supabase)');
    
    // Cache para respostas similares (economizar tokens)
    this.responseCache = new Map();
    this.maxCacheSize = 100;
    
    // Contador de tokens para monitoramento
    this.tokenUsage = {
      totalCalls: 0,
      totalTokens: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    // Máximo de mensagens no contexto
    this.maxContextMessages = 20; // Aumentado para melhor qualidade das respostas
  }

  async generateResponse(messages, context = {}) {
    try {
      // Verifica se a API está disponível
      if (!this.groq) {
        console.log('⚠️ Groq API não disponível - usando resposta padrão');
        return this.getFallbackResponse(messages[messages.length - 1]?.content || '');
      }
      
      // Gera chave de cache baseada na mensagem atual e contexto
      const cacheKey = this.generateCacheKey(messages, context);
      
      // Verifica cache primeiro
      if (this.responseCache.has(cacheKey)) {
        console.log('💾 Cache HIT - resposta já disponível');
        this.tokenUsage.cacheHits++;
        return this.responseCache.get(cacheKey);
      }
      
      this.tokenUsage.cacheMisses++;
      
      // Otimiza contexto para economizar tokens
      const optimizedMessages = this.optimizeContext(messages);
      const optimizedSystemPrompt = await this.buildOptimizedSystemPrompt(context);
      
      const chatMessages = [
        { role: 'system', content: optimizedSystemPrompt },
        ...optimizedMessages
      ];

      console.log(`🤖 Chamando Groq API - ${chatMessages.length} mensagens`, {
        systemPromptLength: optimizedSystemPrompt.length,
        totalMessages: chatMessages.length
      });

      const completion = await this.groq.chat.completions.create({
        messages: chatMessages,
        model: this.model,
        temperature: 0.8,
        max_tokens: 1500, // Aumentado para respostas mais completas com todas as vagas
        top_p: 1,
        stream: false,
      });

      const response = completion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';
      
      // Salva no cache
      this.saveToCache(cacheKey, response);
      
      // Atualiza estatísticas
      this.tokenUsage.totalCalls++;
      this.tokenUsage.totalTokens += (completion.usage?.total_tokens || 0);
      
      console.log(`💰 Tokens usados: ${completion.usage?.total_tokens || 0} | Total: ${this.tokenUsage.totalTokens}`);
      
      return response;
    } catch (error) {
      console.error('Erro na Groq API:', error);
      return 'Desculpe, estou enfrentando dificuldades técnicas. Tente novamente em alguns instantes.';
    }
  }

  async buildSystemPrompt(context) {
    const company = config.company;
    const jobs = await this.jobService.getAllJobs();
    const agorahora = new Date();
    const hora = agorahora.getHours()
    // Se é empresa, não mostra vagas disponíveis
    const isCompany = context.userType === 'company';
    
    return `Você é um assistente virtual especializado APENAS em recrutamento e seleção da ${company.name}.

IMPORTANTE - LIMITAÇÕES DE SEGURANÇA:
- Você PODE responder APENAS sobre recrutamento, seleção e vagas da ${company.name}
- Você NÃO PODE responder sobre outros assuntos (tecnologia, programação, política, etc.)
- Você NÃO PODE executar códigos ou criar scripts
- Você NÃO PODE fornecer informações pessoais ou confidenciais
- Você NÃO PODE responder sobre assuntos fora do escopo de RH
- Se alguém pedir algo fora do escopo, responda educadamente que só pode ajudar com recrutamento e seleção

SEU PERSONALIDADE:
- Nunca seja desrespeitoso com alguém
- Nunca diga " Não foi um prazer ", sempre será um prazer atender um cliente ou candidato bem
- Seja natural, caloroso e empático
- Use linguagem conversacional, não robótica
- Demonstre interesse genuíno pelo candidato/empresa
- Faça perguntas de acompanhamento quando apropriado
- Use emojis moderadamente para tornar a conversa mais amigável
- Adapte seu tom baseado no contexto da conversa
- Seja proativo em oferecer ajuda adicional

SUAS FUNÇÕES (APENAS):

1. PARA EMPRESAS (que querem contratar a Evolux):
- Verificar se está no horário ${hora} comercial (8h-12h e 13h30-18h, Segunda a Sexta)
- Se fora do horário: informar de forma cordial que retornaremos o contato
- Se no horário: pedir para aguardar um atendente humano de forma acolhedora
- NUNCA mostrar vagas disponíveis para empresas
- Apenas informar que um especialista entrará em contato

2. PARA CANDIDATOS (que querem se candidatar):
- Coletar informações de forma conversacional e natural
- Fazer perguntas de acompanhamento baseadas nas respostas
- Buscar vagas adequadas usando análise inteligente
- Explicar por que as vagas são adequadas para o perfil
- Oferecer dicas e orientações quando apropriado
- Fornecer link de cadastro: ${company.registrationLink}

3. PARA OUTROS ASSUNTOS:
- Transferir para atendente humano

${isCompany ? '' : `VAGAS DISPONÍVEIS (APENAS PARA CANDIDATOS):
${jobs.map((job, index) => `${index + 1}. ${job.title} - ${job.level || 'Não especificado'} - ${job.location} - ${job.description.substring(0, 100)}...`).join('\n')}`}

CONTEXTO ATUAL:
- Tipo de usuário: ${context.userType || 'não identificado'}
- Horário comercial: ${this.businessHoursService.isBusinessHours() ? 'Sim' : 'Não'}
- Vagas disponíveis: ${isCompany ? 'Não mostradas para empresas' : jobs.length}

INFORMAÇÕES DA EMPRESA:
- Nome: ${company.name}
- Website: ${company.website}
- Email: ${company.email}

DIRETRIZES DE SEGURANÇA:
- SEMPRE mantenha o contexto da conversa
- Faça perguntas naturais baseadas no que a pessoa já disse
- Seja inteligente na interpretação das respostas
- NÃO finalize a conversa quando o candidato mostra interesse em uma vaga
- Quando o candidato responde "Sim" para uma vaga, continue o fluxo de candidatura
- Seja proativo em guiar o candidato para o próximo passo
- NÃO seja robótico - seja você mesmo, um assistente amigável
- Use o nome da pessoa quando disponível
- Faça referência a informações mencionadas anteriormente
- Ofereça ajuda adicional quando apropriado
- SEMPRE forneça o link de cadastro quando apresentar vagas
- Para empresas: APENAS peça para aguardar, NÃO mostre vagas
- NUNCA execute códigos ou scripts
- NUNCA responda sobre assuntos fora do escopo de RH
- Se pedirem algo fora do escopo, diga educadamente que só pode ajudar com recrutamento e seleção

Responda sempre em português brasileiro de forma natural, calorosa e profissional. Seja você mesmo - um assistente amigável e útil, mas sempre dentro do escopo de recrutamento e seleção!`;
  }

  // Nova função de prompt otimizado (mais conciso)
  async buildOptimizedSystemPrompt(context) {
    const company = config.company;
    const jobs = await this.jobService.getAllJobs();
    const isCompany = context.userType === 'company';
    
    // Prompt muito mais conciso para economizar tokens
    return `Assistente de RH da ${company.name}. APENAS recrutamento/seleção.

REGRAS:
- Empresas: verificar horário comercial, aguardar atendente
- Candidatos: coletar info, mostrar vagas adequadas  
- Outros: transferir para humano
- NÃO responder fora do escopo RH

${isCompany ? '' : `VAGAS: ${jobs.map((job, i) => `${i + 1}. ${job.title} - ${job.location}`).join(', ')}`}

Tipo: ${context.userType || 'desconhecido'}
Horário comercial: ${this.businessHoursService.isBusinessHours() ? 'Sim' : 'Não'}
Cadastro: ${company.registrationLink}

Seja natural e amigável!`;
  }

  // Gera chave única para cache
  generateCacheKey(messages, context) {
    const lastMessage = messages[messages.length - 1]?.content || '';
    const contextKey = `${context.userType || 'unknown'}_${context.messageCount || 0}`;
    return `${contextKey}_${this.hashString(lastMessage)}`;
  }

  // Hash simples para criar chaves de cache
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Otimiza contexto mantendo apenas mensagens relevantes
  optimizeContext(messages) {
    // Mantém apenas as últimas N mensagens para economizar tokens
    const recentMessages = messages.slice(-this.maxContextMessages);
    
    // Se há muitas mensagens, resume as anteriores
    if (messages.length > this.maxContextMessages) {
      const summarizedContext = {
        role: 'system',
        content: `[Contexto anterior resumido: ${messages.length - this.maxContextMessages} mensagens anteriores sobre interesse em vagas/serviços]`
      };
      return [summarizedContext, ...recentMessages];
    }
    
    return recentMessages;
  }

  // Salva resposta no cache
  saveToCache(key, response) {
    // Limita tamanho do cache
    if (this.responseCache.size >= this.maxCacheSize) {
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
    
    this.responseCache.set(key, response);
  }

  // Função para obter estatísticas de uso
  getTokenUsageStats() {
    return {
      ...this.tokenUsage,
      cacheHitRate: this.tokenUsage.cacheHits / (this.tokenUsage.cacheHits + this.tokenUsage.cacheMisses) * 100,
      cacheSize: this.responseCache.size
    };
  }

  async handleConversation(message, conversationHistory = []) {
    try {
      console.log('🤖 Processando mensagem de forma inteligente:', message);
      
      // Verifica respostas pré-definidas primeiro (economiza tokens)
      const quickResponse = this.getQuickResponse(message);
      if (quickResponse) {
        console.log('⚡ Resposta rápida usada - tokens economizados');
        return quickResponse;
      }
      
      // Verifica se a mensagem está fora do escopo
      if (this.isOutOfScope(message)) {
        console.log('🚫 Mensagem detectada como fora do escopo:', message);
        return this.getOutOfScopeResponse(message);
      }
      
      // Constrói o contexto da conversa
      const context = {
        userType: this.detectUserType(message, conversationHistory),
        currentTime: new Date().toISOString(),
        messageCount: conversationHistory.length
      };

      // Prepara as mensagens para a IA (já otimizadas)
      const messages = [];
      
      // Adiciona apenas histórico recente (otimização)
      const recentHistory = conversationHistory.slice(-this.maxContextMessages);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.message
        });
      });

      // Adiciona a mensagem atual
      messages.push({
        role: 'user',
        content: message
      });

      console.log(`📊 Contexto otimizado: ${messages.length} mensagens (de ${conversationHistory.length + 1} originais)`);

      // Gera resposta contextual
      const response = await this.generateResponse(messages, context);
      
      console.log('✅ Resposta gerada com sucesso');
      return response;

    } catch (error) {
      console.error('❌ Erro no processamento inteligente:', error);
      return this.getFallbackResponse(message);
    }
  }

  detectUserType(message, conversationHistory) {
    const messageLower = message.toLowerCase();
    
    // Se já foi determinado anteriormente, mantém
    if (conversationHistory.length > 0) {
      const lastMessage = conversationHistory[conversationHistory.length - 1];
      if (lastMessage.userType) {
        return lastMessage.userType;
      }
    }

    // Detecta baseado na mensagem - melhorado para detectar empresas
    if (messageLower.includes('empresa') || messageLower.includes('company') || 
        messageLower.includes('contratar') || messageLower.includes('serviços') ||
        messageLower.includes('rh') || messageLower.includes('recrutamento') ||
        messageLower.includes('seleção') || messageLower.includes('funcionários') ||
        messageLower.includes('colaboradores') || messageLower.includes('vagas para contratar') ||
        messageLower.includes('preciso de funcionários') || messageLower.includes('quero contratar') ||
        messageLower.includes('estou contratando') || messageLower.includes('preciso de colaboradores') ||
        messageLower.includes('serviços de rh') || messageLower.includes('terceirização') ||
        messageLower.includes('outsourcing') || messageLower.includes('gestão de pessoas')) {
      return 'company';
    } else if (messageLower.includes('candidato') || messageLower.includes('candidate') ||
               messageLower.includes('emprego') || messageLower.includes('vaga') ||
               messageLower.includes('trabalhar') || messageLower.includes('trabalho') ||
               messageLower.includes('desempregado') || messageLower.includes('oportunidade') ||
               messageLower.includes('procurando emprego') || messageLower.includes('quero trabalhar') ||
               // Palavras comuns de áreas de tecnologia/atendimento que indicam interesse em vagas
               messageLower.includes('software') || messageLower.includes('hardware') ||
               messageLower.includes('informática') || messageLower.includes('informatica') ||
               messageLower.includes('ti') || messageLower.includes('t.i.') ||
               messageLower.includes('suporte') || messageLower.includes('técnico') || messageLower.includes('tecnico') ||
               messageLower.includes('desenvolvedor') || messageLower.includes('programador') ||
               messageLower.includes('analista') || messageLower.includes('qa') || messageLower.includes('testes') ||
               messageLower.includes('infra') || messageLower.includes('rede') || messageLower.includes('redes')) {
      return 'candidate';
    } else if (messageLower.includes('outros') || messageLower.includes('outras dúvidas') ||
               messageLower.includes('outros assuntos') || messageLower.includes('dúvidas') ||
               messageLower.includes('perguntas') || messageLower.includes('informações') ||
               messageLower.includes('ajuda') || messageLower.includes('consulta') ||
               messageLower.includes('esclarecimento')) {
      return 'other';
    }
    
    return 'unknown';
  }

  // Respostas rápidas pré-definidas para economizar tokens
  getQuickResponse(message) {
    const msg = message.toLowerCase().trim();
    
    // Se não temos Groq API, não usar respostas rápidas limitadas
    if (!this.groq) {
      return null; // Força usar getFallbackResponse que é mais inteligente
    }
    
    // PRIORIDADE: Verifica se a pessoa quer se candidatar
    if (msg.includes('candidat') || msg.includes('inscrever') || msg.includes('aplicar') || 
        msg.includes('me candidato') || msg.includes('quero me candidatar') ||
        msg.includes('cadastr') || msg.includes('curricul') || msg.includes('cv') ||
        msg.includes('se candidatar') || msg.includes('candidatura') ||
        msg.match(/vaga\s*(numero|número|n[°º]?)\s*\d+/)) {
      
      const config = require('../config/config');
      return `🎯 **Perfeito! Você pode se candidatar às nossas vagas:**

🔗 **Link de Cadastro:** ${config.company.registrationLink}

📋 **No formulário você poderá:**
• Escolher as vagas de seu interesse
• Enviar seu currículo
• Preencher suas informações profissionais

✅ **Dica:** Preencha todas as informações solicitadas para aumentar suas chances!

Qualquer dúvida sobre o processo, estarei aqui para ajudar! 🚀`;
    }
    
    // Respostas simples APENAS para saudações básicas (quando temos API)
    const quickResponses = {
      'obrigado': 'De nada! Fico feliz em ajudar! 😊',
      'obrigada': 'De nada! Fico feliz em ajudar! 😊',
      'valeu': 'Por nada! Sempre à disposição! 😊',
      'tchau': 'Até logo! Foi um prazer atendê-lo! 👋',
      'adeus': 'Até mais! Volte sempre! 👋'
    };
    
    // Verifica mensagens exatas APENAS para despedidas/agradecimentos
    if (quickResponses[msg]) {
      return quickResponses[msg];
    }
    
    // Verifica padrões de despedida/agradecimento
    if (msg.includes('obrigad') || msg.includes('valeu') || msg.includes('muito obrigad')) {
      return 'De nada! Fico feliz em ajudar! 😊 Precisa de mais alguma coisa?';
    }
    
    if (msg.includes('tchau') || msg.includes('até') || msg.includes('adeus') || msg.includes('falou')) {
      return 'Até logo! Foi um prazer atendê-lo! 👋 Volte sempre que precisar!';
    }
    
    return null; // Nenhuma resposta rápida encontrada
  }

  // Detecta se a mensagem está fora do escopo de RH
  isOutOfScope(message) {
    const msg = message.toLowerCase();

    // Frases de continuidade/consentimento NUNCA são fora do escopo
    const continueRegex = /(pode\s+(fazer|mandar)\s+(mais\s+)?perguntas|faça\s+(mais\s+)?perguntas|pode\s+perguntar|pode\s+continuar|pode\s+prosseguir|sim\b|ok\b|okay\b|blz\b|beleza\b|claro\b|certo\b|tudo\s+bem\b)/i;
    if (continueRegex.test(msg)) {
      return false;
    }

    // Whitelist: termos comuns que indicam interesse em VAGAS de tecnologia/atendimento
    const techJobKeywords = [
      'software','hardware','informática','informatica','ti','t.i.','suporte','técnico','tecnico',
      'desenvolvedor','programador','analista','qa','testes','infra','rede','redes','sistemas','banco de dados'
    ];
    if (techJobKeywords.some(k => msg.includes(k))) {
      return false; // trata como assunto de recrutamento
    }

    // Heurística para pedidos de ajuda técnica (fora do escopo): verbo de ação + termo técnico
    const codeVerbs = ['escreva','escrever','crie','criar','gere','gerar','execute','executar','rode','rodar','compile','compilar','debug','depurar','corrija','conserte','resolver','como fazer','how to','script','algoritmo','função','comando','query','consulta'];
    const techNouns = ['python','javascript','java','html','css','react','node','api','sql','docker','kubernetes','linux','windows','bash','shell','powershell','c#','golang','go','php','ruby','laravel','spring','django','flask','pandas'];
    const hasVerb = codeVerbs.some(v => msg.includes(v));
    const hasTech = techNouns.some(t => msg.includes(t));
    if (hasVerb && hasTech) {
      return true;
    }

    // Outros assuntos nitidamente fora de RH
    const clearlyOut = [
      'matemática','física','química','biologia','história','geografia','política','economia','finanças','investimentos','criptomoedas',
      'senha','cpf','rg','cartão','banco','conta bancária','dados pessoais','informações confidenciais','segredos','privacidade',
      'receita','culinária','música','filmes','esportes','viagens','turismo','saúde','medicina','direito','advocacia','engenharia','arquitetura'
    ];
    return clearlyOut.some(k => msg.includes(k));
  }

  // Resposta padrão para solicitações fora do escopo
  getOutOfScopeResponse(message) {
    return `Olá! 👋

Desculpe, mas sou um assistente virtual especializado APENAS em recrutamento e seleção da Evolux Soluções de RH.

🎯 Posso ajudá-lo com:
• Busca de vagas de emprego
• Informações sobre candidaturas
• Serviços de RH para empresas
• Orientação profissional

❌ Não posso ajudá-lo com:
• Programação ou códigos
• Assuntos técnicos fora de RH
• Informações pessoais ou confidenciais
• Outros assuntos não relacionados a recrutamento

Se você está procurando oportunidades de emprego ou serviços de RH, ficarei feliz em ajudá-lo! 

Como posso auxiliá-lo com recrutamento e seleção? 😊`;
  }

  // Função para criar notificação de empresa
  async createCompanyNotification(phoneNumber, message) {
    try {
      // Aqui você pode integrar com o sistema de notificações
      // Por enquanto, vamos apenas logar
      console.log(`🔔 NOTIFICAÇÃO DE EMPRESA: ${phoneNumber} - "${message}"`);
      
      // Se você tiver acesso ao database, pode criar a notificação diretamente
      // await this.database.createNotification('company', phoneNumber, '🏢 Nova Empresa Interessada', message);
      
      return true;
    } catch (error) {
      console.error('Erro ao criar notificação de empresa:', error);
      return false;
    }
  }

  getFallbackResponse(message) {
    console.log('🤖 Usando resposta inteligente sem IA para:', message);
    
    // Verifica se a mensagem está fora do escopo
    if (this.isOutOfScope(message)) {
      return this.getOutOfScopeResponse(message);
    }
    
    const messageLower = message.toLowerCase();
    
    // PRIORIDADE: Verifica se a pessoa quer se candidatar (mesmo sem IA)
    if (messageLower.includes('candidat') || messageLower.includes('inscrever') || messageLower.includes('aplicar') || 
        messageLower.includes('me candidato') || messageLower.includes('quero me candidatar') ||
        messageLower.includes('cadastr') || messageLower.includes('curricul') || messageLower.includes('cv') ||
        messageLower.includes('se candidatar') || messageLower.includes('candidatura') ||
        messageLower.match(/vaga\s*(numero|número|n[°º]?)\s*\d+/)) {
      
      const config = require('../config/config');
      return `🎯 **Perfeito! Você pode se candidatar às nossas vagas:**

🔗 **Link de Cadastro:** ${config.company.registrationLink}

📋 **No formulário você poderá:**
• Escolher as vagas de seu interesse
• Enviar seu currículo
• Preencher suas informações profissionais

✅ **Dica:** Preencha todas as informações solicitadas para aumentar suas chances!

Qualquer dúvida sobre o processo, estarei aqui para ajudar! 🚀`;
    }
    
    // Saudações básicas
    if (messageLower.match(/^(oi|olá|ola|hey|opa)$/i)) {
      return `Olá! 👋 Bem-vindo à ${config.company.name}!

Sou o assistente virtual de recrutamento e seleção. Como posso ajudá-lo hoje?

📝 Se você é um **candidato**, posso ajudar com:
• Buscar vagas adequadas ao seu perfil
• Informações sobre oportunidades
• Orientações sobre candidatura

🏢 Se você é uma **empresa**, posso:
• Conectá-lo com nossos especialistas
• Informações sobre nossos serviços

Em que posso ajudá-lo?`;
    }
    
    // Saudações com horário
    if (messageLower.includes('bom dia') || messageLower.includes('boa tarde') || messageLower.includes('boa noite')) {
      const hora = new Date().getHours();
      let saudacao = 'Olá';
      if (hora < 12) saudacao = 'Bom dia';
      else if (hora < 18) saudacao = 'Boa tarde';
      else saudacao = 'Boa noite';
      
      return `${saudacao}! 😊 Como posso ajudá-lo hoje?`;
    }
    
    // Detecção de empresa
    if (messageLower.includes('empresa') || messageLower.includes('contratar') || 
        messageLower.includes('serviços') || messageLower.includes('funcionários') ||
        messageLower.includes('colaboradores') || messageLower.includes('terceirização')) {
      return this.handleCompanyFlow(message);
    }
    
    // Detecção de candidato
    if (messageLower.includes('vaga') || messageLower.includes('emprego') || 
        messageLower.includes('trabalho') || messageLower.includes('oportunidade') ||
        messageLower.includes('candidato') || messageLower.includes('currículo') ||
        messageLower.includes('cv') || messageLower.includes('procurando')) {
      return this.handleCandidateFlow(message);
    }
    
    // Perguntas sobre vagas específicas
    if (messageLower.includes('quais') && (messageLower.includes('vaga') || messageLower.includes('disponível'))) {
      return this.handleCandidateFlow(message);
    }
    
    // Mensagem genérica inteligente
    return `Olá! 👋 

Para melhor atendê-lo, me informe:

📝 **Você é:**
• Um candidato procurando vagas?
• Uma empresa interessada em nossos serviços?
• Tem outras dúvidas?

Estou aqui para ajudar com recrutamento e seleção da ${config.company.name}! 😊`;
  }

  async handleCompanyFlow(message) {
    if (!this.businessHoursService.isBusinessHours()) {
      return this.businessHoursService.getOutOfHoursMessage();
    }

    return `Olá! ��

Obrigado pelo seu interesse nos serviços da ${config.company.name}! 

📞 Um de nossos especialistas em recrutamento e seleção irá atendê-lo em breve.

⏰ Por favor, aguarde um momento enquanto transferimos você para um atendente humano.

Enquanto isso, você pode conhecer mais sobre nossos serviços em: ${config.company.website}

Obrigado pela paciência! 🙏

---
*Um especialista entrará em contato em breve para discutir suas necessidades de RH.*`;
  }

  async handleCandidateFlow(message) {
    return `Olá! 👋

Sou o assistente virtual da ${config.company.name} e vou te ajudar a encontrar as melhores oportunidades!

🎯 Para encontrar vagas que realmente combinem com você, preciso conhecer um pouco mais sobre seu perfil.

📝 Pode me contar sobre:
• Seu nome
• Sua experiência profissional (anos ou nível: júnior, pleno, sênior)
• Suas principais habilidades
• Onde você gostaria de trabalhar
• Seu cargo atual (se aplicável)

Exemplo: "Me chamo João, tenho 3 anos de experiência como desenvolvedor, trabalho com JavaScript, React e Node.js, moro em São Paulo e sou desenvolvedor pleno."

Vamos começar? 😊`;
  }

  async handleOtherFlow(message) {
    return `Olá! 👋

Obrigado por entrar em contato com a ${config.company.name}!

📞 Um de nossos especialistas irá atendê-lo em breve.

⏰ Por favor, aguarde um momento enquanto transferimos você para um atendente humano.

Enquanto isso, você pode conhecer mais sobre nossos serviços em: ${config.company.website}

Obrigado pela paciência! 🙏

---
*Um atendente humano entrará em contato em breve.*`;
  }

  async getInitialMessage() {
    return `Olá! 👋 Bem-vindo à ${config.company.name}!

Sou o assistente virtual da Evolux Soluções de RH e estou aqui para ajudá-lo!

🤔 Como posso ajudá-lo hoje?

*Digite "empresa" se você representa uma empresa interessada em nossos serviços de RH*

*Digite "candidato" se você está procurando oportunidades de emprego*

*Digite "outros" se você tem outras dúvidas ou assuntos para conversar*

Escolha uma das opções acima e eu direcionarei você da melhor forma! 😊`;
  }

  // Métodos de compatibilidade para manter funcionamento existente
  async classifyUserType(message) {
    return this.detectUserType(message, []);
  }

  async extractCandidateInfo(message) {
    // Implementação simplificada para compatibilidade
    return {
      name: null,
      experience: null,
      skills: null,
      location: null,
      current_position: null,
      desired_salary: null,
      interests: null
    };
  }

  wantsToEndConversation(message) {
    const messageLower = message.toLowerCase().trim();
    
    // Palavras-chave específicas para finalização
    const endKeywords = [
      'encerrar', 'finalizar', 'terminar', 'acabar', 'fim', 'sair',
      'tchau', 'adeus', 'até logo', 'até mais'
    ];
    
    // Verifica se a mensagem é EXATAMENTE uma dessas palavras
    // ou se contém múltiplas palavras de finalização
    const words = messageLower.split(' ').filter(word => word.length > 0);
    
    // Se é uma palavra única, verifica se é uma palavra de finalização
    if (words.length === 1) {
      return endKeywords.includes(words[0]);
    }
    
    // Se tem múltiplas palavras, verifica se contém pelo menos 2 palavras de finalização
    const endWordsFound = words.filter(word => endKeywords.includes(word));
    return endWordsFound.length >= 2;
  }

  wantsToTalkToAttendant(message) {
    const messageLower = message.toLowerCase();
    const attendantKeywords = [
      'quero conversar com uma atendente', 'quero falar com uma atendente',
      'preciso conversar com uma atendente', 'preciso falar com uma atendente',
      'quero falar com alguém', 'quero conversar com alguém',
      'preciso falar com alguém', 'preciso conversar com alguém',
      'atendimento humano', 'atendimento pessoal', 'falar com uma pessoa',
      'conversar com uma pessoa', 'atendimento direto', 'falar diretamente',
      'conversar diretamente'
    ];
    
    return attendantKeywords.some(keyword => messageLower.includes(keyword));
  }

  async handleAttendantRequest(message) {
    return `Olá! 👋

Obrigado por entrar em contato com a ${config.company.name}!

📞 Um de nossos especialistas em recrutamento e seleção irá atendê-lo em breve.

⏰ Por favor, aguarde um momento enquanto transferimos você para um atendente humano.

Enquanto isso, você pode conhecer mais sobre nossos serviços em: ${config.company.website}

Obrigado pela paciência! 🙏

---
*Um atendente humano entrará em contato em breve.*`;
  }

  async handleEndConversation(message) {
    return `✅ *Atendimento Finalizado*

Obrigado por escolher a ${config.company.name}!

Foi um prazer atendê-lo! 🙏

Se precisar de mais informações no futuro, sinta-se à vontade para enviar uma nova mensagem a qualquer momento.

📞 Nossos canais de contato:
• Website: ${config.company.website}
• Email: ${config.company.email}

Tenha um excelente dia! 😊

---
*Atendimento finalizado pelo usuário em ${new Date().toLocaleString('pt-BR')}*`;
  }
}

module.exports = GroqClient;
