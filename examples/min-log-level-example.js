const { Logger, LogLevel, createLogger } = require('../dist');

// Exemplo 1: Configuração com nível mínimo DEBUG (mostra todos os logs)
console.log('=== Exemplo 1: Nível mínimo DEBUG ===');
const debugLogger = createLogger({
  exporterType: 'collector',
  collector: {
    endpoint: 'http://localhost:4317'
  },
  serviceName: 'test-service',
  minLogLevel: LogLevel.DEBUG, // Mostra todos os logs
  enableConsole: true
});

console.log('Testando logs com nível mínimo DEBUG:');
debugLogger.debug('Este é um log DEBUG - deve aparecer');
debugLogger.info('Este é um log INFO - deve aparecer');
debugLogger.warn('Este é um log WARN - deve aparecer');
debugLogger.error('Este é um log ERROR - deve aparecer');

console.log('\n=== Exemplo 2: Nível mínimo INFO (padrão) ===');
const infoLogger = createLogger({
  exporterType: 'collector',
  collector: {
    endpoint: 'http://localhost:4317'
  },
  serviceName: 'test-service',
  minLogLevel: LogLevel.INFO, // Mostra apenas INFO, WARN e ERROR
  enableConsole: true
});

console.log('Testando logs com nível mínimo INFO:');
infoLogger.debug('Este é um log DEBUG - NÃO deve aparecer');
infoLogger.info('Este é um log INFO - deve aparecer');
infoLogger.warn('Este é um log WARN - deve aparecer');
infoLogger.error('Este é um log ERROR - deve aparecer');

console.log('\n=== Exemplo 3: Nível mínimo WARN ===');
const warnLogger = createLogger({
  exporterType: 'collector',
  collector: {
    endpoint: 'http://localhost:4317'
  },
  serviceName: 'test-service',
  minLogLevel: LogLevel.WARN, // Mostra apenas WARN e ERROR
  enableConsole: true
});

console.log('Testando logs com nível mínimo WARN:');
warnLogger.debug('Este é um log DEBUG - NÃO deve aparecer');
warnLogger.info('Este é um log INFO - NÃO deve aparecer');
warnLogger.warn('Este é um log WARN - deve aparecer');
warnLogger.error('Este é um log ERROR - deve aparecer');

console.log('\n=== Exemplo 4: Nível mínimo ERROR ===');
const errorLogger = createLogger({
  exporterType: 'collector',
  collector: {
    endpoint: 'http://localhost:4317'
  },
  serviceName: 'test-service',
  minLogLevel: LogLevel.ERROR, // Mostra apenas ERROR
  enableConsole: true
});

console.log('Testando logs com nível mínimo ERROR:');
errorLogger.debug('Este é um log DEBUG - NÃO deve aparecer');
errorLogger.info('Este é um log INFO - NÃO deve aparecer');
errorLogger.warn('Este é um log WARN - NÃO deve aparecer');
errorLogger.error('Este é um log ERROR - deve aparecer');

console.log('\n=== Exemplo 5: Sem configuração de nível mínimo (padrão INFO) ===');
const defaultLogger = createLogger({
  exporterType: 'collector',
  collector: {
    endpoint: 'http://localhost:4317'
  },
  serviceName: 'test-service',
  // minLogLevel não especificado - deve usar INFO como padrão
  enableConsole: true
});

console.log('Testando logs sem configuração de nível mínimo (padrão INFO):');
defaultLogger.debug('Este é um log DEBUG - NÃO deve aparecer');
defaultLogger.info('Este é um log INFO - deve aparecer');
defaultLogger.warn('Este é um log WARN - deve aparecer');
defaultLogger.error('Este é um log ERROR - deve aparecer');

console.log('\n=== Teste concluído ===');
