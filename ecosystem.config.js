module.exports = {
  apps: [{
    name: 'testebot-whatsapp',
    script: 'start-with-whatsapp.js',
    cwd: '/root/testebot',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      ENABLE_WHATSAPP: 'true',
      GROQ_API_KEY: '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',
      PUPPETEER_EXECUTABLE_PATH: '/usr/bin/google-chrome-stable'
    },
    env_production: {
      NODE_ENV: 'production',
      ENABLE_WHATSAPP: 'true',
      GROQ_API_KEY: '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',
      PUPPETEER_EXECUTABLE_PATH: '/usr/bin/google-chrome-stable'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 10000,
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
