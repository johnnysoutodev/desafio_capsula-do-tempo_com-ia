const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');

// Configuração do email
const EMAIL_CONFIG = {
  // Configurações principais
  service: process.env.EMAIL_SERVICE || 'gmail',
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true para 465, false para outras portas
  
  // Credenciais
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASS,
  
  // Configurações de envio
  from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
  fromName: process.env.EMAIL_FROM_NAME || 'Cápsula do Tempo',
  
  // Configurações de retry
  maxRetries: 3,
  retryDelay: 5000, // 5 segundos
  
  // Rate limiting
  maxConcurrent: 3,
  messagePerSecond: 1
};

// Validar configurações de email
function validateEmailConfig() {
  const errors = [];
  
  if (!EMAIL_CONFIG.user) {
    errors.push('EMAIL_USER é obrigatório');
  }
  
  if (!EMAIL_CONFIG.pass) {
    errors.push('EMAIL_PASS é obrigatório');
  }
  
  if (errors.length > 0) {
    logger.error('Configuração de email inválida:', errors);
    return false;
  }
  
  return true;
}

// Criar transporter do nodemailer
function createTransporter() {
  if (!validateEmailConfig()) {
    throw new Error('Configuração de email inválida');
  }
  
  const config = {
    host: EMAIL_CONFIG.host,
    port: EMAIL_CONFIG.port,
    secure: EMAIL_CONFIG.secure,
    auth: {
      user: EMAIL_CONFIG.user,
      pass: EMAIL_CONFIG.pass
    },
    pool: true,
    maxConnections: EMAIL_CONFIG.maxConcurrent,
    rateLimit: EMAIL_CONFIG.messagePerSecond
  };
  
  // Configurações específicas por serviço
  if (EMAIL_CONFIG.service && EMAIL_CONFIG.service !== 'custom') {
    config.service = EMAIL_CONFIG.service;
  }
  
  logger.debug('Criando transporter de email:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    service: config.service || 'custom',
    user: config.auth.user
  });
  
  return nodemailer.createTransporter(config);
}

// Template HTML do email
function getEmailTemplate(capsule) {
  const formatDate = (date) => {
    return new Date(date).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sua Cápsula do Tempo Chegou!</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 300;
        }
        .content {
            padding: 30px;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #667eea;
        }
        .message-box {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .message {
            font-style: italic;
            font-size: 16px;
            line-height: 1.8;
            color: #555;
        }
        .image-container {
            text-align: center;
            margin: 20px 0;
        }
        .image-container img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .metadata {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            font-size: 14px;
            color: #666;
        }
        .metadata strong {
            color: #333;
        }
        .footer {
            background: #333;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 14px;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        @media (max-width: 600px) {
            .container {
                margin: 10px;
                border-radius: 5px;
            }
            .header, .content {
                padding: 20px;
            }
            .header h1 {
                font-size: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🕰️ Cápsula do Tempo</h1>
            <p>Sua mensagem do passado chegou!</p>
        </div>
        
        <div class="content">
            <div class="greeting">
                Olá, <strong>${capsule.name}</strong>! 👋
            </div>
            
            <p>
                Você está recebendo este email porque criou uma cápsula do tempo em 
                <strong>${formatDate(capsule.createdAt)}</strong> para ser aberta hoje.
            </p>
            
            <div class="message-box">
                <div class="message">
                    "${capsule.message}"
                </div>
            </div>
            
            ${capsule.imageUrl ? `
            <div class="image-container">
                <img src="cid:timeCapsuleImage" alt="Imagem da sua cápsula do tempo" />
            </div>
            ` : ''}
            
            <div class="metadata">
                <strong>📅 Data de criação:</strong> ${formatDate(capsule.createdAt)}<br>
                <strong>🎯 Data programada:</strong> ${formatDate(capsule.openDate)}<br>
                <strong>📧 Email:</strong> ${capsule.email}
            </div>
            
            <p>
                Esperamos que esta mensagem do seu passado traga boas lembranças e 
                momentos especiais. Continue criando mais cápsulas do tempo para 
                preservar seus momentos importantes!
            </p>
        </div>
        
        <div class="footer">
            <p>
                💜 Feito com carinho pela equipe Cápsula do Tempo<br>
                <a href="mailto:${EMAIL_CONFIG.user}">Entre em contato</a>
            </p>
        </div>
    </div>
</body>
</html>
  `;
}

// Função principal para enviar email
async function sendTimeCapsuleEmail(capsule, retryCount = 0) {
  logger.info(`Tentando enviar email para ${capsule.email} (tentativa ${retryCount + 1})`);
  
  try {
    const transporter = createTransporter();
    
    // Preparar attachments
    const attachments = [];
    
    // Adicionar imagem se existir
    if (capsule.imagePath && fs.existsSync(capsule.imagePath)) {
      attachments.push({
        filename: path.basename(capsule.imagePath),
        path: capsule.imagePath,
        cid: 'timeCapsuleImage'
      });
    }
    
    // Configurar email
    const mailOptions = {
      from: `"${EMAIL_CONFIG.fromName}" <${EMAIL_CONFIG.from}>`,
      to: capsule.email,
      subject: `🕰️ Sua Cápsula do Tempo de ${new Date(capsule.createdAt).toLocaleDateString('pt-BR')}`,
      html: getEmailTemplate(capsule),
      attachments: attachments,
      
      // Headers personalizados
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };
    
    logger.debug('Enviando email:', {
      to: mailOptions.to,
      subject: mailOptions.subject,
      attachments: attachments.length,
      capsuleId: capsule.id
    });
    
    // Enviar email
    const info = await transporter.sendMail(mailOptions);
    
    logger.emailSent(`Email enviado com sucesso para ${capsule.email}`, {
      messageId: info.messageId,
      response: info.response,
      capsuleId: capsule.id,
      accepted: info.accepted,
      rejected: info.rejected
    });
    
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
    
  } catch (error) {
    logger.error(`Erro ao enviar email (tentativa ${retryCount + 1}):`, {
      error: error.message,
      stack: error.stack,
      capsuleId: capsule.id,
      email: capsule.email
    });
    
    // Tentar novamente se não atingiu o limite
    if (retryCount < EMAIL_CONFIG.maxRetries - 1) {
      logger.info(`Reagendando envio em ${EMAIL_CONFIG.retryDelay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, EMAIL_CONFIG.retryDelay));
      return sendTimeCapsuleEmail(capsule, retryCount + 1);
    }
    
    // Falha definitiva
    logger.error(`Falha definitiva no envio de email para ${capsule.email} após ${EMAIL_CONFIG.maxRetries} tentativas`);
    
    return {
      success: false,
      error: error.message,
      retries: retryCount + 1
    };
  }
}

// Função para testar configuração de email
async function testEmailConfiguration() {
  logger.info('Testando configuração de email...');
  
  try {
    if (!validateEmailConfig()) {
      throw new Error('Configuração inválida');
    }
    
    const transporter = createTransporter();
    
    // Verificar conexão
    const isConnected = await transporter.verify();
    
    if (isConnected) {
      logger.info('Teste de email: ✅ Configuração válida');
      return { success: true, message: 'Configuração de email válida' };
    } else {
      throw new Error('Falha na verificação de conexão');
    }
    
  } catch (error) {
    logger.error('Teste de email: ❌ Falha na configuração:', error.message);
    return { success: false, error: error.message };
  }
}

// Função para enviar email de teste
async function sendTestEmail(toEmail) {
  logger.info(`Enviando email de teste para: ${toEmail}`);
  
  try {
    const transporter = createTransporter();
    
    const testEmailOptions = {
      from: `"${EMAIL_CONFIG.fromName}" <${EMAIL_CONFIG.from}>`,
      to: toEmail,
      subject: '🧪 Teste - Sistema de Cápsula do Tempo',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
            <h2 style="color: #667eea;">🧪 Email de Teste</h2>
            <p>Este é um email de teste do sistema de Cápsula do Tempo.</p>
            <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            <p><strong>Status:</strong> ✅ Sistema funcionando corretamente!</p>
            <hr style="margin: 20px 0; border: 1px solid #eee;">
            <p style="color: #666; font-size: 14px;">
              Se você recebeu este email, significa que o sistema de envio está configurado corretamente.
            </p>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(testEmailOptions);
    
    logger.info(`Email de teste enviado com sucesso: ${info.messageId}`);
    
    return {
      success: true,
      messageId: info.messageId,
      message: 'Email de teste enviado com sucesso'
    };
    
  } catch (error) {
    logger.error('Erro ao enviar email de teste:', error);
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  sendTimeCapsuleEmail,
  testEmailConfiguration,
  sendTestEmail,
  EMAIL_CONFIG,
  validateEmailConfig
};