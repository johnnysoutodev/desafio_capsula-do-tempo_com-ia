const { checkDatabaseHealth } = require('../database/connection');
const { logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// Health check do servidor
async function healthCheck(req, res) {
  const startTime = Date.now();
  
  try {
    logger.debug('Executando health check...');

    // Verificar status básico do servidor
    const serverStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      memory: process.memoryUsage(),
      pid: process.pid
    };

    // Verificar conexão com banco de dados
    const dbHealth = await checkDatabaseHealth();

    // Verificar diretório de uploads
    const uploadsPath = path.join(__dirname, '../../../uploads');
    const uploadsStatus = {
      exists: fs.existsSync(uploadsPath),
      writable: false
    };

    if (uploadsStatus.exists) {
      try {
        // Testar escrita no diretório
        const testFile = path.join(uploadsPath, '.health-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        uploadsStatus.writable = true;
      } catch (error) {
        logger.warn('Diretório de uploads não está gravável:', error.message);
      }
    }

    // Verificar variáveis de ambiente críticas
    const envStatus = {
      hasEmailConfig: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
      hasDatabaseConfig: !!(process.env.DATABASE_URL || process.env.POSTGRES_HOST),
      hasAllowedOrigins: !!process.env.ALLOWED_ORIGINS
    };

    // Determinar status geral
    const isHealthy = 
      serverStatus.status === 'ok' &&
      dbHealth.status === 'connected' &&
      uploadsStatus.exists &&
      uploadsStatus.writable;

    const responseTime = Date.now() - startTime;

    const healthData = {
      status: isHealthy ? 'healthy' : 'degraded',
      responseTime: `${responseTime}ms`,
      timestamp: serverStatus.timestamp,
      server: serverStatus,
      database: dbHealth,
      uploads: uploadsStatus,
      environment: envStatus,
      version: '1.0.0',
      service: 'Cápsula do Tempo API'
    };

    // Status HTTP baseado na saúde
    const statusCode = isHealthy ? 200 : 503;

    // Log do resultado
    logger.info(`Health check completado: ${healthData.status} (${responseTime}ms)`);

    // Resposta
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(healthData, null, 2));

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    logger.error('Erro no health check:', error);

    const errorResponse = {
      status: 'error',
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        type: error.constructor.name
      },
      service: 'Cápsula do Tempo API'
    };

    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(errorResponse, null, 2));
  }
}

// Health check simples (apenas status)
async function simpleHealthCheck(req, res) {
  try {
    const dbHealth = await checkDatabaseHealth();
    const isHealthy = dbHealth.status === 'connected';

    res.writeHead(isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'error',
      timestamp: new Date().toISOString()
    }));
  }
}

// Health check detalhado para monitoramento
async function detailedHealthCheck(req, res) {
  const checks = {};
  
  try {
    // Check 1: Database
    checks.database = await checkDatabaseHealth();
    
    // Check 2: Disk space (uploads)
    const uploadsPath = path.join(__dirname, '../../../uploads');
    try {
      const stats = fs.statSync(uploadsPath);
      checks.uploads = {
        status: 'ok',
        exists: true,
        isDirectory: stats.isDirectory(),
        lastModified: stats.mtime
      };
    } catch (error) {
      checks.uploads = {
        status: 'error',
        exists: false,
        error: error.message
      };
    }

    // Check 3: Memory usage
    const memUsage = process.memoryUsage();
    checks.memory = {
      status: memUsage.heapUsed < (100 * 1024 * 1024) ? 'ok' : 'warning', // 100MB threshold
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
    };

    // Check 4: Uptime
    const uptimeSeconds = process.uptime();
    checks.uptime = {
      status: 'ok',
      seconds: uptimeSeconds,
      formatted: formatUptime(uptimeSeconds)
    };

    // Determinar status geral
    const allOk = Object.values(checks).every(check => 
      check.status === 'ok' || check.status === 'connected'
    );

    const response = {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks
    };

    res.writeHead(allOk ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response, null, 2));

  } catch (error) {
    logger.error('Erro no health check detalhado:', error);
    
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    }));
  }
}

// Função auxiliar para formatar uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const mins = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0) parts.push(`${secs}s`);

  return parts.join(' ') || '0s';
}

module.exports = {
  healthCheck,
  simpleHealthCheck,
  detailedHealthCheck
};