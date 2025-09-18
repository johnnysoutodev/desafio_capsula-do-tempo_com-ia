const fs = require('fs');
const path = require('path');

// Configuração do logger
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const COLORS = {
  ERROR: '\x1b[31m', // Vermelho
  WARN: '\x1b[33m',  // Amarelo
  INFO: '\x1b[36m',  // Ciano
  DEBUG: '\x1b[35m', // Magenta
  RESET: '\x1b[0m'   // Reset
};

class Logger {
  constructor() {
    this.logLevel = this.getLogLevel();
    this.logDir = path.join(__dirname, '../../../logs');
    this.ensureLogDirectory();
  }

  getLogLevel() {
    const level = process.env.LOG_LEVEL || 'INFO';
    return LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.INFO;
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    
    return `[${timestamp}] [${level}] ${message}${formattedArgs}`;
  }

  writeToFile(level, formattedMessage) {
    try {
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `capsula-tempo-${date}.log`;
      const filepath = path.join(this.logDir, filename);
      
      fs.appendFileSync(filepath, formattedMessage + '\n');
    } catch (error) {
      console.error('Erro ao escrever no arquivo de log:', error);
    }
  }

  log(level, message, ...args) {
    const levelValue = LOG_LEVELS[level];
    
    if (levelValue <= this.logLevel) {
      const formattedMessage = this.formatMessage(level, message, ...args);
      
      // Log no console com cores
      const color = COLORS[level] || COLORS.RESET;
      console.log(`${color}${formattedMessage}${COLORS.RESET}`);
      
      // Log no arquivo (apenas em produção ou se LOG_TO_FILE=true)
      if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
        this.writeToFile(level, formattedMessage);
      }
    }
  }

  error(message, ...args) {
    this.log('ERROR', message, ...args);
  }

  warn(message, ...args) {
    this.log('WARN', message, ...args);
  }

  info(message, ...args) {
    this.log('INFO', message, ...args);
  }

  debug(message, ...args) {
    this.log('DEBUG', message, ...args);
  }

  // Método para logging de requisições HTTP
  request(req, res, responseTime) {
    const { method, url, headers } = req;
    const { statusCode } = res;
    const userAgent = headers['user-agent'] || 'Unknown';
    const ip = headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown';
    
    const message = `${method} ${url} ${statusCode} ${responseTime}ms - ${ip} - ${userAgent}`;
    
    if (statusCode >= 400) {
      this.error(message);
    } else {
      this.info(message);
    }
  }

  // Método para logging de operações de banco de dados
  database(operation, table, duration, success = true) {
    const message = `DB ${operation} on ${table} - ${duration}ms - ${success ? 'SUCCESS' : 'FAILED'}`;
    
    if (success) {
      this.debug(message);
    } else {
      this.error(message);
    }
  }

  // Método para logging de emails
  email(to, subject, success = true, error = null) {
    const message = `Email to ${to} - Subject: "${subject}" - ${success ? 'SENT' : 'FAILED'}`;
    
    if (success) {
      this.info(message);
    } else {
      this.error(message, error);
    }
  }

  // Método para logging do scheduler
  scheduler(action, capsuleCount, duration) {
    const message = `Scheduler ${action} - ${capsuleCount} capsules processed - ${duration}ms`;
    this.info(message);
  }

  // Método para limpar logs antigos
  cleanOldLogs(daysToKeep = 30) {
    try {
      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      files.forEach(file => {
        if (file.endsWith('.log')) {
          const filepath = path.join(this.logDir, file);
          const stats = fs.statSync(filepath);
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filepath);
            this.info(`Log antigo removido: ${file}`);
          }
        }
      });
    } catch (error) {
      this.error('Erro ao limpar logs antigos:', error);
    }
  }
}

// Instância singleton do logger
const logger = new Logger();

// Limpar logs antigos na inicialização (apenas em produção)
if (process.env.NODE_ENV === 'production') {
  logger.cleanOldLogs();
}

module.exports = { logger, Logger };