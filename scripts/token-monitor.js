#!/usr/bin/env node

const axios = require('axios');

async function monitorTokenUsage() {
  try {
    console.log('💰 Monitor de Tokens Groq - Otimizado para Economia\n');

    const response = await axios.get('http://localhost:3000/token-stats');
    
    if (response.data.success) {
      const stats = response.data.data;
      
      console.log('📊 **Estatísticas de Economia de Tokens**');
      console.log('==========================================');
      console.log(`🔢 Total de chamadas à API: ${stats.totalCalls}`);
      console.log(`🎯 Total de tokens utilizados: ${stats.totalTokens}`);
      console.log(`💾 Respostas do cache: ${stats.cacheHits}`);
      console.log(`❌ Chamadas à API: ${stats.cacheMisses}`);
      console.log(`📈 Taxa de economia (cache): ${stats.cacheHitRate.toFixed(2)}%`);
      console.log(`🗂️ Tamanho do cache: ${stats.cacheSize}/100 entradas`);
      
      if (stats.totalCalls > 0) {
        const avgTokensPerCall = stats.totalTokens / stats.totalCalls;
        console.log(`\n💡 **Análise de Economia:**`);
        console.log(`📊 Média de tokens por chamada: ${avgTokensPerCall.toFixed(2)}`);
        
        const tokensSaved = stats.cacheHits * avgTokensPerCall;
        console.log(`💸 Tokens economizados pelo cache: ~${tokensSaved.toFixed(0)}`);
        
        const totalWithoutOptimization = stats.totalTokens + tokensSaved;
        const savingsPercentage = (tokensSaved / totalWithoutOptimization) * 100;
        console.log(`🎉 Economia total estimada: ~${savingsPercentage.toFixed(1)}%`);
        
        // Estimativa de custo economizado (valores aproximados)
        const costPerToken = 0.00001; // Estimativa
        const costSaved = tokensSaved * costPerToken;
        console.log(`💵 Economia estimada em custo: $${costSaved.toFixed(4)}`);
      }
      
      console.log(`\n✅ **Otimizações Ativas:**`);
      console.log(`- ✅ Cache de respostas similares (até 100 entradas)`);
      console.log(`- ✅ Contexto limitado (5 mensagens recentes)`);
      console.log(`- ✅ Prompt system otimizado (reduzido em ~70%)`);
      console.log(`- ✅ Respostas rápidas pré-definidas`);
      console.log(`- ✅ Máximo de tokens reduzido (600 por resposta)`);
      
      console.log(`\n⏰ Última atualização: ${new Date(stats.timestamp).toLocaleString('pt-BR')}`);
      
    } else {
      console.log('❌ Erro:', response.data.error);
      if (response.data.data) {
        console.log('📋 Sistema ainda não recebeu mensagens');
      }
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Servidor não está rodando.');
      console.log('🚀 Para iniciar: npm run start:whatsapp');
    } else {
      console.log('❌ Erro:', error.message);
    }
  }
}

// Executa o monitor
monitorTokenUsage();

// Se chamado com --watch, monitora continuamente
if (process.argv.includes('--watch')) {
  console.log('\n🔄 Modo de monitoramento contínuo ativado (a cada 30s)...\n');
  setInterval(() => {
    console.clear();
    monitorTokenUsage();
  }, 30000);
}
