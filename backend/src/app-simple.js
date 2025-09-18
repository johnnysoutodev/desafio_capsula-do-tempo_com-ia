const http = require('http');
const url = require('url');

// Configurações do servidor
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Função principal para tratar requisições
async function handleRequest(req, res) {
  try {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    
    // Configurar CORS básico
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Tratar OPTIONS
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    // Rota raiz
    if (pathname === '/' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        name: 'API Cápsula do Tempo - Teste',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        message: 'Teste básico funcionando!'
      }));
      return;
    }
    
    // Health check simples
    if (pathname === '/health' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // Rota não encontrada
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Rota não encontrada',
      path: pathname,
      method: method
    }));
    
  } catch (error) {
    console.error('Erro no servidor:', error);
    
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Erro interno do servidor',
        error: error.message
      }));
    }
  }
}

// Inicializar servidor
const server = http.createServer(handleRequest);

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já está em uso`);
  } else {
    console.error('❌ Erro no servidor:', error);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`✅ Servidor básico rodando em http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
  console.log(`🎉 Teste básico pronto!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Recebido SIGTERM, parando servidor...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Recebido SIGINT, parando servidor...');
  server.close(() => process.exit(0));
});