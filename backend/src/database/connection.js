const { Client } = require('pg');
const { logger } = require('../utils/logger');

let dbClient = null;

// Configuração da conexão com PostgreSQL
function getConnectionConfig() {
  // Se estiver no Railway, usar DATABASE_URL
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  }

  // Configuração manual para desenvolvimento local
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'capsula_tempo',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    ssl: false
  };
}

// Função para conectar ao banco
async function connectToDatabase() {
  try {
    const config = getConnectionConfig();
    dbClient = new Client(config);
    
    await dbClient.connect();
    logger.info('Conexão com PostgreSQL estabelecida');
    
    // Testar conexão
    const result = await dbClient.query('SELECT NOW()');
    logger.info(`Teste de conexão bem-sucedido: ${result.rows[0].now}`);
    
    return dbClient;
  } catch (error) {
    logger.error('Erro ao conectar com PostgreSQL:', error.message);
    throw error;
  }
}

// Função para executar queries
async function query(text, params = []) {
  if (!dbClient) {
    throw new Error('Banco de dados não conectado');
  }
  
  try {
    logger.info(`Executando query: ${text}`);
    const result = await dbClient.query(text, params);
    return result;
  } catch (error) {
    logger.error('Erro na query:', error.message);
    throw error;
  }
}

// Função para verificar se tabela existe
async function tableExists(tableName) {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    
    return result.rows[0].exists;
  } catch (error) {
    logger.error(`Erro ao verificar tabela ${tableName}:`, error);
    return false;
  }
}

// Função para criar tabela time_capsules
async function createTimeCapsuleTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS time_capsules (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      email VARCHAR(100) NOT NULL,
      message TEXT NOT NULL,
      delivery_date TIMESTAMP NOT NULL,
      image_path VARCHAR(255) NOT NULL,
      image_original_name VARCHAR(255) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP NULL,
      
      -- Índices para otimização
      CONSTRAINT chk_status CHECK (status IN ('pending', 'sent', 'failed'))
    );
    
    -- Criar índices para otimização das queries
    CREATE INDEX IF NOT EXISTS idx_time_capsules_status 
    ON time_capsules(status);
    
    CREATE INDEX IF NOT EXISTS idx_time_capsules_delivery_date 
    ON time_capsules(delivery_date);
    
    CREATE INDEX IF NOT EXISTS idx_time_capsules_status_delivery 
    ON time_capsules(status, delivery_date);
  `;

  try {
    await query(createTableQuery);
    logger.info('Tabela time_capsules criada/verificada com sucesso');
  } catch (error) {
    logger.error('Erro ao criar tabela time_capsules:', error);
    throw error;
  }
}

// Função para inicializar banco de dados
async function initializeDatabase() {
  try {
    // Conectar ao banco
    await connectToDatabase();
    
    // Criar tabelas necessárias
    await createTimeCapsuleTable();
    
    logger.info('Banco de dados inicializado com sucesso');
  } catch (error) {
    logger.error('Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

// Função para fechar conexão
async function closeConnection() {
  if (dbClient) {
    try {
      await dbClient.end();
      dbClient = null;
      logger.info('Conexão com banco de dados fechada');
    } catch (error) {
      logger.error('Erro ao fechar conexão:', error);
    }
  }
}

// Função para verificar saúde da conexão
async function checkDatabaseHealth() {
  try {
    if (!dbClient) {
      return { status: 'disconnected', error: 'Cliente não conectado' };
    }
    
    const result = await query('SELECT NOW() as current_time, version() as pg_version');
    return {
      status: 'connected',
      currentTime: result.rows[0].current_time,
      version: result.rows[0].pg_version,
      connected: true
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      connected: false
    };
  }
}

module.exports = {
  initializeDatabase,
  connectToDatabase,
  query,
  closeConnection,
  checkDatabaseHealth,
  tableExists,
  createTimeCapsuleTable,
  getClient: () => dbClient
};