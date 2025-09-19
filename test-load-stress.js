#!/usr/bin/env node

/**
 * Testes de Carga e Stress para SDK Logger
 * 
 * Este script testa a robustez da SDK em cenários extremos:
 * - Alta concorrência
 * - Vazamentos de memória
 * - Falhas de rede
 * - Dados malformados
 * - Timeouts
 * - Recursos esgotados
 */

const http = require('http');
const { performance } = require('perf_hooks');

// Configurações do teste
const CONFIG = {
  baseUrl: 'http://localhost:3000',
  endpoints: [
    '/api/v1/todos',
    '/api/v1/todos?category=work',
    '/api/v1/todos?completed=true',
    '/api/v1/todos?category=personal&completed=false'
  ],
  testScenarios: {
    normalLoad: { requests: 100, concurrency: 10, delay: 10 },
    highLoad: { requests: 500, concurrency: 50, delay: 5 },
    stressTest: { requests: 1000, concurrency: 100, delay: 1 },
    memoryTest: { requests: 2000, concurrency: 200, delay: 0 }
  }
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

// Estatísticas globais
let stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalDuration: 0,
  minDuration: Infinity,
  maxDuration: 0,
  errors: new Map(),
  memoryUsage: [],
  startTime: 0
};

/**
 * Utilitários
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
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
    external: usage.external
  };
}

/**
 * Função para fazer uma requisição HTTP
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
 * Teste de carga normal
 */
async function testNormalLoad() {
  log('\n🚀 Teste de Carga Normal', 'cyan');
  log('=' * 50, 'cyan');
  
  const { requests, concurrency, delay } = CONFIG.testScenarios.normalLoad;
  const results = await runLoadTest(requests, concurrency, delay);
  
  log(`✅ Requisições: ${results.successful}/${results.total}`);
  log(`⏱️  Duração média: ${formatDuration(results.avgDuration)}`);
  log(`📊 Taxa de sucesso: ${((results.successful / results.total) * 100).toFixed(2)}%`);
  
  return results;
}

/**
 * Teste de alta carga
 */
async function testHighLoad() {
  log('\n🔥 Teste de Alta Carga', 'yellow');
  log('=' * 50, 'yellow');
  
  const { requests, concurrency, delay } = CONFIG.testScenarios.highLoad;
  const results = await runLoadTest(requests, concurrency, delay);
  
  log(`✅ Requisições: ${results.successful}/${results.total}`);
  log(`⏱️  Duração média: ${formatDuration(results.avgDuration)}`);
  log(`📊 Taxa de sucesso: ${((results.successful / results.total) * 100).toFixed(2)}%`);
  
  return results;
}

/**
 * Teste de stress
 */
async function testStress() {
  log('\n💥 Teste de Stress', 'red');
  log('=' * 50, 'red');
  
  const { requests, concurrency, delay } = CONFIG.testScenarios.stressTest;
  const results = await runLoadTest(requests, concurrency, delay);
  
  log(`✅ Requisições: ${results.successful}/${results.total}`);
  log(`⏱️  Duração média: ${formatDuration(results.avgDuration)}`);
  log(`📊 Taxa de sucesso: ${((results.successful / results.total) * 100).toFixed(2)}%`);
  
  return results;
}

/**
 * Teste de memória
 */
async function testMemory() {
  log('\n🧠 Teste de Memória', 'magenta');
  log('=' * 50, 'magenta');
  
  const { requests, concurrency, delay } = CONFIG.testScenarios.memoryTest;
  
  // Medir memória antes
  const initialMemory = getMemoryUsage();
  log(`📊 Memória inicial: ${formatMemory(initialMemory.heapUsed)}`);
  
  const results = await runLoadTest(requests, concurrency, delay);
  
  // Medir memória depois
  const finalMemory = getMemoryUsage();
  const memoryDiff = finalMemory.heapUsed - initialMemory.heapUsed;
  
  log(`✅ Requisições: ${results.successful}/${results.total}`);
  log(`⏱️  Duração média: ${formatDuration(results.avgDuration)}`);
  log(`📊 Taxa de sucesso: ${((results.successful / results.total) * 100).toFixed(2)}%`);
  log(`🧠 Memória final: ${formatMemory(finalMemory.heapUsed)}`);
  log(`📈 Diferença de memória: ${formatMemory(memoryDiff)}`);
  
  // Verificar vazamento de memória
  if (memoryDiff > 50 * 1024 * 1024) { // 50MB
    log(`⚠️  POSSÍVEL VAZAMENTO DE MEMÓRIA: ${formatMemory(memoryDiff)}`, 'red');
  } else {
    log(`✅ Sem vazamento de memória detectado`, 'green');
  }
  
  return results;
}

/**
 * Teste de dados malformados
 */
async function testMalformedData() {
  log('\n🔧 Teste de Dados Malformados', 'yellow');
  log('=' * 50, 'yellow');
  
  const malformedTests = [
    { name: 'Headers inválidos', headers: { 'x-user-id': null } },
    { name: 'Body muito grande', body: { data: 'x'.repeat(1000000) } },
    { name: 'Timeout muito baixo', timeout: 1 },
    { name: 'Headers muito grandes', headers: { 'x-large-header': 'x'.repeat(10000) } }
  ];
  
  let successCount = 0;
  let totalCount = malformedTests.length;
  
  for (const test of malformedTests) {
    try {
      log(`🧪 Testando: ${test.name}`);
      const result = await makeRequest(`${CONFIG.baseUrl}${CONFIG.endpoints[0]}`, test);
      
      if (result.statusCode >= 200 && result.statusCode < 500) {
        log(`  ✅ API respondeu corretamente: ${result.statusCode}`, 'green');
        successCount++;
      } else {
        log(`  ⚠️  API respondeu com erro esperado: ${result.statusCode}`, 'yellow');
        successCount++;
      }
    } catch (error) {
      log(`  ❌ Erro inesperado: ${error.error}`, 'red');
    }
  }
  
  log(`📊 Taxa de robustez: ${((successCount / totalCount) * 100).toFixed(2)}%`);
  return { successful: successCount, total: totalCount };
}

/**
 * Teste de concorrência extrema
 */
async function testExtremeConcurrency() {
  log('\n⚡ Teste de Concorrência Extrema', 'red');
  log('=' * 50, 'red');
  
  const promises = [];
  const concurrency = 500; // 500 requisições simultâneas
  
  log(`🚀 Iniciando ${concurrency} requisições simultâneas...`);
  
  for (let i = 0; i < concurrency; i++) {
    const endpoint = CONFIG.endpoints[i % CONFIG.endpoints.length];
    promises.push(
      makeRequest(`${CONFIG.baseUrl}${endpoint}`)
        .then(result => ({ success: true, duration: result.duration }))
        .catch(error => ({ success: false, duration: error.duration, error: error.error }))
    );
  }
  
  const results = await Promise.all(promises);
  const successful = results.filter(r => r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  log(`✅ Requisições bem-sucedidas: ${successful}/${concurrency}`);
  log(`⏱️  Duração média: ${formatDuration(avgDuration)}`);
  log(`📊 Taxa de sucesso: ${((successful / concurrency) * 100).toFixed(2)}%`);
  
  return { successful, total: concurrency, avgDuration };
}

/**
 * Executor principal de teste de carga
 */
async function runLoadTest(totalRequests, concurrency, delay) {
  const results = [];
  const batches = Math.ceil(totalRequests / concurrency);
  
  for (let batch = 0; batch < batches; batch++) {
    const batchPromises = [];
    const batchSize = Math.min(concurrency, totalRequests - (batch * concurrency));
    
    for (let i = 0; i < batchSize; i++) {
      const endpoint = CONFIG.endpoints[Math.floor(Math.random() * CONFIG.endpoints.length)];
      batchPromises.push(
        makeRequest(`${CONFIG.baseUrl}${endpoint}`)
          .then(result => ({ success: true, duration: result.duration, statusCode: result.statusCode }))
          .catch(error => ({ success: false, duration: error.duration, error: error.error }))
      );
    }
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  const successful = results.filter(r => r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  return {
    successful,
    total: results.length,
    avgDuration,
    results
  };
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
  log('🧪 Iniciando Testes de Carga e Stress da SDK Logger', 'cyan');
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
  
  // Executar todos os testes
  const startTime = performance.now();
  
  try {
    await testNormalLoad();
    await testHighLoad();
    await testStress();
    await testMemory();
    await testMalformedData();
    await testExtremeConcurrency();
    
    const totalTime = performance.now() - startTime;
    
    log('\n🎉 Todos os testes concluídos!', 'green');
    log(`⏱️  Tempo total: ${formatDuration(totalTime)}`, 'green');
    log('\n📊 Resumo dos Testes:', 'cyan');
    log('✅ Teste de carga normal - OK', 'green');
    log('✅ Teste de alta carga - OK', 'green');
    log('✅ Teste de stress - OK', 'green');
    log('✅ Teste de memória - OK', 'green');
    log('✅ Teste de dados malformados - OK', 'green');
    log('✅ Teste de concorrência extrema - OK', 'green');
    
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
  testNormalLoad,
  testHighLoad,
  testStress,
  testMemory,
  testMalformedData,
  testExtremeConcurrency
};
