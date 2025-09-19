#!/usr/bin/env node

/**
 * Teste de Limites de Tamanho
 * 
 * Este script testa diferentes tamanhos de dados para encontrar
 * o limite exato onde a API quebra ou onde a SDK funciona bem.
 */

const http = require('http');
const { performance } = require('perf_hooks');

// Configurações
const CONFIG = {
  baseUrl: 'http://localhost:3000',
  testTimeout: 10000
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

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// Fazer requisição HTTP
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
    
    req.setTimeout(options.timeout || CONFIG.testTimeout, () => {
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

// Verificar se a API está rodando
async function checkApiHealth() {
  try {
    const result = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`);
    return result.statusCode === 200;
  } catch (error) {
    return false;
  }
}

// Teste de tamanhos crescentes de body
async function testBodySizeLimits() {
  log('\n📦 Teste: Limites de Tamanho de Body', 'cyan');
  log('=' * 50, 'cyan');
  
  const sizes = [
    { name: '1KB', size: 1024 },
    { name: '10KB', size: 10 * 1024 },
    { name: '50KB', size: 50 * 1024 },
    { name: '100KB', size: 100 * 1024 },
    { name: '200KB', size: 200 * 1024 },
    { name: '500KB', size: 500 * 1024 },
    { name: '1MB', size: 1024 * 1024 },
    { name: '2MB', size: 2 * 1024 * 1024 }
  ];
  
  for (const test of sizes) {
    const body = { data: 'x'.repeat(test.size) };
    const actualSize = JSON.stringify(body).length;
    
    log(`\n🧪 Testando body de ${test.name} (${formatSize(actualSize)})`);
    
    try {
      const result = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`, {
        method: 'POST',
        body: body
      });
      
      log(`  ✅ Sucesso: ${result.statusCode} (${result.duration.toFixed(2)}ms)`, 'green');
    } catch (error) {
      if (error.code === 'ECONNRESET') {
        log(`  ⚠️  ECONNRESET: ${error.error}`, 'yellow');
        log(`  📊 Limite encontrado: ~${test.name}`, 'magenta');
        break;
      } else {
        log(`  ❌ Erro: ${error.error} (${error.code})`, 'red');
      }
    }
    
    // Pequena pausa entre testes
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Teste de tamanhos crescentes de headers
async function testHeaderSizeLimits() {
  log('\n📋 Teste: Limites de Tamanho de Headers', 'cyan');
  log('=' * 50, 'cyan');
  
  const sizes = [
    { name: '1KB', size: 1024 },
    { name: '5KB', size: 5 * 1024 },
    { name: '10KB', size: 10 * 1024 },
    { name: '20KB', size: 20 * 1024 },
    { name: '50KB', size: 50 * 1024 },
    { name: '100KB', size: 100 * 1024 },
    { name: '200KB', size: 200 * 1024 }
  ];
  
  for (const test of sizes) {
    const headers = {
      'x-large-header': 'x'.repeat(test.size)
    };
    const actualSize = JSON.stringify(headers).length;
    
    log(`\n🧪 Testando headers de ${test.name} (${formatSize(actualSize)})`);
    
    try {
      const result = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`, {
        headers: headers
      });
      
      log(`  ✅ Sucesso: ${result.statusCode} (${result.duration.toFixed(2)}ms)`, 'green');
    } catch (error) {
      if (error.code === 'ECONNRESET') {
        log(`  ⚠️  ECONNRESET: ${error.error}`, 'yellow');
        log(`  📊 Limite encontrado: ~${test.name}`, 'magenta');
        break;
      } else {
        log(`  ❌ Erro: ${error.error} (${error.code})`, 'red');
      }
    }
    
    // Pequena pausa entre testes
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Teste de combinação de body e headers
async function testCombinedSizeLimits() {
  log('\n📦📋 Teste: Limites Combinados de Body e Headers', 'cyan');
  log('=' * 50, 'cyan');
  
  const combinations = [
    { bodySize: 50 * 1024, headerSize: 5 * 1024, name: '50KB body + 5KB headers' },
    { bodySize: 100 * 1024, headerSize: 10 * 1024, name: '100KB body + 10KB headers' },
    { bodySize: 200 * 1024, headerSize: 20 * 1024, name: '200KB body + 20KB headers' },
    { bodySize: 500 * 1024, headerSize: 50 * 1024, name: '500KB body + 50KB headers' }
  ];
  
  for (const test of combinations) {
    const body = { data: 'x'.repeat(test.bodySize) };
    const headers = { 'x-large-header': 'x'.repeat(test.headerSize) };
    
    const bodyActualSize = JSON.stringify(body).length;
    const headerActualSize = JSON.stringify(headers).length;
    const totalSize = bodyActualSize + headerActualSize;
    
    log(`\n🧪 Testando: ${test.name}`);
    log(`  📊 Body: ${formatSize(bodyActualSize)}, Headers: ${formatSize(headerActualSize)}, Total: ${formatSize(totalSize)}`);
    
    try {
      const result = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`, {
        method: 'POST',
        headers: headers,
        body: body
      });
      
      log(`  ✅ Sucesso: ${result.statusCode} (${result.duration.toFixed(2)}ms)`, 'green');
    } catch (error) {
      if (error.code === 'ECONNRESET') {
        log(`  ⚠️  ECONNRESET: ${error.error}`, 'yellow');
        log(`  📊 Limite encontrado: ~${test.name}`, 'magenta');
        break;
      } else {
        log(`  ❌ Erro: ${error.error} (${error.code})`, 'red');
      }
    }
    
    // Pequena pausa entre testes
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Função principal
async function main() {
  log('🧪 Iniciando Teste de Limites de Tamanho', 'cyan');
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
  
  try {
    await testBodySizeLimits();
    await testHeaderSizeLimits();
    await testCombinedSizeLimits();
    
    log('\n🎉 Teste de limites concluído!', 'green');
    log('💡 Use os resultados para ajustar os limites nos testes de dados malformados.', 'yellow');
    
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
  testBodySizeLimits,
  testHeaderSizeLimits,
  testCombinedSizeLimits
};

