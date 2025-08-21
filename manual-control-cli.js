#!/usr/bin/env node

const readline = require('readline');
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';

class ManualControlCLI {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  async checkWhatsAppStatus() {
    try {
      const response = await axios.get(`${API_BASE_URL}/whatsapp/status`);
      return response.data.connected;
    } catch (error) {
      console.error('❌ Erro ao verificar status do WhatsApp:', error.message);
      return false;
    }
  }

  async getStats() {
    try {
      const response = await axios.get(`${API_BASE_URL}/stats`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error.message);
      return null;
    }
  }

  async takeControl(phoneNumber, agentId) {
    try {
      const response = await axios.post(`${API_BASE_URL}/whatsapp/take-control`, {
        phoneNumber,
        agentId
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao assumir controle:', error.response?.data?.error || error.message);
      return null;
    }
  }

  async markFirstMessageHandled(phoneNumber) {
    try {
      const response = await axios.post(`${API_BASE_URL}/whatsapp/first-message-handled`, {
        phoneNumber
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao marcar primeira mensagem:', error.response?.data?.error || error.message);
      return null;
    }
  }

  async checkFirstMessageStatus(phoneNumber) {
    try {
      const response = await axios.get(`${API_BASE_URL}/whatsapp/first-message-status/${phoneNumber}`);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao verificar primeira mensagem:', error.response?.data?.error || error.message);
      return null;
    }
  }

  async releaseControl(phoneNumber) {
    try {
      console.log('⚠️  ATENÇÃO: Esta ação irá FINALIZAR a conversa permanentemente!');
      console.log('📝 O usuário receberá uma mensagem de finalização.');
      console.log('🗑️  A conversa será removida da lista de conversas ativas.');
      console.log('');
      
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        rl.question('Tem certeza que deseja finalizar a conversa? (s/N): ', resolve);
      });
      
      rl.close();

      if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'sim') {
        console.log('❌ Operação cancelada pelo usuário.');
        return null;
      }

      const response = await axios.post(`${API_BASE_URL}/whatsapp/release-control`, {
        phoneNumber
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao finalizar conversa:', error.response?.data?.error || error.message);
      return null;
    }
  }

  async checkControlStatus(phoneNumber) {
    try {
      const response = await axios.get(`${API_BASE_URL}/whatsapp/control-status/${phoneNumber}`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Erro ao verificar status de controle:', error.response?.data?.error || error.message);
      return null;
    }
  }

  async sendMessage(phoneNumber, message) {
    try {
      const response = await axios.post(`${API_BASE_URL}/whatsapp/send`, {
        phoneNumber,
        message
      });
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error.response?.data?.error || error.message);
      return null;
    }
  }

  displayStats(stats) {
    console.log('\n📊 ESTATÍSTICAS ATUAIS:');
    console.log('='.repeat(50));
    console.log(`🔗 WhatsApp conectado: ${stats.whatsappConnected ? '✅' : '❌'}`);
    console.log(`📱 Conversas ativas: ${stats.activeConversations.total}`);
    console.log(`👤 Controle manual: ${stats.activeConversations.manualControl.total}`);
    console.log(`💼 Vagas ativas: ${stats.activeJobs}`);
    
    if (stats.activeConversations.conversations.length > 0) {
      console.log('\n📱 CONVERSAS ATIVAS:');
      stats.activeConversations.conversations.forEach(conv => {
        console.log(`  • ${conv.phoneNumber} (${conv.timeRemaining}s restantes)`);
      });
    }
    
    if (stats.activeConversations.manualControl.conversations.length > 0) {
      console.log('\n👤 CONTROLE MANUAL:');
      stats.activeConversations.manualControl.conversations.forEach(conv => {
        console.log(`  • ${conv.phoneNumber} - ${conv.manualControl.agentId}`);
      });
    }
  }

  displayMenu() {
    console.log('\n🎛️  CONTROLE MANUAL - EVOLUX AGENT');
    console.log('='.repeat(50));
    console.log('1. 📊 Ver estatísticas');
    console.log('2. 👤 Assumir controle de conversa');
    console.log('3. 🔚 Finalizar conversa');
    console.log('4. 📱 Enviar mensagem manual');
    console.log('5. 🔍 Verificar status de controle');
    console.log('6. 🆕 Marcar primeira mensagem como tratada');
    console.log('7. 🔍 Verificar primeira mensagem');
    console.log('8. 🔄 Atualizar estatísticas');
    console.log('0. ❌ Sair');
    console.log('='.repeat(50));
  }

  async run() {
    console.log('🚀 Iniciando CLI de Controle Manual...');
    
    // Verifica se o WhatsApp está conectado
    const isConnected = await this.checkWhatsAppStatus();
    if (!isConnected) {
      console.log('❌ WhatsApp não está conectado. Inicie o agente primeiro.');
      this.rl.close();
      return;
    }
    
    console.log('✅ WhatsApp conectado!');

    while (true) {
      this.displayMenu();
      const choice = await this.question('\nEscolha uma opção: ');

      switch (choice) {
        case '1':
        case '6':
          const stats = await this.getStats();
          if (stats) {
            this.displayStats(stats);
          }
          break;

        case '2':
          const phoneNumber = await this.question('Digite o número do telefone: ');
          const agentId = await this.question('Digite o ID do agente (ou pressione Enter para "human"): ') || 'human';
          
          const takeResult = await this.takeControl(phoneNumber, agentId);
          if (takeResult?.success) {
            console.log('✅ Controle assumido com sucesso!');
            console.log(`👤 Agente: ${takeResult.data.agentId}`);
            console.log(`⏰ Assumido em: ${takeResult.data.takenAt}`);
          }
          break;

        case '3':
          const phoneToRelease = await this.question('Digite o número do telefone: ');
          
          const releaseResult = await this.releaseControl(phoneToRelease);
          if (releaseResult?.success) {
            console.log('✅ Conversa finalizada com sucesso!');
            console.log(`📱 Telefone: ${releaseResult.data.phoneNumber}`);
            console.log(`⏰ Finalizada em: ${releaseResult.data.finalizedAt}`);
            console.log(`📝 Mensagem enviada: ${releaseResult.data.finalMessage ? 'Sim' : 'Não'}`);
          }
          break;

        case '4':
          const phoneToMessage = await this.question('Digite o número do telefone: ');
          const message = await this.question('Digite a mensagem: ');
          
          const sendResult = await this.sendMessage(phoneToMessage, message);
          if (sendResult?.success) {
            console.log('✅ Mensagem enviada com sucesso!');
          }
          break;

        case '5':
          const phoneToCheck = await this.question('Digite o número do telefone: ');
          
          const statusResult = await this.checkControlStatus(phoneToCheck);
          if (statusResult) {
            console.log('\n📋 STATUS DE CONTROLE:');
            console.log(`📱 Telefone: ${statusResult.phoneNumber}`);
            console.log(`👤 Controle manual: ${statusResult.isManualControl ? '✅' : '❌'}`);
            
            if (statusResult.manualInfo) {
              console.log(`👤 Agente: ${statusResult.manualInfo.agentId}`);
              console.log(`⏰ Assumido em: ${statusResult.manualInfo.takenAt}`);
            }
          }
          break;

        case '6':
          const phoneToHandle = await this.question('Digite o número do telefone: ');
          
          const handleResult = await this.markFirstMessageHandled(phoneToHandle);
          if (handleResult?.success) {
            console.log('✅ Primeira mensagem marcada como tratada!');
            console.log(`⏰ Tratada em: ${handleResult.data.handledAt}`);
          }
          break;

        case '7':
          const phoneToCheckFirst = await this.question('Digite o número do telefone: ');
          
          const firstMessageResult = await this.checkFirstMessageStatus(phoneToCheckFirst);
          if (firstMessageResult) {
            console.log('\n📋 STATUS DA PRIMEIRA MENSAGEM:');
            console.log(`📱 Telefone: ${firstMessageResult.data.phoneNumber}`);
            console.log(`🆕 É primeira mensagem: ${firstMessageResult.data.isFirstMessage ? '✅' : '❌'}`);
          }
          break;

        case '8':
          const stats = await this.getStats();
          if (stats) {
            this.displayStats(stats);
          }
          break;

        case '0':
          console.log('👋 Saindo...');
          this.rl.close();
          return;

        default:
          console.log('❌ Opção inválida!');
      }

      await this.question('\nPressione Enter para continuar...');
    }
  }
}

// Executa o CLI
const cli = new ManualControlCLI();
cli.run().catch(console.error);
