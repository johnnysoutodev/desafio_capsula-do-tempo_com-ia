const cron = require('node-cron');
const { getCapsulesToSend, markCapsuleAsSent } = require('../src/controllers/timeCapsuleController');
const { sendTimeCapsuleEmail } = require('../src/services/emailService');
const { logger } = require('../src/utils/logger');

// Configurações do scheduler
const SCHEDULER_CONFIG = {
  // Cron pattern: verifica a cada 5 minutos
  cronPattern: process.env.CRON_PATTERN || '*/5 * * * *',
  
  // Timezone
  timezone: process.env.TZ || 'America/Sao_Paulo',
  
  // Configurações de processamento
  maxConcurrentEmails: parseInt(process.env.MAX_CONCURRENT_EMAILS) || 3,
  delayBetweenEmails: parseInt(process.env.DELAY_BETWEEN_EMAILS) || 2000, // 2 segundos
  
  // Configurações de retry
  maxRetries: 3,
  retryDelay: 30000, // 30 segundos
  
  // Configurações de monitoramento
  enableHealthCheck: true,
  maxProcessingTime: 300000, // 5 minutos
  
  // Estado do scheduler
  isRunning: false,
  lastRun: null,
  nextRun: null,
  totalProcessed: 0,
  totalErrors: 0
};

// Estado atual do processamento
let processingState = {
  isProcessing: false,
  startTime: null,
  processedCount: 0,
  errorCount: 0,
  currentBatch: []
};

// Função para processar uma cápsula individual
async function processCapsule(capsule) {
  logger.info(`Processando cápsula ID ${capsule.id} para ${capsule.email}`);
  
  try {
    // Enviar email
    const emailResult = await sendTimeCapsuleEmail(capsule);
    
    if (emailResult.success) {
      // Marcar como enviada no banco
      await markCapsuleAsSent(capsule.id);
      
      logger.schedulerSuccess(`Cápsula ID ${capsule.id} processada com sucesso`);
      
      return {
        success: true,
        capsuleId: capsule.id,
        email: capsule.email,
        messageId: emailResult.messageId
      };
    } else {
      throw new Error(emailResult.error || 'Falha no envio de email');
    }
    
  } catch (error) {
    logger.error(`Erro ao processar cápsula ID ${capsule.id}:`, error);
    
    return {
      success: false,
      capsuleId: capsule.id,
      email: capsule.email,
      error: error.message
    };
  }
}

// Função para processar cápsulas em lote
async function processBatch(capsules) {
  const results = [];
  const batches = [];
  
  // Dividir em lotes menores para processamento concorrente
  for (let i = 0; i < capsules.length; i += SCHEDULER_CONFIG.maxConcurrentEmails) {
    batches.push(capsules.slice(i, i + SCHEDULER_CONFIG.maxConcurrentEmails));
  }
  
  logger.info(`Processando ${capsules.length} cápsulas em ${batches.length} lotes`);
  
  for (const batch of batches) {
    logger.debug(`Processando lote de ${batch.length} cápsulas`);
    
    // Processar lote atual em paralelo
    const batchPromises = batch.map(capsule => processCapsule(capsule));
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Processar resultados do lote
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        
        if (result.value.success) {
          processingState.processedCount++;
          SCHEDULER_CONFIG.totalProcessed++;
        } else {
          processingState.errorCount++;
          SCHEDULER_CONFIG.totalErrors++;
        }
      } else {
        logger.error(`Erro crítico no processamento da cápsula ${batch[index].id}:`, result.reason);
        
        results.push({
          success: false,
          capsuleId: batch[index].id,
          email: batch[index].email,
          error: result.reason.message || 'Erro crítico'
        });
        
        processingState.errorCount++;
        SCHEDULER_CONFIG.totalErrors++;
      }
    });
    
    // Delay entre lotes se não for o último
    if (batch !== batches[batches.length - 1] && SCHEDULER_CONFIG.delayBetweenEmails > 0) {
      logger.debug(`Aguardando ${SCHEDULER_CONFIG.delayBetweenEmails}ms antes do próximo lote`);
      await new Promise(resolve => setTimeout(resolve, SCHEDULER_CONFIG.delayBetweenEmails));
    }
  }
  
  return results;
}

// Função principal do scheduler
async function runScheduler() {
  if (processingState.isProcessing) {
    logger.warn('Scheduler já está processando, pulando execução');
    return;
  }
  
  processingState.isProcessing = true;
  processingState.startTime = new Date();
  processingState.processedCount = 0;
  processingState.errorCount = 0;
  processingState.currentBatch = [];
  
  logger.schedulerRun('Iniciando verificação de cápsulas do tempo');
  
  try {
    // Buscar cápsulas prontas para envio
    const capsulesToSend = await getCapsulesToSend();
    
    if (capsulesToSend.length === 0) {
      logger.schedulerRun('Nenhuma cápsula pronta para envio');
      return;
    }
    
    logger.schedulerRun(`Encontradas ${capsulesToSend.length} cápsulas para processar`);
    
    processingState.currentBatch = capsulesToSend;
    
    // Processar cápsulas
    const results = await processBatch(capsulesToSend);
    
    // Gerar relatório
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    const duration = Date.now() - processingState.startTime;
    
    logger.schedulerRun(`Processamento concluído: ${successCount} enviadas, ${errorCount} falhas em ${duration}ms`);
    
    // Log detalhado se houver erros
    if (errorCount > 0) {
      const errors = results.filter(r => !r.success);
      logger.error('Cápsulas com falha:', errors.map(e => ({
        id: e.capsuleId,
        email: e.email,
        error: e.error
      })));
    }
    
    // Atualizar estatísticas
    SCHEDULER_CONFIG.lastRun = new Date();
    
  } catch (error) {
    logger.error('Erro crítico no scheduler:', error);
    SCHEDULER_CONFIG.totalErrors++;
  } finally {
    processingState.isProcessing = false;
    processingState.startTime = null;
    processingState.currentBatch = [];
  }
}

// Função para iniciar o scheduler
function startScheduler() {
  if (SCHEDULER_CONFIG.isRunning) {
    logger.warn('Scheduler já está em execução');
    return false;
  }
  
  logger.info(`Iniciando scheduler com padrão: ${SCHEDULER_CONFIG.cronPattern}`);
  logger.info(`Timezone: ${SCHEDULER_CONFIG.timezone}`);
  logger.info(`Max concurrent emails: ${SCHEDULER_CONFIG.maxConcurrentEmails}`);
  
  // Validar padrão cron
  if (!cron.validate(SCHEDULER_CONFIG.cronPattern)) {
    logger.error(`Padrão cron inválido: ${SCHEDULER_CONFIG.cronPattern}`);
    return false;
  }
  
  // Criar job cron
  const schedulerJob = cron.schedule(SCHEDULER_CONFIG.cronPattern, async () => {
    try {
      await runScheduler();
    } catch (error) {
      logger.error('Erro no job do scheduler:', error);
    }
  }, {
    scheduled: false,
    timezone: SCHEDULER_CONFIG.timezone
  });
  
  // Iniciar o job
  schedulerJob.start();
  
  SCHEDULER_CONFIG.isRunning = true;
  SCHEDULER_CONFIG.nextRun = schedulerJob.nextDate();
  
  logger.schedulerRun(`Scheduler iniciado com sucesso. Próxima execução: ${SCHEDULER_CONFIG.nextRun}`);
  
  // Executar uma vez imediatamente se houver cápsulas pendentes
  setTimeout(async () => {
    logger.info('Executando verificação inicial...');
    await runScheduler();
  }, 5000); // 5 segundos após o início
  
  return true;
}

// Função para parar o scheduler
function stopScheduler() {
  if (!SCHEDULER_CONFIG.isRunning) {
    logger.warn('Scheduler não está em execução');
    return false;
  }
  
  logger.info('Parando scheduler...');
  
  // Aguardar processamento atual se estiver rodando
  const waitForProcessing = () => {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!processingState.isProcessing) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 1000);
    });
  };
  
  return waitForProcessing().then(() => {
    SCHEDULER_CONFIG.isRunning = false;
    SCHEDULER_CONFIG.nextRun = null;
    
    logger.schedulerRun('Scheduler parado com sucesso');
    return true;
  });
}

// Função para obter status do scheduler
function getSchedulerStatus() {
  const status = {
    isRunning: SCHEDULER_CONFIG.isRunning,
    isProcessing: processingState.isProcessing,
    cronPattern: SCHEDULER_CONFIG.cronPattern,
    timezone: SCHEDULER_CONFIG.timezone,
    lastRun: SCHEDULER_CONFIG.lastRun,
    nextRun: SCHEDULER_CONFIG.nextRun,
    
    // Estatísticas totais
    totalProcessed: SCHEDULER_CONFIG.totalProcessed,
    totalErrors: SCHEDULER_CONFIG.totalErrors,
    
    // Estado atual
    currentProcessing: processingState.isProcessing ? {
      startTime: processingState.startTime,
      processedCount: processingState.processedCount,
      errorCount: processingState.errorCount,
      currentBatchSize: processingState.currentBatch.length
    } : null,
    
    // Configurações
    config: {
      maxConcurrentEmails: SCHEDULER_CONFIG.maxConcurrentEmails,
      delayBetweenEmails: SCHEDULER_CONFIG.delayBetweenEmails,
      maxRetries: SCHEDULER_CONFIG.maxRetries,
      retryDelay: SCHEDULER_CONFIG.retryDelay
    }
  };
  
  return status;
}

// Função para executar scheduler manualmente
async function runSchedulerManually() {
  logger.info('Executando scheduler manualmente...');
  
  try {
    await runScheduler();
    return {
      success: true,
      message: 'Scheduler executado com sucesso',
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Erro na execução manual do scheduler:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date()
    };
  }
}

// Função para resetar estatísticas
function resetSchedulerStats() {
  logger.info('Resetando estatísticas do scheduler');
  
  SCHEDULER_CONFIG.totalProcessed = 0;
  SCHEDULER_CONFIG.totalErrors = 0;
  SCHEDULER_CONFIG.lastRun = null;
  
  return {
    success: true,
    message: 'Estatísticas resetadas',
    timestamp: new Date()
  };
}

module.exports = {
  startScheduler,
  stopScheduler,
  runSchedulerManually,
  getSchedulerStatus,
  resetSchedulerStats,
  SCHEDULER_CONFIG
};