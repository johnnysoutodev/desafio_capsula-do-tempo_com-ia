const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { logger } = require('../utils/logger');

// Configurações de upload
const UPLOAD_CONFIG = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimes: [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  uploadDir: path.join(__dirname, '../../../uploads'),
  maxFiles: 1
};

// Garantir que diretório de upload existe
function ensureUploadDirectory() {
  if (!fs.existsSync(UPLOAD_CONFIG.uploadDir)) {
    fs.mkdirSync(UPLOAD_CONFIG.uploadDir, { recursive: true });
    logger.info('Diretório de uploads criado:', UPLOAD_CONFIG.uploadDir);
  }
}

// Configuração de storage do multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDirectory();
    cb(null, UPLOAD_CONFIG.uploadDir);
  },
  
  filename: (req, file, cb) => {
    // Gerar nome único para o arquivo
    const uniqueSuffix = crypto.randomUUID();
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = `capsule-${Date.now()}-${uniqueSuffix}${extension}`;
    
    // Salvar informações no request para uso posterior
    req.uploadInfo = {
      originalName: file.originalname,
      filename: filename,
      mimetype: file.mimetype
    };
    
    logger.debug(`Upload: ${file.originalname} -> ${filename}`);
    cb(null, filename);
  }
});

// Filtro de arquivos
const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype.toLowerCase();
  
  // Verificar extensão
  if (!UPLOAD_CONFIG.allowedExtensions.includes(extension)) {
    const error = new Error(`Extensão não permitida: ${extension}`);
    error.code = 'INVALID_EXTENSION';
    return cb(error, false);
  }
  
  // Verificar MIME type
  if (!UPLOAD_CONFIG.allowedMimes.includes(mimetype)) {
    const error = new Error(`Tipo de arquivo não permitido: ${mimetype}`);
    error.code = 'INVALID_MIMETYPE';
    return cb(error, false);
  }
  
  logger.debug(`Arquivo aceito: ${file.originalname} (${mimetype})`);
  cb(null, true);
};

// Configuração do multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: UPLOAD_CONFIG.maxFileSize,
    files: UPLOAD_CONFIG.maxFiles
  }
});

// Middleware para tratar upload de imagem
const uploadMiddleware = (req, res, next) => {
  const uploadSingle = upload.single('image');
  
  uploadSingle(req, res, (error) => {
    if (error) {
      logger.error('Erro no upload:', error);
      
      let statusCode = 400;
      let message = 'Erro no upload do arquivo';
      
      if (error instanceof multer.MulterError) {
        switch (error.code) {
          case 'LIMIT_FILE_SIZE':
            message = `Arquivo muito grande. Máximo: ${UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB`;
            break;
          case 'LIMIT_FILE_COUNT':
            message = `Muitos arquivos. Máximo: ${UPLOAD_CONFIG.maxFiles}`;
            break;
          case 'LIMIT_UNEXPECTED_FILE':
            message = 'Campo de arquivo inesperado';
            break;
          default:
            message = `Erro de upload: ${error.message}`;
        }
      } else if (error.code === 'INVALID_EXTENSION') {
        message = `${error.message}. Permitidas: ${UPLOAD_CONFIG.allowedExtensions.join(', ')}`;
      } else if (error.code === 'INVALID_MIMETYPE') {
        message = `${error.message}. Permitidos: ${UPLOAD_CONFIG.allowedMimes.join(', ')}`;
      }
      
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: message,
        allowedExtensions: UPLOAD_CONFIG.allowedExtensions,
        allowedMimes: UPLOAD_CONFIG.allowedMimes,
        maxFileSize: `${UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB`
      }));
      return;
    }
    
    // Verificar se arquivo foi enviado
    if (!req.file) {
      logger.warn('Nenhum arquivo enviado');
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Nenhuma imagem foi enviada',
        field: 'image'
      }));
      return;
    }
    
    // Log do upload bem-sucedido
    logger.info(`Upload bem-sucedido: ${req.file.originalname} (${req.file.size} bytes)`);
    
    // Adicionar informações do arquivo ao request
    req.uploadedFile = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      relativePath: `/uploads/${req.file.filename}`
    };
    
    next();
  });
};

// Função para validar imagem após upload
function validateUploadedImage(filePath) {
  try {
    const stats = fs.statSync(filePath);
    
    // Verificar tamanho mínimo (1KB)
    if (stats.size < 1024) {
      throw new Error('Arquivo muito pequeno (mínimo 1KB)');
    }
    
    // Verificar tamanho máximo
    if (stats.size > UPLOAD_CONFIG.maxFileSize) {
      throw new Error(`Arquivo muito grande (máximo ${UPLOAD_CONFIG.maxFileSize / 1024 / 1024}MB)`);
    }
    
    return true;
  } catch (error) {
    logger.error('Erro na validação da imagem:', error);
    throw error;
  }
}

// Função para remover arquivo
function removeFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Arquivo removido: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Erro ao remover arquivo ${filePath}:`, error);
    return false;
  }
}

// Função para limpar uploads antigos
function cleanupOldUploads(daysOld = 30) {
  try {
    const files = fs.readdirSync(UPLOAD_CONFIG.uploadDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let removedCount = 0;
    
    files.forEach(file => {
      const filePath = path.join(UPLOAD_CONFIG.uploadDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.mtime < cutoffDate) {
        if (removeFile(filePath)) {
          removedCount++;
        }
      }
    });
    
    if (removedCount > 0) {
      logger.info(`Limpeza de uploads: ${removedCount} arquivos antigos removidos`);
    }
    
    return removedCount;
  } catch (error) {
    logger.error('Erro na limpeza de uploads:', error);
    return 0;
  }
}

// Função para obter informações de um arquivo
function getFileInfo(filename) {
  const filePath = path.join(UPLOAD_CONFIG.uploadDir, filename);
  
  try {
    const stats = fs.statSync(filePath);
    return {
      exists: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      path: filePath,
      relativePath: `/uploads/${filename}`
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

module.exports = {
  uploadMiddleware,
  validateUploadedImage,
  removeFile,
  cleanupOldUploads,
  getFileInfo,
  UPLOAD_CONFIG,
  ensureUploadDirectory
};