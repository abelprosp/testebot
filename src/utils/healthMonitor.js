const { logError, logMemoryUsage, startMemoryMonitoring, stopMemoryMonitoring } = require('./logger');

class HealthMonitor {
  constructor() {
    this.startTime = Date.now();
    this.lastHealthCheck = Date.now();
    this.healthCheckInterval = null;
    this.memoryThreshold = 500; // 500MB
    this.uptimeThreshold = 24 * 60 * 60 * 1000; // 24 horas
    this.isMonitoring = false;
  }

  start() {
    if (this.isMonitoring) {
      console.log('⚠️ Monitoramento já está ativo');
      return;
    }

    console.log('🔍 Iniciando monitoramento de saúde do sistema...');
    
    // Inicia monitoramento de memória
    startMemoryMonitoring(300000); // 5 minutos
    
    // Inicia health check
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // 1 minuto
    
    this.isMonitoring = true;
    console.log('✅ Monitoramento de saúde iniciado');
  }

  stop() {
    if (!this.isMonitoring) {
      return;
    }

    console.log('🛑 Parando monitoramento de saúde...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    stopMemoryMonitoring();
    this.isMonitoring = false;
    console.log('✅ Monitoramento de saúde parado');
  }

  async performHealthCheck() {
    try {
      const now = Date.now();
      const uptime = now - this.startTime;
      const memoryUsage = process.memoryUsage();
      const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      
      // Log de uso de memória
      logMemoryUsage();
      
      // Verifica se a memória está muito alta
      if (memoryMB > this.memoryThreshold) {
        console.warn(`⚠️ Uso de memória alto: ${memoryMB}MB`);
        this.handleHighMemoryUsage();
      }
      
      // Verifica uptime
      if (uptime > this.uptimeThreshold) {
        console.log(`ℹ️ Sistema rodando há ${Math.round(uptime / 1000 / 60)} minutos`);
      }
      
      // Verifica se há muitas conexões ativas
      this.checkActiveConnections();
      
      this.lastHealthCheck = now;
      
    } catch (error) {
      logError(error, { context: 'healthCheck' });
      console.error('❌ Erro no health check:', error.message);
    }
  }

  handleHighMemoryUsage() {
    try {
      // Força garbage collection se disponível
      if (global.gc) {
        global.gc();
        console.log('🧹 Garbage collection forçada');
      }
      
      // Log do uso de memória após GC
      setTimeout(() => {
        const memoryUsage = process.memoryUsage();
        const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        console.log(`📊 Memória após GC: ${memoryMB}MB`);
      }, 1000);
      
    } catch (error) {
      logError(error, { context: 'handleHighMemoryUsage' });
    }
  }

  checkActiveConnections() {
    try {
      // Verifica se há muitas conexões ativas no sistema
      const activeConnections = process._getActiveRequests ? process._getActiveRequests().length : 0;
      const activeHandles = process._getActiveHandles ? process._getActiveHandles().length : 0;
      
      if (activeConnections > 100 || activeHandles > 50) {
        console.warn(`⚠️ Muitas conexões ativas: ${activeConnections} requests, ${activeHandles} handles`);
      }
      
    } catch (error) {
      // Ignora erros de verificação de conexões
    }
  }

  getHealthStatus() {
    const now = Date.now();
    const uptime = now - this.startTime;
    const memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    
    return {
      isMonitoring: this.isMonitoring,
      uptime: Math.round(uptime / 1000), // segundos
      memoryUsage: memoryMB,
      memoryThreshold: this.memoryThreshold,
      lastHealthCheck: new Date(this.lastHealthCheck).toISOString(),
      startTime: new Date(this.startTime).toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    };
  }

  // Método para forçar limpeza de memória
  forceCleanup() {
    try {
      console.log('🧹 Forçando limpeza do sistema...');
      
      // Força garbage collection
      if (global.gc) {
        global.gc();
        console.log('✅ Garbage collection executada');
      }
      
      // Log do estado após limpeza
      setTimeout(() => {
        const memoryUsage = process.memoryUsage();
        const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        console.log(`📊 Memória após limpeza: ${memoryMB}MB`);
      }, 1000);
      
    } catch (error) {
      logError(error, { context: 'forceCleanup' });
      console.error('❌ Erro na limpeza forçada:', error.message);
    }
  }
}

// Instância global do monitor
const healthMonitor = new HealthMonitor();

// Handlers para encerramento gracioso
process.on('SIGINT', () => {
  console.log('\n🛑 Recebido SIGINT, parando monitoramento...');
  healthMonitor.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido SIGTERM, parando monitoramento...');
  healthMonitor.stop();
  process.exit(0);
});

module.exports = healthMonitor;
