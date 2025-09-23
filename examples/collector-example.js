const { createLogger, LogLevel } = require('../dist');

// Exemplo: Usando Collector (OpenTelemetry Collector)
const collectorLogger = createLogger({
  collectorEndpoint: 'http://localhost:4318', // Endpoint do collector
  collectorProtocol: 'http', // ou 'grpc'
  collectorTimeout: 5000,
  collectorHeaders: {
    'X-Custom-Header': 'value'
  },
  serviceName: 'meu-servico',
  serviceVersion: '1.0.0',
  environment: 'development',
  logLevel: LogLevel.INFO,
  enableConsole: true,
  enableTracing: true,
  enableLogs: true,
  enableMetrics: true
});

// Testando o logger
console.log('=== Testando Collector Logger ===');
collectorLogger.info('Log via Collector', {
  context: {
    requestId: 'req-123',
    userId: 'user-456',
    traceId: 'trace-789',
    spanId: 'span-abc'
  },
  performance: {
    duration: '150ms'
  }
});

// Exemplo de uso com NestJS
console.log('\n=== Exemplo para NestJS ===');
console.log(`
// main.ts
import { setupLogging } from '@psouza.yuri/sdk-logger';

// Configuração com Collector
setupLogging(app, {
  collectorEndpoint: 'http://localhost:4318',
  collectorProtocol: 'http',
  serviceName: 'api-gateway',
  serviceVersion: '1.0.0',
  environment: 'production',
  enableTracing: true,
  enableLogs: true,
  enableMetrics: true
});

`);
