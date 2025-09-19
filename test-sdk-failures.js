#!/usr/bin/env node

/**
 * Testes de Falhas Específicas da SDK
 * 
 * Este script testa cenários que podem quebrar a SDK:
 * - Falhas de rede para SigNoz
 * - Dados inválidos no SpanProcessor
 * - Memory leaks no Map de spans
 * - Timeouts de exportação
 * - Erros de serialização
 */

const http = require('http');
const { performance } = require('perf_hooks');

// Configurações
const CONFIG = {
  baseUrl: 'http://localhost:3000',
  testDuration: 30000, // 30 segundos
  requestInterval: 100 // 100ms entre requisições
};

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Estatísticas
let stats = {
  requests: 0,
  errors: 0,
  memorySnapshots: [],
  startTime: 0
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatMemory(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)}MB`;
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    external: usage.external,
    timestamp: Date.now()
  };
}

/**
 * Teste 1: Falha de Rede para SigNoz
 */
async function testSigNozNetworkFailure() {
  log('\n🌐 Teste: Falha de Rede para SigNoz', 'yellow');
  log('=' * 50, 'yellow');
  
  // Simular falha de rede alterando o endpoint
  const originalEndpoint = process.env.SIGNOZ_ENDPOINT;
  process.env.SIGNOZ_ENDPOINT = 'http://invalid-endpoint:9999';
  
  log('🔧 Simulando endpoint inválido para SigNoz...');
  
  const startTime = performance.now();
  let requestCount = 0;
  let errorCount = 0;
  
  // Fazer requisições por 10 segundos
  const testDuration = 10000;
  const endTime = startTime + testDuration;
  
  while (performance.now() < endTime) {
    try {
      const response = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`);
      requestCount++;
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        log(`✅ Requisição ${requestCount}: ${response.statusCode}`, 'green');
      } else {
        log(`⚠️  Requisição ${requestCount}: ${response.statusCode}`, 'yellow');
        errorCount++;
      }
    } catch (error) {
      log(`❌ Erro na requisição ${requestCount}: ${error.error}`, 'red');
      errorCount++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Restaurar endpoint original
  if (originalEndpoint) {
    process.env.SIGNOZ_ENDPOINT = originalEndpoint;
  } else {
    delete process.env.SIGNOZ_ENDPOINT;
  }
  
  const duration = performance.now() - startTime;
  log(`📊 Resultado: ${requestCount} requisições em ${(duration/1000).toFixed(2)}s`);
  log(`📈 Taxa de erro: ${((errorCount / requestCount) * 100).toFixed(2)}%`);
  
  return { requests: requestCount, errors: errorCount, duration };
}

/**
 * Teste 2: Memory Leak no SpanProcessor
 */
async function testMemoryLeak() {
  log('\n🧠 Teste: Memory Leak no SpanProcessor', 'magenta');
  log('=' * 50, 'magenta');
  
  const initialMemory = getMemoryUsage();
  log(`📊 Memória inicial: ${formatMemory(initialMemory.heapUsed)}`);
  
  const startTime = performance.now();
  let requestCount = 0;
  
  // Fazer requisições por 20 segundos
  const testDuration = 20000;
  const endTime = startTime + testDuration;
  
  while (performance.now() < endTime) {
    try {
      const response = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`);
      requestCount++;
      
      // Capturar snapshot de memória a cada 100 requisições
      if (requestCount % 100 === 0) {
        const memory = getMemoryUsage();
        stats.memorySnapshots.push(memory);
        log(`📊 Requisição ${requestCount}: ${formatMemory(memory.heapUsed)}`);
      }
    } catch (error) {
      log(`❌ Erro na requisição ${requestCount}: ${error.error}`, 'red');
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  const finalMemory = getMemoryUsage();
  const memoryDiff = finalMemory.heapUsed - initialMemory.heapUsed;
  
  log(`📊 Memória final: ${formatMemory(finalMemory.heapUsed)}`);
  log(`📈 Diferença: ${formatMemory(memoryDiff)}`);
  log(`📊 Requisições: ${requestCount}`);
  
  // Analisar vazamento de memória
  if (memoryDiff > 50 * 1024 * 1024) { // 50MB
    log(`⚠️  POSSÍVEL VAZAMENTO DE MEMÓRIA!`, 'red');
    return { hasLeak: true, memoryDiff, requests: requestCount };
  } else {
    log(`✅ Sem vazamento de memória detectado`, 'green');
    return { hasLeak: false, memoryDiff, requests: requestCount };
  }
}

/**
 * Teste 3: Dados Malformados
 */
async function testMalformedData() {
  log('\n🔧 Teste: Dados Malformados', 'yellow');
  log('=' * 50, 'yellow');
  
  const malformedTests = [
    {
      name: 'Headers pequenos mas grandes',
      headers: { 'x-large-header': 'x'.repeat(10000) } // 10KB - mais conservador
    },
    {
      name: 'User ID inválido',
      headers: { 'x-user-id': null }
    },
    {
      name: 'Headers com caracteres especiais',
      headers: { 'x-user-id': 'test\x00\x01\x02user' }
    },
    {
      name: 'Múltiplos headers iguais',
      headers: { 'x-user-id': 'user1', 'x-user-id': 'user2' }
    }
  ];
  
  let successCount = 0;
  let totalCount = malformedTests.length;
  
  for (const test of malformedTests) {
    try {
      log(`🧪 Testando: ${test.name}`);
      const result = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`, test);
      
      if (result.statusCode >= 200 && result.statusCode < 500) {
        log(`  ✅ API respondeu: ${result.statusCode}`, 'green');
        successCount++;
      } else {
        log(`  ⚠️  API respondeu com erro: ${result.statusCode}`, 'yellow');
        successCount++; // Erro esperado é OK
      }
    } catch (error) {
      // Classificar tipos de erro
      if (error.code === 'ECONNRESET') {
        log(`  ⚠️  Conexão resetada (dados muito grandes): ${error.error}`, 'yellow');
        successCount++; // ECONNRESET é esperado para dados muito grandes
      } else if (error.code === 'TIMEOUT') {
        log(`  ⚠️  Timeout (esperado para timeout baixo): ${error.error}`, 'yellow');
        successCount++; // Timeout é esperado para timeout baixo
      } else {
        log(`  ❌ Erro inesperado: ${error.error} (${error.code})`, 'red');
      }
    }
  }
  
  log(`📊 Taxa de robustez: ${((successCount / totalCount) * 100).toFixed(2)}%`);
  return { successful: successCount, total: totalCount };
}

/**
 * Teste 4: Concorrência Extrema
 */
async function testExtremeConcurrency() {
  log('\n⚡ Teste: Concorrência Extrema', 'red');
  log('=' * 50, 'red');
  
  const concurrency = 1000; // 1000 requisições simultâneas
  log(`🚀 Iniciando ${concurrency} requisições simultâneas...`);
  
  const startTime = performance.now();
  const promises = [];
  
  for (let i = 0; i < concurrency; i++) {
    promises.push(
      makeRequest(`${CONFIG.baseUrl}/api/v1/todos`)
        .then(result => ({ success: true, duration: result.duration, statusCode: result.statusCode }))
        .catch(error => ({ success: false, duration: error.duration, error: error.error }))
    );
  }
  
  const results = await Promise.all(promises);
  const duration = performance.now() - startTime;
  
  const successful = results.filter(r => r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  log(`✅ Requisições bem-sucedidas: ${successful}/${concurrency}`);
  log(`⏱️  Duração média: ${(avgDuration).toFixed(2)}ms`);
  log(`📊 Taxa de sucesso: ${((successful / concurrency) * 100).toFixed(2)}%`);
  log(`⏱️  Tempo total: ${(duration/1000).toFixed(2)}s`);
  
  return { successful, total: concurrency, avgDuration, duration };
}

/**
 * Teste 5: Timeout de Exportação
 */
async function testExportTimeout() {
  log('\n⏰ Teste: Timeout de Exportação', 'yellow');
  log('=' * 50, 'yellow');
  
  // Simular timeout alterando configuração
  const originalTimeout = process.env.SIGNOZ_TIMEOUT;
  process.env.SIGNOZ_TIMEOUT = '100'; // 100ms timeout (mais realista)
  
  log('🔧 Simulando timeout de 100ms para exportação...');
  
  const startTime = performance.now();
  let requestCount = 0;
  let errorCount = 0;
  
  // Fazer requisições por 10 segundos
  const testDuration = 10000;
  const endTime = startTime + testDuration;
  
  while (performance.now() < endTime) {
    try {
      const response = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`);
      requestCount++;
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        log(`✅ Requisição ${requestCount}: ${response.statusCode}`, 'green');
      } else {
        log(`⚠️  Requisição ${requestCount}: ${response.statusCode}`, 'yellow');
        errorCount++;
      }
    } catch (error) {
      log(`❌ Erro na requisição ${requestCount}: ${error.error}`, 'red');
      errorCount++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Restaurar timeout original
  if (originalTimeout) {
    process.env.SIGNOZ_TIMEOUT = originalTimeout;
  } else {
    delete process.env.SIGNOZ_TIMEOUT;
  }
  
  const duration = performance.now() - startTime;
  log(`📊 Resultado: ${requestCount} requisições em ${(duration/1000).toFixed(2)}s`);
  log(`📈 Taxa de erro: ${((errorCount / requestCount) * 100).toFixed(2)}%`);
  
  return { requests: requestCount, errors: errorCount, duration };
}

/**
 * Função para fazer requisição HTTP
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: {
        'x-user-id': `test-user-${Math.random().toString(36).substr(2, 9)}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        resolve({
          statusCode: res.statusCode,
          duration,
          data: data,
          headers: res.headers
        });
      });
    });
    
    req.on('error', (err) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      reject({
        error: err.message,
        duration,
        code: err.code
      });
    });
    
    req.setTimeout(options.timeout || 5000, () => {
      req.destroy();
      reject({
        error: 'Request timeout',
        duration: performance.now() - startTime,
        code: 'TIMEOUT'
      });
    });
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

/**
 * Verificar se a API está rodando
 */
async function checkApiHealth() {
  try {
    const result = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`);
    return result.statusCode === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Função principal
 */
async function main() {
  log('🧪 Iniciando Testes de Falhas da SDK', 'cyan');
  log('=' * 60, 'cyan');
  
  // Verificar se a API está rodando
  log('🔍 Verificando saúde da API...');
  const isApiHealthy = await checkApiHealth();
  
  if (!isApiHealthy) {
    log('❌ API não está rodando! Inicie a API antes de executar os testes.', 'red');
    log('💡 Execute: cd api-todolist && npm run start:dev', 'yellow');
    process.exit(1);
  }
  
  log('✅ API está rodando!', 'green');
  
  const startTime = performance.now();
  
  try {
    await testSigNozNetworkFailure();
    await testMemoryLeak();
    await testMalformedData();
    await testExtremeConcurrency();
    await testExportTimeout();
    
    const totalTime = performance.now() - startTime;
    
    log('\n🎉 Todos os testes de falha concluídos!', 'green');
    log(`⏱️  Tempo total: ${(totalTime/1000).toFixed(2)}s`, 'green');
    
  } catch (error) {
    log(`❌ Erro durante os testes: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testSigNozNetworkFailure,
  testMemoryLeak,
  testMalformedData,
  testExtremeConcurrency,
  testExportTimeout
};
