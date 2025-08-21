const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Cria diretório de logs se não existir
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'evolux-whatsapp-agent' },
  transports: [
    // Log de erros
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Log geral
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Log de performance
    new winston.transports.File({ 
      filename: path.join(logDir, 'performance.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 3
    })
  ]
});

// Adiciona console em desenvolvimento
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Funções de logging específicas
const logPerformance = (operation, duration, metadata = {}) => {
  logger.info('Performance', {
    operation,
    duration,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

const logError = (error, context = {}) => {
  logger.error('Error', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  });
};

const logWhatsAppEvent = (event, data = {}) => {
  logger.info('WhatsApp Event', {
    event,
    data,
    timestamp: new Date().toISOString()
  });
};

const logMemoryUsage = () => {
  const usage = process.memoryUsage();
  logger.info('Memory Usage', {
    rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
    external: Math.round(usage.external / 1024 / 1024) + ' MB',
    timestamp: new Date().toISOString()
  });
};

// Monitor de memória
let memoryMonitorInterval = null;

const startMemoryMonitoring = (intervalMs = 300000) => { // 5 minutos
  if (memoryMonitorInterval) {
    clearInterval(memoryMonitorInterval);
  }
  
  memoryMonitorInterval = setInterval(() => {
    logMemoryUsage();
  }, intervalMs);
  
  logger.info('Memory monitoring started', { intervalMs });
};

const stopMemoryMonitoring = () => {
  if (memoryMonitorInterval) {
    clearInterval(memoryMonitorInterval);
    memoryMonitorInterval = null;
    logger.info('Memory monitoring stopped');
  }
};

module.exports = {
  logger,
  logPerformance,
  logError,
  logWhatsAppEvent,
  logMemoryUsage,
  startMemoryMonitoring,
  stopMemoryMonitoring
};
