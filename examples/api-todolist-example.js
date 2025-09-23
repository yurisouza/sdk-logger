const { setupLogging } = require('../dist');

// ✅ CONFIGURAÇÃO SIMPLIFICADA - APENAS COLLECTOR
console.log('=== Exemplo: Configuração com Collector ===');
console.log(`
// main.ts - Configuração simplificada
import { setupLogging } from '@psouza.yuri/sdk-logger';

// Configuração do Collector (apenas logs)
const collectorConfig = {
  collectorEndpoint: 'http://localhost:4318',
  collectorProtocol: 'http',
  serviceName: 'api-todolist',
  serviceVersion: '1.0.0',
  environment: 'development',
  enableTracing: true,
  enableLogs: true,
  enableMetrics: true
};

// Setup apenas logging (sem traces)
setupLogging(app, collectorConfig);
`);

console.log('\n=== RESUMO ===');
console.log('✅ Configuração simplificada - apenas collector');
console.log('✅ Código mais limpo e fácil de entender');
console.log('✅ Sem complexidade de compatibilidade');
console.log('\n🔧 Para usar Collector:');
console.log('   1. Configure o OpenTelemetry Collector');
console.log('   2. Use exporterType: "collector"');
console.log('   3. Apenas setupLogging (sem setupTelemetry)');
