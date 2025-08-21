# 🔄 Fluxo Atualizado do Agente Evolux

Este documento explica o novo fluxo implementado que atende aos requisitos solicitados.

## 🎯 **Principais Melhorias Implementadas**

### **1. Controle de Primeira Mensagem**
- ✅ **Primeira mensagem não aciona chatbot automaticamente**
- ✅ **Aguarda liberação manual** antes de processar com IA
- ✅ **Mensagem informativa** para o usuário aguardar atendente
- ✅ **Sistema de liberação** via API ou CLI

### **2. Fluxo Específico por Tipo de Usuário**
- ✅ **Empresas:** Pedido de atendente humano + aguardar resposta
- ✅ **Candidatos:** Mostrar vagas + direcionar para Pipefy
- ✅ **Detecção inteligente** de intenções específicas

### **3. Sistema de Controle Manual**
- ✅ **Assumir controle** de conversas específicas
- ✅ **Liberar controle** para voltar ao processamento automático
- ✅ **Monitoramento** em tempo real
- ✅ **Persistência** no banco de dados

## 🔄 **Fluxo Completo**

### **1. Primeira Mensagem (Qualquer Usuário)**
```
Usuário envia mensagem → Sistema salva mas não processa → Envia mensagem informativa → Aguarda liberação manual
```

**Mensagem enviada:**
```
🆕 **Nova Mensagem Recebida**

Olá! Recebemos sua mensagem e um de nossos especialistas irá atendê-lo em breve.

⏰ Por favor, aguarde um momento enquanto um atendente humano assume o atendimento.

📞 Nossos especialistas estão prontos para ajudá-lo com:
• Busca de vagas de emprego
• Serviços de RH para empresas
• Orientação profissional
• Informações sobre candidaturas

Obrigado pela paciência! 🙏

---
*Um atendente humano entrará em contato em breve.*
```

### **2. Liberação Manual**
```
Atendente libera via CLI/API → Sistema marca como tratada → Chatbot começa a processar normalmente
```

### **3. Fluxo para Empresas**
```
Empresa envia mensagem → Sistema detecta como empresa → Verifica intenção:

• Se pedir atendente: "Um especialista irá atendê-lo em breve"
• Se quer contratar Evolux: "Um especialista irá discutir suas necessidades"
• Padrão: Aguardar atendente humano
```

### **4. Fluxo para Candidatos**
```
Candidato envia mensagem → Sistema detecta como candidato → Verifica intenção:

• Se pedir vagas: Mostra vagas disponíveis + link Pipefy
• Se tentar enviar currículo: Direciona para Pipefy
• Se pedir atendente: "Um especialista irá atendê-lo"
• Padrão: Coleta informações do perfil
```

## 🛠️ **Como Usar**

### **1. Liberar Primeira Mensagem**
```bash
# Via CLI
npm run cli
# Opção 6: Marcar primeira mensagem como tratada

# Via API
curl -X POST http://localhost:3000/whatsapp/first-message-handled \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"5511999999999@c.us"}'
```

### **2. Assumir Controle Manual**
```bash
# Via CLI
npm run cli
# Opção 2: Assumir controle de conversa

# Via API
curl -X POST http://localhost:3000/whatsapp/take-control \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"5511999999999@c.us","agentId":"atendente_joao"}'
```

### **3. Liberar Controle Manual**
```bash
# Via CLI
npm run cli
# Opção 3: Liberar controle de conversa

# Via API
curl -X POST http://localhost:3000/whatsapp/release-control \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"5511999999999@c.us"}'
```

## 📋 **Exemplos de Fluxo**

### **Exemplo 1: Empresa Quer Contratar**
```
Empresa: "Olá, somos uma empresa e queremos contratar a Evolux para RH"

Sistema: "🏢 **Interesse em Serviços da Evolux**

Obrigado pelo seu interesse nos serviços da Evolux Soluções de RH!

📞 Um de nossos especialistas em recrutamento e seleção irá atendê-lo em breve para discutir suas necessidades.

⏰ Por favor, aguarde um momento enquanto transferimos você para um atendente humano.

Enquanto isso, você pode conhecer mais sobre nossos serviços em: https://evoluxrh.com.br

Obrigado pela paciência! 🙏

---
*Um especialista entrará em contato em breve para discutir suas necessidades de RH.*"
```

### **Exemplo 2: Candidato Quer Ver Vagas**
```
Candidato: "Oi, vocês têm vagas disponíveis?"

Sistema: "🎯 **Vagas Encontradas para Você:**

1. 🏢 **Desenvolvedor Full Stack**
📊 Senioridade: Pleno
📍 Localização: São Paulo - SP
📝 Desenvolvimento de aplicações web completas com React, Node.js e banco de dados

2. 🏢 **Analista de Dados**
📊 Senioridade: Sênior
📍 Localização: Remoto
📝 Análise de dados, criação de dashboards e relatórios com Python e SQL

📋 **Para se candidatar, acesse:** https://app.pipefy.com/public/form/a19wdDh_

💡 **Dica:** No formulário você poderá selecionar as vagas de interesse e enviar seu currículo.

Obrigado pelo interesse! 🚀

---
*Use o link acima para se candidatar às vagas de interesse.*"
```

### **Exemplo 3: Candidato Tenta Enviar Currículo**
```
Candidato: "Quero enviar meu currículo"

Sistema: "📄 **Envio de Currículo**

Para enviar seu currículo e se candidatar às vagas, acesse nosso formulário oficial:

🔗 **Link para Candidatura:** https://app.pipefy.com/public/form/a19wdDh_

📝 **No formulário você poderá:**
• Enviar seu currículo
• Preencher informações detalhadas
• Selecionar vagas de interesse
• Acompanhar o status da candidatura

💡 **Dica:** Mantenha seu currículo atualizado e detalhe suas experiências e habilidades.

Obrigado pelo interesse em fazer parte da nossa equipe! 🚀

---
*Use o link acima para enviar seu currículo de forma segura e organizada.*"
```

## 🔧 **Configuração**

### **1. Variáveis de Ambiente**
```env
# Link do Pipefy (já configurado)
REGISTRATION_LINK=https://app.pipefy.com/public/form/a19wdDh_

# Outras configurações
GROQ_API_KEY=sua_chave_aqui
WHATSAPP_NUMBER=5511999999999
```

### **2. Banco de Dados**
O sistema automaticamente cria as novas tabelas com:
- `is_first_message`: Controla primeira mensagem
- `manual_control_enabled`: Controla modo manual
- `agent_id`: Identifica quem assumiu controle
- `manual_control_taken_at`: Timestamp do controle

## 📊 **Monitoramento**

### **1. Verificar Status**
```bash
# Status de controle manual
curl http://localhost:3000/whatsapp/control-status/5511999999999@c.us

# Status de primeira mensagem
curl http://localhost:3000/whatsapp/first-message-status/5511999999999@c.us

# Estatísticas gerais
curl http://localhost:3000/stats
```

### **2. Logs do Sistema**
```
🆕 Primeira mensagem de 5511999999999@c.us - aguardando liberação manual
👤 Controle manual habilitado para 5511999999999@c.us por atendente_joao
👤 Mensagem de 5511999999999@c.us em controle manual - ignorando IA
🤖 Controle manual desabilitado para 5511999999999@c.us
✅ Primeira mensagem marcada como tratada para 5511999999999@c.us
```

## 🎯 **Casos de Uso**

### **1. Atendimento Inicial**
1. Cliente envia primeira mensagem
2. Sistema responde informando que aguardará atendente
3. Atendente verifica e libera via CLI/API
4. Chatbot assume o atendimento automaticamente

### **2. Intervenção Humana**
1. Chatbot está atendendo normalmente
2. Atendente detecta necessidade de intervenção
3. Assume controle manual via CLI/API
4. Atende pessoalmente
5. Libera controle quando necessário

### **3. Escalação Automática**
1. Sistema detecta empresa querendo contratar
2. Automaticamente pede para aguardar atendente
3. Atendente assume controle
4. Processa solicitação da empresa

## 🚀 **Benefícios**

### **1. Controle Total**
- ✅ Primeira mensagem sempre revisada por humano
- ✅ Intervenção manual quando necessário
- ✅ Transição suave entre IA e humano

### **2. Fluxo Inteligente**
- ✅ Detecção automática de intenções
- ✅ Respostas específicas por tipo de usuário
- ✅ Direcionamento correto para Pipefy

### **3. Monitoramento Completo**
- ✅ Status em tempo real
- ✅ Logs detalhados
- ✅ Estatísticas atualizadas

O novo fluxo garante que todas as interações sejam controladas e direcionadas corretamente, proporcionando uma experiência superior tanto para clientes quanto para atendentes! 🎉
