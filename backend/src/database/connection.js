const { Client } = require('pg');
const { logger } = require('../utils/logger');

let dbClient = null;

// Configuração da conexão com PostgreSQL
function getConnectionConfig() {
  // Se estiver no Railway, usar DATABASE_URL com SSL obrigatório
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      // Railway SEMPRE precisa de SSL
      ssl: {
        rejectUnauthorized: false,
        require: true
      },
      // Timeouts específicos para Railway
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      query_timeout: 60000,
      statement_timeout: 60000,
      // Pool settings para Railway
      max: 20,
      min: 0,
      acquireTimeoutMillis: 60000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    };
  }

  // Configuração manual para desenvolvimento local
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT) || 5432,
    database: process.env.POSTGRES_DB || 'capsula_tempo',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    ssl: false,
    connectionTimeoutMillis: 10000
  };
}

// Função para conectar ao banco com retry
async function connectToDatabase(retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const config = getConnectionConfig();
      
      // Log da conexão (sem mostrar senha)
      const logConfig = { ...config };
      if (logConfig.connectionString) {
        logConfig.connectionString = logConfig.connectionString.replace(/:([^:@]+)@/, ':****@');
      }
      if (logConfig.password) {
        logConfig.password = '****';
      }
      
      logger.info(`🔗 Tentativa ${attempt}/${retries} - Conectando ao PostgreSQL...`);
      logger.info('📍 Configuração:', { 
        host: logConfig.connectionString ? 'Railway Proxy' : logConfig.host,
        port: logConfig.port || 'URL',
        ssl: !!logConfig.ssl
      });
      
      dbClient = new Client(config);
      
      // Conectar com timeout
      await Promise.race([
        dbClient.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 30000)
        )
      ]);
      
      logger.info('✅ Conexão com PostgreSQL estabelecida');
      
      // Testar conexão
      const result = await dbClient.query('SELECT NOW() as current_time, version() as pg_version');
      logger.info(`⏰ Teste de conexão bem-sucedido: ${result.rows[0].current_time}`);
      logger.info(`🐘 PostgreSQL Version: ${result.rows[0].pg_version.split(' ')[0]}`);
      
      return dbClient;
      
    } catch (error) {
      logger.error(`❌ Tentativa ${attempt}/${retries} falhou:`, error.message);
      logger.error('📍 Código do erro:', error.code);
      
      if (dbClient) {
        try {
          await dbClient.end();
        } catch (e) {
          // Ignorar erro ao fechar conexão falha
        }
        dbClient = null;
      }
      
      if (attempt < retries) {
        const delay = parseInt(process.env.DB_RETRY_DELAY) || 2000;
        logger.info(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

// Função para executar queries
async function query(text, params = []) {
  if (!dbClient) {
    throw new Error('Banco de dados não conectado. Execute initializeDatabase() primeiro.');
  }
  
  try {
    const start = Date.now();
    logger.debug(`🔍 Executando query: ${text.substring(0, 100)}...`);
    
    const result = await dbClient.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug(`✅ Query executada em ${duration}ms, ${result.rowCount} linha(s) afetada(s)`);
    return result;
  } catch (error) {
    logger.error('❌ Erro na query:', error.message);
    logger.error('📝 Query que falhou:', text);
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
    logger.error(`❌ Erro ao verificar tabela ${tableName}:`, error);
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
      
      -- Constraints para garantir integridade
      CONSTRAINT chk_status CHECK (status IN ('pending', 'sent', 'failed', 'error')),
      CONSTRAINT chk_delivery_date CHECK (delivery_date > created_at),
      CONSTRAINT chk_name_length CHECK (char_length(name) >= 2),
      CONSTRAINT chk_email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za_z]{2,}$')
    );
  `;

  const createIndexesQuery = `
    -- Criar índices para otimização das queries
    CREATE INDEX IF NOT EXISTS idx_time_capsules_status 
    ON time_capsules(status);
    
    CREATE INDEX IF NOT EXISTS idx_time_capsules_delivery_date 
    ON time_capsules(delivery_date);
    
    CREATE INDEX IF NOT EXISTS idx_time_capsules_status_delivery 
    ON time_capsules(status, delivery_date) 
    WHERE status = 'pending';
    
    CREATE INDEX IF NOT EXISTS idx_time_capsules_email 
    ON time_capsules(email);
  `;

  try {
    logger.info('📋 Criando/verificando tabela time_capsules...');
    await query(createTableQuery);
    
    logger.info('📊 Criando índices de otimização...');
    await query(createIndexesQuery);
    
    logger.info('✅ Tabela time_capsules criada/verificada com sucesso');
    
    // Verificar estrutura da tabela
    const columnsResult = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'time_capsules' 
      ORDER BY ordinal_position;
    `);
    
    logger.info(`📊 Estrutura da tabela (${columnsResult.rows.length} colunas):`, 
      columnsResult.rows.map(row => `${row.column_name} (${row.data_type})`).join(', ')
    );
    
  } catch (error) {
    logger.error('❌ Erro ao criar tabela time_capsules:', error);
    throw error;
  }
}

// Função para inicializar banco de dados
async function initializeDatabase() {
  try {
    logger.info('🚀 Inicializando banco de dados...');
    
    // Conectar ao banco com retry
    await connectToDatabase(3);
    
    // Criar tabelas necessárias
    await createTimeCapsuleTable();
    
    // Verificar se há dados existentes
    const countResult = await query('SELECT COUNT(*) as total FROM time_capsules');
    logger.info(`📦 Total de cápsulas existentes: ${countResult.rows[0].total}`);
    
    logger.info('🎉 Banco de dados inicializado com sucesso');
    return true;
  } catch (error) {
    logger.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

// Função para fechar conexão
async function closeConnection() {
  if (dbClient) {
    try {
      await dbClient.end();
      dbClient = null;
      logger.info('🔌 Conexão com banco de dados fechada');
    } catch (error) {
      logger.error('❌ Erro ao fechar conexão:', error);
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
      version: result.rows[0].pg_version.split(' ')[0],
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

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('🛑 Recebido SIGINT, fechando conexão com banco...');
  await closeConnection();
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Recebido SIGTERM, fechando conexão com banco...');
  await closeConnection();
});

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