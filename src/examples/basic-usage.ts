import { createSigNozLogger, LogLevel, Logger } from '../index';

// Exemplo de uso básico
async function basicExample() {
  const logger = createSigNozLogger({
    endpoint: 'https://ingest.us.signoz.cloud:443',
    apiKey: 'your-api-key',
    serviceName: 'exemplo-servico',
    serviceVersion: '1.0.0',
    environment: 'development'
  });

  // Logs básicos
  logger.info('Aplicação iniciada');
  logger.warn('Configuração de produção detectada');
  logger.error('Erro de conexão com banco de dados');
  logger.debug('Processando item da fila');
  logger.trace('Detalhes internos da operação');

  // Logs com contexto
  logger.info('Usuário autenticado', {
    userId: 'user-123',
    email: 'user@example.com',
    loginMethod: 'oauth',
    timestamp: new Date().toISOString()
  });

  // Rastreamento de requisições
  const tracedLogger = logger
    .withTraceId('trace-abc-123')
    .withSpanId('span-def-456')
    .withRequestId('req-ghi-789')
    .withUserId('user-123');

  tracedLogger.info('Processando requisição de pagamento', {
    amount: 100.50,
    currency: 'BRL',
    paymentMethod: 'credit_card'
  });

  // Child logger para contexto persistente
  const userLogger = logger.child({
    userId: 'user-123',
    sessionId: 'session-456',
    tenantId: 'tenant-789'
  });

  userLogger.info('Usuário visualizou produto', { productId: 'prod-123' });
  userLogger.info('Usuário adicionou ao carrinho', { productId: 'prod-456', quantity: 2 });

  await logger.shutdown();
}

// Exemplo de uso em diferentes cenários
async function advancedExample() {
  const logger = createSigNozLogger({
    endpoint: 'https://ingest.us.signoz.cloud:443',
    apiKey: 'your-api-key',
    serviceName: 'ecommerce-api',
    serviceVersion: '2.1.0',
    environment: 'production',
    enableTracing: true,
    enableMetrics: true
  });

  // Simulação de processamento de pedido
  const orderId = 'order-123';
  const userId = 'user-456';
  
  const orderLogger = logger
    .withRequestId(`order-${orderId}`)
    .withUserId(userId)
    .withCorrelationId(`corr-${Date.now()}`);

  try {
    orderLogger.info('Iniciando processamento de pedido', {
      orderId,
      userId,
      items: [
        { productId: 'prod-1', quantity: 2, price: 29.99 },
        { productId: 'prod-2', quantity: 1, price: 49.99 }
      ],
      totalAmount: 109.97
    });

    // Simular validação
    orderLogger.debug('Validando dados do pedido');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simular processamento de pagamento
    orderLogger.info('Processando pagamento', {
      paymentMethod: 'credit_card',
      amount: 109.97
    });
    await new Promise(resolve => setTimeout(resolve, 200));

    // Simular envio de email
    orderLogger.info('Enviando confirmação por email', {
      email: 'user@example.com',
      template: 'order-confirmation'
    });
    await new Promise(resolve => setTimeout(resolve, 150));

    orderLogger.info('Pedido processado com sucesso', {
      orderId,
      status: 'completed',
      processingTime: '450ms'
    });

  } catch (error) {
    orderLogger.error('Erro ao processar pedido', {
      orderId,
      error: (error as Error).message,
      stack: (error as Error).stack,
      step: 'payment-processing'
    });
  }

  await logger.shutdown();
}

// Executar exemplos
if (require.main === module) {
  basicExample().catch(console.error);
  advancedExample().catch(console.error);
}
