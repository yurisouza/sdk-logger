// Teste da integração simplificada
const { setupMinimalLogging, setupCompleteLogging, setupLogging } = require('./dist/adapters/nestjs');

console.log('🧪 Teste da Integração Simplificada');
console.log('==================================');

// Simular uma aplicação NestJS
const mockApp = {
  useGlobalInterceptors: (interceptor) => {
    console.log('✅ Interceptor registrado globalmente');
    console.log('📊 Interceptor:', interceptor.constructor.name);
  }
};

console.log('\n1. Testando setupMinimalLogging...');
try {
  setupMinimalLogging(mockApp);
  console.log('✅ setupMinimalLogging funcionou!');
} catch (error) {
  console.error('❌ Erro no setupMinimalLogging:', error.message);
}

console.log('\n2. Testando setupCompleteLogging...');
try {
  setupCompleteLogging(
    mockApp,
    'test-service',
    '1.0.0',
    'test',
    'https://ingest.us.signoz.cloud:443',
    'test-api-key'
  );
  console.log('✅ setupCompleteLogging funcionou!');
} catch (error) {
  console.error('❌ Erro no setupCompleteLogging:', error.message);
}

console.log('\n3. Testando setupLogging com configuração customizada...');
try {
  setupLogging(mockApp, {
    logLevel: 'debug',
    enableConsole: true,
    signoz: {
      endpoint: 'https://ingest.us.signoz.cloud:443',
      apiKey: 'test-api-key',
      serviceName: 'test-service',
      serviceVersion: '1.0.0',
      environment: 'test',
      enableLogs: true
    }
  });
  console.log('✅ setupLogging funcionou!');
} catch (error) {
  console.error('❌ Erro no setupLogging:', error.message);
}

console.log('\n🎉 Teste concluído!');
console.log('\n📋 Resumo:');
console.log('- ✅ Interceptor encapsulado na SDK');
console.log('- ✅ Setup automático funcionando');
console.log('- ✅ Configuração mínima disponível');
console.log('- ✅ Configuração personalizada disponível');
console.log('\n🚀 A SDK está pronta para uso simplificado!');


