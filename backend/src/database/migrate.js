const { initializeDatabase, query, closeConnection } = require('./connection');
const { logger } = require('../utils/logger');

// Script de migração para configurar o banco de dados
async function runMigrations() {
  try {
    logger.info('🚀 Iniciando migrações do banco de dados...');

    // Inicializar conexão
    await initializeDatabase();

    // Verificar se existem dados de teste
    const result = await query('SELECT COUNT(*) as count FROM time_capsules');
    const capsuleCount = parseInt(result.rows[0].count);

    logger.info(`📊 Total de cápsulas existentes: ${capsuleCount}`);

    // Se não há dados e está em desenvolvimento, criar dados de exemplo
    if (capsuleCount === 0 && process.env.NODE_ENV !== 'production') {
      await createSampleData();
    }

    logger.info('✅ Migrações concluídas com sucesso!');
    
  } catch (error) {
    logger.error('❌ Erro nas migrações:', error);
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

// Função para criar dados de exemplo (apenas desenvolvimento)
async function createSampleData() {
  logger.info('📝 Criando dados de exemplo para desenvolvimento...');

  const sampleCapsules = [
    {
      name: 'João Silva',
      email: 'joao@exemplo.com',
      message: 'Esta é uma mensagem de teste para o futuro! Espero que tudo esteja bem em 2024.',
      delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas no futuro
      image_path: '/uploads/sample-image-1.jpg',
      image_original_name: 'foto-joao.jpg'
    },
    {
      name: 'Maria Santos',
      email: 'maria@exemplo.com',
      message: 'Lembrança especial do passado! Esta foto foi tirada em um dia muito importante.',
      delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias no futuro
      image_path: '/uploads/sample-image-2.jpg',
      image_original_name: 'memoria-maria.jpg'
    },
    {
      name: 'Pedro Costa',
      email: 'pedro@exemplo.com',
      message: 'Mensagem para meu eu do futuro: continue sempre perseguindo seus sonhos!',
      delivery_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias no futuro
      image_path: '/uploads/sample-image-3.jpg',
      image_original_name: 'sonhos-pedro.jpg'
    }
  ];

  for (const capsule of sampleCapsules) {
    try {
      await query(`
        INSERT INTO time_capsules (
          name, email, message, delivery_date, 
          image_path, image_original_name
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        capsule.name,
        capsule.email,
        capsule.message,
        capsule.delivery_date,
        capsule.image_path,
        capsule.image_original_name
      ]);
      
      logger.info(`✅ Cápsula de exemplo criada para ${capsule.name}`);
    } catch (error) {
      logger.error(`❌ Erro ao criar cápsula de exemplo:`, error);
    }
  }

  logger.info(`📦 ${sampleCapsules.length} cápsulas de exemplo criadas`);
}

// Função para limpar dados de teste
async function clearSampleData() {
  logger.info('🧹 Limpando dados de exemplo...');
  
  try {
    await initializeDatabase();
    
    const result = await query(`
      DELETE FROM time_capsules 
      WHERE email IN ('joao@exemplo.com', 'maria@exemplo.com', 'pedro@exemplo.com')
    `);
    
    logger.info(`🗑️ ${result.rowCount} cápsulas de exemplo removidas`);
    
  } catch (error) {
    logger.error('❌ Erro ao limpar dados de exemplo:', error);
  } finally {
    await closeConnection();
  }
}

// Função para mostrar estatísticas do banco
async function showDatabaseStats() {
  try {
    await initializeDatabase();
    
    // Estatísticas gerais
    const totalResult = await query('SELECT COUNT(*) as total FROM time_capsules');
    const pendingResult = await query("SELECT COUNT(*) as pending FROM time_capsules WHERE status = 'pending'");
    const sentResult = await query("SELECT COUNT(*) as sent FROM time_capsules WHERE status = 'sent'");
    
    // Próximas cápsulas
    const upcomingResult = await query(`
      SELECT name, email, delivery_date 
      FROM time_capsules 
      WHERE status = 'pending' 
      ORDER BY delivery_date ASC 
      LIMIT 5
    `);

    logger.info('📊 === ESTATÍSTICAS DO BANCO ===');
    logger.info(`📦 Total de cápsulas: ${totalResult.rows[0].total}`);
    logger.info(`⏳ Pendentes: ${pendingResult.rows[0].pending}`);
    logger.info(`✅ Enviadas: ${sentResult.rows[0].sent}`);
    
    if (upcomingResult.rows.length > 0) {
      logger.info('🕐 Próximas cápsulas:');
      upcomingResult.rows.forEach((capsule, index) => {
        logger.info(`  ${index + 1}. ${capsule.name} - ${capsule.delivery_date}`);
      });
    }
    
  } catch (error) {
    logger.error('❌ Erro ao obter estatísticas:', error);
  } finally {
    await closeConnection();
  }
}

// Executar migrações se chamado diretamente
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'migrate':
      runMigrations();
      break;
    case 'clear':
      clearSampleData();
      break;
    case 'stats':
      showDatabaseStats();
      break;
    default:
      logger.info('Comandos disponíveis:');
      logger.info('  npm run migrate     # Executar migrações');
      logger.info('  node src/database/migrate.js clear  # Limpar dados de exemplo');
      logger.info('  node src/database/migrate.js stats  # Mostrar estatísticas');
      runMigrations(); // Comando padrão
  }
}

module.exports = {
  runMigrations,
  createSampleData,
  clearSampleData,
  showDatabaseStats
};