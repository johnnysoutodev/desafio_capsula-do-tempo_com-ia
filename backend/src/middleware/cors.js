const { logger } = require('../utils/logger');

// Configuração de CORS
const CORS_CONFIG = {
  // Origens permitidas
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'https://vercel.app',
    process.env.ALLOWED_ORIGINS?.split(',') || []
  ].flat().filter(Boolean),

  // Métodos permitidos
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],

  // Headers permitidos
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-HTTP-Method-Override'
  ],

  // Headers expostos
  exposedHeaders: ['X-Total-Count', 'X-Request-ID'],

  // Permitir credenciais
  credentials: true,

  // Tempo de cache do preflight
  maxAge: 86400 // 24 horas
};

// Função para verificar se origin é permitida
function isOriginAllowed(origin) {
  // Se não há origin (requisições diretas), permitir em desenvolvimento
  if (!origin && process.env.NODE_ENV === 'development') {
    return true;
  }

  // Verificar se origin está na lista de permitidas
  return CORS_CONFIG.allowedOrigins.some(allowedOrigin => {
    if (allowedOrigin === '*') return true;
    if (allowedOrigin === origin) return true;
    
    // Permitir subdomínios se configurado
    if (allowedOrigin.startsWith('*.')) {
      const domain = allowedOrigin.slice(2);
      return origin && origin.endsWith(domain);
    }
    
    return false;
  });
}

// Função principal para tratar CORS
function handleCORS(req, res) {
  const origin = req.headers.origin;
  const method = req.method;

  // Log da tentativa de CORS
  logger.debug(`CORS check: ${method} from ${origin || 'no-origin'}`);

  // Verificar se origin é permitida
  if (origin && !isOriginAllowed(origin)) {
    logger.warn(`CORS: Origin não permitida: ${origin}`);
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'CORS: Origin não permitida',
      origin: origin
    }));
    return false;
  }

  // Configurar headers CORS
  const corsHeaders = {};

  // Origin
  if (origin && isOriginAllowed(origin)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  } else if (CORS_CONFIG.allowedOrigins.includes('*')) {
    corsHeaders['Access-Control-Allow-Origin'] = '*';
  }

  // Outros headers CORS
  corsHeaders['Access-Control-Allow-Methods'] = CORS_CONFIG.allowedMethods.join(', ');
  corsHeaders['Access-Control-Allow-Headers'] = CORS_CONFIG.allowedHeaders.join(', ');
  corsHeaders['Access-Control-Expose-Headers'] = CORS_CONFIG.exposedHeaders.join(', ');
  corsHeaders['Access-Control-Max-Age'] = CORS_CONFIG.maxAge.toString();

  if (CORS_CONFIG.credentials) {
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
  }

  // Aplicar headers CORS na resposta
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Tratar requisições OPTIONS (preflight)
  if (method === 'OPTIONS') {
    logger.debug('CORS: Respondendo preflight request');
    res.writeHead(204, corsHeaders);
    res.end();
    return false; // Não continuar processamento
  }

  // Verificar se método é permitido
  if (!CORS_CONFIG.allowedMethods.includes(method)) {
    logger.warn(`CORS: Método não permitido: ${method}`);
    res.writeHead(405, { 
      'Content-Type': 'application/json',
      'Allow': CORS_CONFIG.allowedMethods.join(', ')
    });
    res.end(JSON.stringify({
      success: false,
      message: 'Método não permitido',
      allowedMethods: CORS_CONFIG.allowedMethods
    }));
    return false;
  }

  logger.debug(`CORS: Permitido ${method} de ${origin || 'no-origin'}`);
  return true; // Continuar processamento
}

// Função para adicionar origin à lista de permitidas
function addAllowedOrigin(origin) {
  if (!CORS_CONFIG.allowedOrigins.includes(origin)) {
    CORS_CONFIG.allowedOrigins.push(origin);
    logger.info(`CORS: Nova origin adicionada: ${origin}`);
  }
}

// Função para remover origin da lista de permitidas
function removeAllowedOrigin(origin) {
  const index = CORS_CONFIG.allowedOrigins.indexOf(origin);
  if (index > -1) {
    CORS_CONFIG.allowedOrigins.splice(index, 1);
    logger.info(`CORS: Origin removida: ${origin}`);
  }
}

// Função para obter configuração atual
function getCORSConfig() {
  return { ...CORS_CONFIG };
}

// Função middleware que aceita callback (compatível com middleware pattern)
function corsMiddleware(req, res, next) {
  const corsResult = handleCORS(req, res);
  
  if (corsResult) {
    // CORS OK, continuar para próximo middleware/handler
    if (typeof next === 'function') {
      next();
    }
  }
  // Se corsResult é false, a resposta já foi enviada pelo handleCORS
}

module.exports = {
  handleCORS,
  corsMiddleware,
  isOriginAllowed,
  addAllowedOrigin,
  removeAllowedOrigin,
  getCORSConfig,
  CORS_CONFIG
};