const http = require('http');
const url = require('url');
const { logger } = require('./utils/logger');
const { corsMiddleware } = require('./middleware/cors');
const { healthCheck, detailedHealthCheck } = require('./controllers/healthController');
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
      
      // Rota padrão - API info
      if (pathname === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          name: 'API Cápsula do Tempo',
          version: '1.0.0',
          status: 'running',
          timestamp: new Date().toISOString(),
          message: 'Backend funcionando! Conecte ao banco para acessar todas as funcionalidades.',
          endpoints: {
            health: '/health',
            detailedHealth: '/health/detailed'
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
        method: method
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

// Função para inicializar o servidor (sem banco)
async function startServer() {
  try {
    logger.info('🚀 Iniciando teste do Backend...');
    
    // Garantir diretório de uploads
    logger.info('📁 Verificando diretório de uploads...');
    ensureUploadDirectory();
    logger.info('✅ Diretório de uploads configurado');
    
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
      logger.info(`✅ Servidor de teste rodando em http://${HOST}:${PORT}`);
      logger.info(`📊 Health check: http://${HOST}:${PORT}/health`);
      logger.info(`🔍 Detailed health: http://${HOST}:${PORT}/health/detailed`);
      logger.info(`🎉 Backend de teste pronto!`);
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