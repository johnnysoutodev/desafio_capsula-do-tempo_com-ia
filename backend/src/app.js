const http = require('http');
const url = require('url');
const { logger } = require('./utils/logger');
const { corsMiddleware } = require('./middleware/cors');
const { initializeDatabase } = require('./database/connection');
const { healthCheck, detailedHealthCheck } = require('./controllers/healthController');
const { handleRoutes, handleDocumentation } = require('./routes/routes');
const { startScheduler } = require('../cron/scheduler');
const { ensureUploadDirectory } = require('./middleware/upload');

// Configurações do servidor
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Função principal para tratar requisições
async function handleRequest(req, res) {
  // Aplicar CORS
  corsMiddleware(req, res, async () => {
    try {
      const parsedUrl = url.parse(req.url, true);
      const pathname = parsedUrl.pathname;
      const method = req.method;
      
      logger.requestReceived(`${method} ${pathname}`);
      
      // Rotas de health check
      if (pathname === '/health' && method === 'GET') {
        await healthCheck(req, res);
        return;
      }
      
      if (pathname === '/health/detailed' && method === 'GET') {
        await detailedHealthCheck(req, res);
        return;
      }
      
      // Documentação da API
      if (pathname === '/api/docs' && method === 'GET') {
        await handleDocumentation(req, res);
        return;
      }
      
      // Rotas da API
      if (pathname.startsWith('/api/') || pathname.startsWith('/uploads/')) {
        await handleRoutes(req, res);
        return;
      }
      
      // Rota padrão - API info
      if (pathname === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: 'API Cápsula do Tempo',
          version: '1.0.0',
          status: 'running',
          timestamp: new Date().toISOString(),
          endpoints: {
            docs: '/api/docs',
            health: '/health',
            detailedHealth: '/health/detailed',
            capsules: '/api/capsules',
            email: '/api/email',
            scheduler: '/api/scheduler',
            uploads: '/uploads'
          }
        }));
        return;
      }
      
      // Rota não encontrada
      logger.warn(`Rota não encontrada: ${method} ${pathname}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Rota não encontrada',
        path: pathname,
        method: method,
        availableEndpoints: [
          '/',
          '/health',
          '/health/detailed',
          '/api/docs',
          '/api/capsules',
          '/api/email',
          '/api/scheduler'
        ]
      }));
      
    } catch (error) {
      logger.error('Erro no tratamento da requisição:', error);
      
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: 'Erro interno do servidor'
        }));
      }
    }
  });
}

// Função para inicializar o servidor
async function startServer() {
  try {
    logger.info('🚀 Inicializando Cápsula do Tempo Backend...');
    
    // Garantir diretório de uploads
    logger.info('📁 Verificando diretório de uploads...');
    ensureUploadDirectory();
    logger.info('✅ Diretório de uploads configurado');
    
    // Inicializar banco de dados
    logger.info('🗄️ Conectando ao banco de dados...');
    await initializeDatabase();
    logger.info('✅ Banco de dados conectado com sucesso');
    
    // Criar servidor HTTP
    const server = http.createServer(handleRequest);
    
    // Configurar tratamento de erros do servidor
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Porta ${PORT} já está em uso`);
      } else {
        logger.error('❌ Erro no servidor:', error);
      }
      process.exit(1);
    });
    
    // Configurar graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`Recebido sinal ${signal}, iniciando shutdown graceful...`);
      
      server.close(() => {
        logger.info('Servidor HTTP fechado');
        process.exit(0);
      });
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Iniciar servidor
    server.listen(PORT, HOST, () => {
      logger.info(`✅ Servidor rodando em http://${HOST}:${PORT}`);
      logger.info(`� Health check: http://${HOST}:${PORT}/health`);
      logger.info(`🔍 Detailed health: http://${HOST}:${PORT}/health/detailed`);
      logger.info(`� Documentação: http://${HOST}:${PORT}/api/docs`);
      logger.info(`🎯 API Cápsulas: http://${HOST}:${PORT}/api/capsules`);
      
      // Iniciar scheduler após servidor estar rodando
      logger.info('⏰ Iniciando scheduler de emails...');
      const schedulerStarted = startScheduler();
      
      if (schedulerStarted) {
        logger.info('✅ Scheduler iniciado com sucesso');
      } else {
        logger.warn('⚠️ Falha ao iniciar scheduler');
      }
      
      logger.info('🎉 Backend pronto para receber requisições!');
    });
    
  } catch (error) {
    logger.error('❌ Erro ao inicializar servidor:', error);
    process.exit(1);
  }
}

// Inicializar servidor se este arquivo for executado diretamente
if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  handleRequest
};