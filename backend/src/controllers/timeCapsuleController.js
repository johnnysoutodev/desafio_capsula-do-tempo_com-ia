const { db } = require('../database/connection');
const { logger } = require('../utils/logger');
const { removeFile, getFileInfo } = require('../middleware/upload');
const path = require('path');

// Função auxiliar para validar dados da cápsula
function validateTimeCapsuleData(data) {
  const errors = [];
  
  // Validar nome
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Nome é obrigatório');
  } else if (data.name.trim().length > 100) {
    errors.push('Nome deve ter no máximo 100 caracteres');
  }
  
  // Validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || typeof data.email !== 'string' || data.email.trim().length === 0) {
    errors.push('Email é obrigatório');
  } else if (!emailRegex.test(data.email.trim())) {
    errors.push('Email deve ter um formato válido');
  }
  
  // Validar mensagem
  if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
    errors.push('Mensagem é obrigatória');
  } else if (data.message.trim().length > 140) {
    errors.push('Mensagem deve ter no máximo 140 caracteres');
  }
  
  // Validar data de abertura
  if (!data.openDate || typeof data.openDate !== 'string') {
    errors.push('Data de abertura é obrigatória');
  } else {
    const openDate = new Date(data.openDate);
    if (isNaN(openDate.getTime())) {
      errors.push('Data de abertura deve ser uma data válida');
    } else if (openDate <= new Date()) {
      errors.push('Data de abertura deve ser uma data futura');
    }
  }
  
  return errors;
}

// Função auxiliar para formatar resposta da cápsula
function formatTimeCapsuleResponse(capsule) {
  return {
    id: capsule.id,
    name: capsule.name,
    email: capsule.email,
    message: capsule.message,
    imagePath: capsule.image_path,
    imageUrl: capsule.image_path ? `/uploads/${path.basename(capsule.image_path)}` : null,
    openDate: capsule.open_date,
    createdAt: capsule.created_at,
    status: capsule.status,
    sentAt: capsule.sent_at || null
  };
}

// Criar nova cápsula do tempo
async function createTimeCapsule(req, res) {
  logger.info('Iniciando criação de cápsula do tempo');
  
  try {
    // Validar dados recebidos
    const validationErrors = validateTimeCapsuleData(req.body);
    
    if (validationErrors.length > 0) {
      logger.warn('Dados inválidos para cápsula:', validationErrors);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Dados inválidos',
        errors: validationErrors
      }));
      return;
    }
    
    // Verificar se imagem foi enviada
    if (!req.uploadedFile) {
      logger.warn('Tentativa de criar cápsula sem imagem');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Imagem é obrigatória',
        field: 'image'
      }));
      return;
    }
    
    // Preparar dados para inserção
    const {
      name,
      email,
      message,
      openDate
    } = req.body;
    
    const imagePath = req.uploadedFile.path;
    
    // Inserir no banco de dados
    const query = `
      INSERT INTO time_capsules (name, email, message, image_path, open_date, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `;
    
    const values = [
      name.trim(),
      email.trim().toLowerCase(),
      message.trim(),
      imagePath,
      new Date(openDate)
    ];
    
    logger.debug('Executando query de inserção:', { query, values: values.map((v, i) => i === 3 ? '[FILE_PATH]' : v) });
    
    const result = await db.query(query, values);
    const newCapsule = result.rows[0];
    
    logger.info(`Cápsula criada com sucesso: ID ${newCapsule.id}`);
    
    // Retornar resposta de sucesso
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Cápsula do tempo criada com sucesso!',
      data: formatTimeCapsuleResponse(newCapsule)
    }));
    
  } catch (error) {
    logger.error('Erro ao criar cápsula do tempo:', error);
    
    // Remover arquivo de imagem se houver erro
    if (req.uploadedFile && req.uploadedFile.path) {
      removeFile(req.uploadedFile.path);
    }
    
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Erro interno do servidor ao criar cápsula'
    }));
  }
}

// Listar cápsulas do tempo
async function getTimeCapsules(req, res) {
  logger.info('Listando cápsulas do tempo');
  
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const searchParams = url.searchParams;
    
    // Parâmetros de paginação
    const page = Math.max(1, parseInt(searchParams.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit')) || 10));
    const offset = (page - 1) * limit;
    
    // Parâmetros de filtro
    const status = searchParams.get('status');
    const email = searchParams.get('email');
    
    // Construir query base
    let baseQuery = 'FROM time_capsules WHERE 1=1';
    let whereParams = [];
    let paramIndex = 1;
    
    // Adicionar filtros
    if (status && ['pending', 'sent'].includes(status)) {
      baseQuery += ` AND status = $${paramIndex}`;
      whereParams.push(status);
      paramIndex++;
    }
    
    if (email) {
      baseQuery += ` AND email = $${paramIndex}`;
      whereParams.push(email.toLowerCase());
      paramIndex++;
    }
    
    // Query para contar total
    const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
    const countResult = await db.query(countQuery, whereParams);
    const totalCapsules = parseInt(countResult.rows[0].total);
    
    // Query para buscar dados paginados
    const dataQuery = `
      SELECT * ${baseQuery}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const dataParams = [...whereParams, limit, offset];
    const dataResult = await db.query(dataQuery, dataParams);
    
    // Formatar resposta
    const capsules = dataResult.rows.map(formatTimeCapsuleResponse);
    
    const totalPages = Math.ceil(totalCapsules / limit);
    
    logger.info(`Retornando ${capsules.length} cápsulas (página ${page}/${totalPages})`);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: capsules,
      pagination: {
        page,
        limit,
        total: totalCapsules,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }));
    
  } catch (error) {
    logger.error('Erro ao listar cápsulas:', error);
    
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Erro interno do servidor ao listar cápsulas'
    }));
  }
}

// Buscar cápsula específica por ID
async function getTimeCapsuleById(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];
    
    if (!id || isNaN(parseInt(id))) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'ID da cápsula deve ser um número válido'
      }));
      return;
    }
    
    logger.info(`Buscando cápsula ID: ${id}`);
    
    const query = 'SELECT * FROM time_capsules WHERE id = $1';
    const result = await db.query(query, [parseInt(id)]);
    
    if (result.rows.length === 0) {
      logger.warn(`Cápsula não encontrada: ID ${id}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Cápsula do tempo não encontrada'
      }));
      return;
    }
    
    const capsule = formatTimeCapsuleResponse(result.rows[0]);
    
    logger.info(`Cápsula encontrada: ID ${id}`);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: capsule
    }));
    
  } catch (error) {
    logger.error('Erro ao buscar cápsula:', error);
    
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Erro interno do servidor ao buscar cápsula'
    }));
  }
}

// Buscar cápsulas prontas para envio
async function getCapsulesToSend() {
  try {
    const query = `
      SELECT * FROM time_capsules 
      WHERE status = 'pending' 
      AND open_date <= NOW()
      ORDER BY open_date ASC
    `;
    
    const result = await db.query(query);
    
    logger.info(`Encontradas ${result.rows.length} cápsulas prontas para envio`);
    
    return result.rows.map(formatTimeCapsuleResponse);
    
  } catch (error) {
    logger.error('Erro ao buscar cápsulas para envio:', error);
    throw error;
  }
}

// Marcar cápsula como enviada
async function markCapsuleAsSent(capsuleId) {
  try {
    const query = `
      UPDATE time_capsules 
      SET status = 'sent', sent_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [capsuleId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Cápsula não encontrada: ID ${capsuleId}`);
    }
    
    logger.info(`Cápsula marcada como enviada: ID ${capsuleId}`);
    
    return formatTimeCapsuleResponse(result.rows[0]);
    
  } catch (error) {
    logger.error(`Erro ao marcar cápsula ${capsuleId} como enviada:`, error);
    throw error;
  }
}

// Obter estatísticas das cápsulas
async function getTimeCapsuleStats(req, res) {
  logger.info('Buscando estatísticas das cápsulas');
  
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
        COUNT(CASE WHEN open_date <= NOW() AND status = 'pending' THEN 1 END) as ready_to_send,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as created_today,
        COUNT(CASE WHEN sent_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as sent_today
      FROM time_capsules
    `;
    
    const result = await db.query(statsQuery);
    const stats = result.rows[0];
    
    // Converter strings para números
    Object.keys(stats).forEach(key => {
      stats[key] = parseInt(stats[key]) || 0;
    });
    
    logger.info('Estatísticas obtidas:', stats);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: stats
    }));
    
  } catch (error) {
    logger.error('Erro ao obter estatísticas:', error);
    
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Erro interno do servidor ao obter estatísticas'
    }));
  }
}

module.exports = {
  createTimeCapsule,
  getTimeCapsules,
  getTimeCapsuleById,
  getCapsulesToSend,
  markCapsuleAsSent,
  getTimeCapsuleStats,
  validateTimeCapsuleData,
  formatTimeCapsuleResponse
};