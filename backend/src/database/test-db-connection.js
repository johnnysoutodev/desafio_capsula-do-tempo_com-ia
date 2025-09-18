require('dotenv').config();
const { Client } = require('pg');

async function testConnection() {
  console.log('🔍 Testando conexão com PostgreSQL...');
  console.log('URL:', process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Para Railway
    }
  });

  try {
    console.log('📡 Conectando...');
    await client.connect();
    console.log('✅ Conectado com sucesso!');
    
    console.log('🔍 Testando query...');
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Query executada:', result.rows[0]);
    
  } catch (error) {
    console.log('❌ Erro de conexão:');
    console.log('Código:', error.code);
    console.log('Mensagem:', error.message);
    console.log('Detalhes:', error.detail || 'N/A');
  } finally {
    await client.end();
  }
}

testConnection();