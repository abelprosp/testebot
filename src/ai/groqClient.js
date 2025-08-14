const Groq = require('groq-sdk');
const config = require('../config/config');
const JobService = require('../services/jobService');
const BusinessHoursService = require('../services/businessHoursService');

class GroqClient {
  constructor() {
    this.groq = new Groq({
      apiKey: config.groq.apiKey,
    });
    this.model = config.groq.model;
    this.jobService = new JobService();
    this.businessHoursService = new BusinessHoursService();
  }

  async generateResponse(messages, context = {}) {
    try {
      const systemPrompt = await this.buildSystemPrompt(context);
      
      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ];

      const completion = await this.groq.chat.completions.create({
        messages: chatMessages,
        model: this.model,
        temperature: 0.8,
        max_tokens: 1000,
        top_p: 1,
        stream: false,
      });

      return completion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';
    } catch (error) {
      console.error('Erro na Groq API:', error);
      return 'Desculpe, estou enfrentando dificuldades técnicas. Tente novamente em alguns instantes.';
    }
  }

  async buildSystemPrompt(context) {
    const company = config.company;
    const jobs = await this.jobService.getAllJobs();
    
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
- Seja natural, caloroso e empático
- Use linguagem conversacional, não robótica
- Demonstre interesse genuíno pelo candidato/empresa
- Faça perguntas de acompanhamento quando apropriado
- Use emojis moderadamente para tornar a conversa mais amigável
- Adapte seu tom baseado no contexto da conversa
- Seja proativo em oferecer ajuda adicional

SUAS FUNÇÕES (APENAS):

1. PARA EMPRESAS (que querem contratar a Evolux):
- Verificar se está no horário comercial (8h-12h e 13h30-18h, Segunda a Sexta)
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

  async handleConversation(message, conversationHistory = []) {
    try {
      console.log('🤖 Processando mensagem de forma inteligente:', message);
      
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

      // Prepara as mensagens para a IA
      const messages = [];
      
      // Adiciona histórico da conversa
      conversationHistory.forEach(msg => {
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

  // Detecta se a mensagem está fora do escopo de RH
  isOutOfScope(message) {
    const msg = message.toLowerCase();

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
    // Verifica se a mensagem está fora do escopo
    if (this.isOutOfScope(message)) {
      return this.getOutOfScopeResponse(message);
    }
    
    const messageLower = message.toLowerCase();
    
    if (messageLower.includes('empresa') || messageLower.includes('contratar')) {
      return this.handleCompanyFlow(message);
    } else if (messageLower.includes('candidato') || messageLower.includes('emprego')) {
      return this.handleCandidateFlow(message);
    } else {
      return this.handleOtherFlow(message);
    }
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
      'tchau', 'adeus', 'até logo', 'até mais', 'obrigado', 'obrigada',
      'valeu', 'ok', 'okay', 'beleza', 'blz', 'entendi', 'compreendi',
      'perfeito', 'ótimo', 'excelente', 'muito bem', 'tudo bem', 'td bem',
      'tudo certo', 'certo', 'claro', 'entendido', 'combinado'
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
