const { 
  createTimeCapsule, 
  getTimeCapsules, 
  getTimeCapsuleById, 
  getTimeCapsuleStats 
} = require('../controllers/timeCapsuleController');
const { 
  testEmailConfiguration, 
  sendTestEmail 
} = require('../services/emailService');
const {
  getSchedulerStatus,
  runSchedulerManually,
  resetSchedulerStats
} = require('../../cron/scheduler');
const { uploadMiddleware } = require('../middleware/upload');
const { logger } = require('../utils/logger');

// Função auxiliar para analisar body JSON
function parseJSONBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        if (body.trim()) {
          resolve(JSON.parse(body));
        } else {
          resolve({});
        }
      } catch (error) {
        reject(new Error('JSON inválido'));
      }
    });
    
    req.on('error', reject);
  });
}

// Função auxiliar para resposta de erro
function sendError(res, statusCode, message, details = null) {
  logger.error(`Erro ${statusCode}: ${message}`, details);
  
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: false,
    message,
    ...(details && { details })
  }));
}

// Função auxiliar para resposta de sucesso
function sendSuccess(res, data, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    ...data
  }));
}

// Router principal
async function handleRoutes(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;
  
  logger.debug(`${method} ${pathname}`);
  
  try {
    // Rotas das cápsulas do tempo
    if (pathname === '/api/capsules' && method === 'POST') {
      // Criar nova cápsula do tempo
      uploadMiddleware(req, res, async () => {
        await createTimeCapsule(req, res);
      });
      return;
    }
    
    if (pathname === '/api/capsules' && method === 'GET') {
      // Listar cápsulas do tempo
      await getTimeCapsules(req, res);
      return;
    }
    
    if (pathname.startsWith('/api/capsules/') && method === 'GET') {
      // Buscar cápsula específica por ID
      await getTimeCapsuleById(req, res);
      return;
    }
    
    if (pathname === '/api/capsules/stats' && method === 'GET') {
      // Obter estatísticas das cápsulas
      await getTimeCapsuleStats(req, res);
      return;
    }
    
    // Rotas de email
    if (pathname === '/api/email/test-config' && method === 'GET') {
      // Testar configuração de email
      const result = await testEmailConfiguration();
      
      if (result.success) {
        sendSuccess(res, {
          message: 'Configuração de email válida',
          details: result
        });
      } else {
        sendError(res, 500, 'Configuração de email inválida', result);
      }
      return;
    }
    
    if (pathname === '/api/email/send-test' && method === 'POST') {
      // Enviar email de teste
      const body = await parseJSONBody(req);
      
      if (!body.email) {
        sendError(res, 400, 'Email é obrigatório');
        return;
      }
      
      const result = await sendTestEmail(body.email);
      
      if (result.success) {
        sendSuccess(res, {
          message: 'Email de teste enviado com sucesso',
          details: result
        });
      } else {
        sendError(res, 500, 'Erro ao enviar email de teste', result);
      }
      return;
    }
    
    // Rotas do scheduler
    if (pathname === '/api/scheduler/status' && method === 'GET') {
      // Status do scheduler
      const status = getSchedulerStatus();
      sendSuccess(res, { scheduler: status });
      return;
    }
    
    if (pathname === '/api/scheduler/run' && method === 'POST') {
      // Executar scheduler manualmente
      const result = await runSchedulerManually();
      
      if (result.success) {
        sendSuccess(res, {
          message: 'Scheduler executado com sucesso',
          details: result
        });
      } else {
        sendError(res, 500, 'Erro ao executar scheduler', result);
      }
      return;
    }
    
    if (pathname === '/api/scheduler/reset-stats' && method === 'POST') {
      // Resetar estatísticas do scheduler
      const result = resetSchedulerStats();
      sendSuccess(res, {
        message: 'Estatísticas do scheduler resetadas',
        details: result
      });
      return;
    }
    
    // Rota para servir uploads
    if (pathname.startsWith('/uploads/') && method === 'GET') {
      await serveUploadedFile(req, res, pathname);
      return;
    }
    
    // Rota não encontrada
    sendError(res, 404, 'Rota não encontrada');
    
  } catch (error) {
    logger.error('Erro no roteamento:', error);
    sendError(res, 500, 'Erro interno do servidor');
  }
}

// Função para servir arquivos de upload
async function serveUploadedFile(req, res, pathname) {
  const path = require('path');
  const fs = require('fs');
  
  try {
    const filename = pathname.split('/uploads/')[1];
    
    if (!filename) {
      sendError(res, 400, 'Nome do arquivo não especificado');
      return;
    }
    
    const filePath = path.join(__dirname, '../../../uploads', filename);
    
    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      sendError(res, 404, 'Arquivo não encontrado');
      return;
    }
    
    // Obter informações do arquivo
    const stats = fs.statSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    // Definir Content-Type baseado na extensão
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Headers da resposta
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=31536000', // 1 ano
      'Last-Modified': stats.mtime.toUTCString(),
      'ETag': `"${stats.size}-${stats.mtime.getTime()}"`
    });
    
    // Verificar If-None-Match (ETag)
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && ifNoneMatch === `"${stats.size}-${stats.mtime.getTime()}"`) {
      res.writeHead(304);
      res.end();
      return;
    }
    
    // Verificar If-Modified-Since
    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime) {
      res.writeHead(304);
      res.end();
      return;
    }
    
    // Criar stream de leitura e enviar arquivo
    const readStream = fs.createReadStream(filePath);
    
    readStream.on('error', (error) => {
      logger.error(`Erro ao ler arquivo ${filename}:`, error);
      if (!res.headersSent) {
        sendError(res, 500, 'Erro ao ler arquivo');
      }
    });
    
    readStream.pipe(res);
    
    logger.debug(`Arquivo servido: ${filename} (${stats.size} bytes)`);
    
  } catch (error) {
    logger.error('Erro ao servir arquivo:', error);
    sendError(res, 500, 'Erro interno do servidor');
  }
}

// Rota de documentação da API
function getAPIDocumentation() {
  return {
    version: '1.0.0',
    title: 'API Cápsula do Tempo',
    description: 'API para gerenciamento de cápsulas do tempo com envio de emails agendados',
    
    endpoints: {
      capsules: {
        'POST /api/capsules': {
          description: 'Criar nova cápsula do tempo',
          contentType: 'multipart/form-data',
          fields: {
            name: 'string (obrigatório, max 100 chars)',
            email: 'string (obrigatório, formato email)',
            message: 'string (obrigatório, max 140 chars)',
            openDate: 'string (obrigatório, ISO date, futuro)',
            image: 'file (obrigatório, jpg/png/gif/webp, max 5MB)'
          },
          response: 'Dados da cápsula criada'
        },
        
        'GET /api/capsules': {
          description: 'Listar cápsulas do tempo',
          queryParams: {
            page: 'number (default: 1)',
            limit: 'number (default: 10, max: 50)',
            status: 'string (pending|sent)',
            email: 'string (filtrar por email)'
          },
          response: 'Lista paginada de cápsulas'
        },
        
        'GET /api/capsules/:id': {
          description: 'Buscar cápsula específica por ID',
          response: 'Dados da cápsula'
        },
        
        'GET /api/capsules/stats': {
          description: 'Estatísticas das cápsulas',
          response: 'Contadores e estatísticas'
        }
      },
      
      email: {
        'GET /api/email/test-config': {
          description: 'Testar configuração de email',
          response: 'Status da configuração'
        },
        
        'POST /api/email/send-test': {
          description: 'Enviar email de teste',
          body: { email: 'string (obrigatório)' },
          response: 'Status do envio'
        }
      },
      
      scheduler: {
        'GET /api/scheduler/status': {
          description: 'Status do scheduler de emails',
          response: 'Estado e estatísticas do scheduler'
        },
        
        'POST /api/scheduler/run': {
          description: 'Executar scheduler manualmente',
          response: 'Resultado da execução'
        },
        
        'POST /api/scheduler/reset-stats': {
          description: 'Resetar estatísticas do scheduler',
          response: 'Confirmação do reset'
        }
      },
      
      uploads: {
        'GET /uploads/:filename': {
          description: 'Servir arquivos de imagem uploadados',
          response: 'Arquivo de imagem'
        }
      }
    },
    
    errorCodes: {
      400: 'Bad Request - Dados inválidos',
      404: 'Not Found - Recurso não encontrado',
      500: 'Internal Server Error - Erro interno'
    }
  };
}

// Rota para documentação
async function handleDocumentation(req, res) {
  const docs = getAPIDocumentation();
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(docs, null, 2));
}

module.exports = {
  handleRoutes,
  handleDocumentation,
  serveUploadedFile,
  parseJSONBody,
  sendError,
  sendSuccess
};