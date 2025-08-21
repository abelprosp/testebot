#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class RestartMonitor {
  constructor() {
    this.process = null;
    this.restartCount = 0;
    this.maxRestarts = 10;
    this.restartDelay = 5000; // 5 segundos
    this.healthCheckInterval = 30000; // 30 segundos
    this.lastHealthCheck = Date.now();
    this.isRunning = false;
    this.logFile = path.join(__dirname, '../logs/restart-monitor.log');
    
    // Cria diretório de logs se não existir
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    console.log(logMessage.trim());
    fs.appendFileSync(this.logFile, logMessage);
  }

  start() {
    if (this.isRunning) {
      this.log('⚠️ Monitor já está rodando');
      return;
    }

    this.isRunning = true;
    this.log('🚀 Iniciando monitor de reinicialização automática...');
    this.log(`📊 Configurações:`);
    this.log(`   - Máximo de reinicializações: ${this.maxRestarts}`);
    this.log(`   - Delay entre reinicializações: ${this.restartDelay}ms`);
    this.log(`   - Health check interval: ${this.healthCheckInterval}ms`);
    
    this.spawnProcess();
    this.startHealthCheck();
  }

  stop() {
    this.isRunning = false;
    this.log('🛑 Parando monitor de reinicialização...');
    
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    
    this.log('✅ Monitor parado');
  }

  spawnProcess() {
    if (!this.isRunning) return;

    this.log(`🔄 Iniciando processo (tentativa ${this.restartCount + 1}/${this.maxRestarts + 1})`);
    
    // Inicia o processo principal
    this.process = spawn('node', ['src/index.js'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    this.process.on('error', (error) => {
      this.log(`❌ Erro ao iniciar processo: ${error.message}`);
      this.handleProcessExit();
    });

    this.process.on('exit', (code, signal) => {
      this.log(`📤 Processo encerrado com código ${code} e sinal ${signal}`);
      this.handleProcessExit();
    });

    this.process.on('close', (code) => {
      this.log(`📤 Processo fechado com código ${code}`);
      this.handleProcessExit();
    });
  }

  handleProcessExit() {
    if (!this.isRunning) return;

    this.restartCount++;
    
    if (this.restartCount > this.maxRestarts) {
      this.log(`❌ Máximo de reinicializações (${this.maxRestarts}) atingido. Parando monitor.`);
      this.stop();
      return;
    }

    this.log(`⏳ Aguardando ${this.restartDelay}ms antes da próxima tentativa...`);
    
    setTimeout(() => {
      if (this.isRunning) {
        this.spawnProcess();
      }
    }, this.restartDelay);
  }

  startHealthCheck() {
    setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
  }

  async performHealthCheck() {
    try {
      const response = await fetch('http://localhost:3000/health');
      
      if (response.ok) {
        const data = await response.json();
        this.log(`✅ Health check OK - Status: ${data.status}`);
        this.lastHealthCheck = Date.now();
      } else {
        this.log(`⚠️ Health check falhou - Status: ${response.status}`);
        this.handleHealthCheckFailure();
      }
    } catch (error) {
      this.log(`❌ Health check erro: ${error.message}`);
      this.handleHealthCheckFailure();
    }
  }

  handleHealthCheckFailure() {
    const timeSinceLastCheck = Date.now() - this.lastHealthCheck;
    
    // Se falhou por mais de 2 minutos, reinicia
    if (timeSinceLastCheck > 120000) {
      this.log('🔄 Health check falhou por muito tempo, reiniciando processo...');
      
      if (this.process) {
        this.process.kill('SIGTERM');
      }
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      restartCount: this.restartCount,
      maxRestarts: this.maxRestarts,
      lastHealthCheck: new Date(this.lastHealthCheck).toISOString(),
      processAlive: this.process && !this.process.killed
    };
  }
}

// Função para fazer fetch (Node.js 18+)
async function fetch(url, options = {}) {
  const http = require('http');
  const https = require('https');
  
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    const req = protocol.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        res.body = data;
        resolve(res);
      });
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

// Instância global
const monitor = new RestartMonitor();

// Handlers para encerramento gracioso
process.on('SIGINT', () => {
  console.log('\n🛑 Recebido SIGINT...');
  monitor.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Recebido SIGTERM...');
  monitor.stop();
  process.exit(0);
});

// Inicia o monitor
monitor.start();

module.exports = monitor;
