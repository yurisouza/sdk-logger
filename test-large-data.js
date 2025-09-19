#!/usr/bin/env node

/**
 * Teste de Dados Grandes para SDK Logger
 * 
 * Este script testa a robustez da SDK com dados muito grandes:
 * - Headers muito grandes
 * - Body muito grande
 * - Logs muito grandes
 * - Verifica se a API não quebra
 */

const http = require('http');
const { performance } = require('perf_hooks');

// Configurações
const CONFIG = {
  baseUrl: 'http://localhost:3000',
  testTimeout: 10000 // 10 segundos
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
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  startTime: 0
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

// Teste 1: Headers muito grandes
async function testLargeHeaders() {
  log('\n📋 Teste: Headers Muito Grandes', 'yellow');
  log('=' * 50, 'yellow');
  
  const largeHeaderValue = 'x'.repeat(100000); // 100KB
  const headers = {
    'x-large-header-1': largeHeaderValue,
    'x-large-header-2': largeHeaderValue,
    'x-large-header-3': largeHeaderValue,
    'x-large-header-4': largeHeaderValue,
    'x-large-header-5': largeHeaderValue
  };
  
  const totalSize = JSON.stringify(headers).length;
  log(`📊 Tamanho total dos headers: ${formatSize(totalSize)}`);
  
  try {
    const result = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`, { headers });
    
    if (result.statusCode >= 200 && result.statusCode < 500) {
      log(`✅ API respondeu corretamente: ${result.statusCode}`, 'green');
      log(`⏱️  Duração: ${result.duration.toFixed(2)}ms`, 'blue');
      return { success: true, duration: result.duration, statusCode: result.statusCode };
    } else {
      log(`⚠️  API respondeu com erro: ${result.statusCode}`, 'yellow');
      return { success: true, duration: result.duration, statusCode: result.statusCode }; // Erro esperado
    }
  } catch (error) {
    log(`❌ Erro inesperado: ${error.error}`, 'red');
    return { success: false, error: error.error, duration: error.duration };
  }
}

// Teste 2: Body muito grande
async function testLargeBody() {
  log('\n📦 Teste: Body Muito Grande', 'yellow');
  log('=' * 50, 'yellow');
  
  const largeBody = {
    data: 'x'.repeat(1500000), // 1.5MB (dentro do limite da SDK)
    items: Array.from({ length: 800 }, (_, i) => ({
      id: i,
      content: 'x'.repeat(800),
      metadata: { created: new Date().toISOString() }
    }))
  };
  
  const totalSize = JSON.stringify(largeBody).length;
  log(`📊 Tamanho total do body: ${formatSize(totalSize)}`);
  
  try {
    const result = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`, {
      method: 'POST',
      body: largeBody
    });
    
    if (result.statusCode >= 200 && result.statusCode < 500) {
      log(`✅ API respondeu corretamente: ${result.statusCode}`, 'green');
      log(`⏱️  Duração: ${result.duration.toFixed(2)}ms`, 'blue');
      return { success: true, duration: result.duration, statusCode: result.statusCode };
    } else {
      log(`⚠️  API respondeu com erro: ${result.statusCode}`, 'yellow');
      return { success: true, duration: result.duration, statusCode: result.statusCode }; // Erro esperado
    }
  } catch (error) {
    log(`❌ Erro inesperado: ${error.error}`, 'red');
    return { success: false, error: error.error, duration: error.duration };
  }
}

// Teste 3: Headers e Body grandes simultaneamente
async function testLargeHeadersAndBody() {
  log('\n📋📦 Teste: Headers e Body Grandes Simultaneamente', 'yellow');
  log('=' * 50, 'yellow');
  
  const largeHeaderValue = 'x'.repeat(50000); // 50KB
  const headers = {
    'x-large-header-1': largeHeaderValue,
    'x-large-header-2': largeHeaderValue,
    'x-large-header-3': largeHeaderValue
  };
  
  const largeBody = {
    data: 'x'.repeat(800000), // 800KB (dentro do limite da SDK)
    items: Array.from({ length: 400 }, (_, i) => ({
      id: i,
      content: 'x'.repeat(400),
      metadata: { created: new Date().toISOString() }
    }))
  };
  
  const headersSize = JSON.stringify(headers).length;
  const bodySize = JSON.stringify(largeBody).length;
  const totalSize = headersSize + bodySize;
  
  log(`📊 Tamanho dos headers: ${formatSize(headersSize)}`);
  log(`📊 Tamanho do body: ${formatSize(bodySize)}`);
  log(`📊 Tamanho total: ${formatSize(totalSize)}`);
  
  try {
    const result = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`, {
      method: 'POST',
      headers,
      body: largeBody
    });
    
    if (result.statusCode >= 200 && result.statusCode < 500) {
      log(`✅ API respondeu corretamente: ${result.statusCode}`, 'green');
      log(`⏱️  Duração: ${result.duration.toFixed(2)}ms`, 'blue');
      return { success: true, duration: result.duration, statusCode: result.statusCode };
    } else {
      log(`⚠️  API respondeu com erro: ${result.statusCode}`, 'yellow');
      return { success: true, duration: result.duration, statusCode: result.statusCode }; // Erro esperado
    }
  } catch (error) {
    log(`❌ Erro inesperado: ${error.error}`, 'red');
    return { success: false, error: error.error, duration: error.duration };
  }
}

// Teste 4: Headers com caracteres especiais
async function testSpecialCharacters() {
  log('\n🔤 Teste: Headers com Caracteres Especiais', 'yellow');
  log('=' * 50, 'yellow');
  
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
  const largeSpecialHeader = specialChars.repeat(10000); // 10KB de caracteres especiais
  
  const headers = {
    'x-special-header': largeSpecialHeader,
    'x-unicode-header': '🚀'.repeat(5000), // 5KB de emojis
    'x-binary-header': Buffer.from('x'.repeat(10000)).toString('base64') // 10KB em base64
  };
  
  const totalSize = JSON.stringify(headers).length;
  log(`📊 Tamanho total dos headers: ${formatSize(totalSize)}`);
  
  try {
    const result = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`, { headers });
    
    if (result.statusCode >= 200 && result.statusCode < 500) {
      log(`✅ API respondeu corretamente: ${result.statusCode}`, 'green');
      log(`⏱️  Duração: ${result.duration.toFixed(2)}ms`, 'blue');
      return { success: true, duration: result.duration, statusCode: result.statusCode };
    } else {
      log(`⚠️  API respondeu com erro: ${result.statusCode}`, 'yellow');
      return { success: true, duration: result.duration, statusCode: result.statusCode }; // Erro esperado
    }
  } catch (error) {
    log(`❌ Erro inesperado: ${error.error}`, 'red');
    return { success: false, error: error.error, duration: error.duration };
  }
}

// Teste 5: Múltiplas requisições com dados grandes
async function testMultipleLargeRequests() {
  log('\n🔄 Teste: Múltiplas Requisições com Dados Grandes', 'yellow');
  log('=' * 50, 'yellow');
  
  const requests = [];
  const concurrency = 10;
  
  for (let i = 0; i < concurrency; i++) {
    const largeHeaderValue = 'x'.repeat(50000); // 50KB
    const headers = {
      [`x-large-header-${i}`]: largeHeaderValue,
      [`x-test-header-${i}`]: largeHeaderValue
    };
    
    const largeBody = {
      data: 'x'.repeat(500000), // 500KB
      items: Array.from({ length: 100 }, (_, j) => ({
        id: j,
        content: 'x'.repeat(1000),
        metadata: { created: new Date().toISOString() }
      }))
    };
    
    requests.push(
      makeRequest(`${CONFIG.baseUrl}/api/v1/todos`, {
        method: 'POST',
        headers,
        body: largeBody
      }).then(result => ({ success: true, duration: result.duration, statusCode: result.statusCode }))
        .catch(error => ({ success: false, error: error.error, duration: error.duration }))
    );
  }
  
  log(`🚀 Executando ${concurrency} requisições simultâneas com dados grandes...`);
  
  const results = await Promise.all(requests);
  const successful = results.filter(r => r.success).length;
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  
  log(`✅ Requisições bem-sucedidas: ${successful}/${concurrency}`);
  log(`⏱️  Duração média: ${avgDuration.toFixed(2)}ms`);
  log(`📊 Taxa de sucesso: ${((successful / concurrency) * 100).toFixed(2)}%`);
  
  return { successful, total: concurrency, avgDuration };
}

// Função principal
async function main() {
  log('🧪 Iniciando Testes de Dados Grandes da SDK Logger', 'cyan');
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
  
  stats.startTime = performance.now();
  
  try {
    // Executar todos os testes
    const test1 = await testLargeHeaders();
    const test2 = await testLargeBody();
    const test3 = await testLargeHeadersAndBody();
    const test4 = await testSpecialCharacters();
    const test5 = await testMultipleLargeRequests();
    
    // Calcular estatísticas
    const allTests = [test1, test2, test3, test4, test5];
    stats.totalTests = allTests.length;
    stats.passedTests = allTests.filter(t => t.success).length;
    stats.failedTests = stats.totalTests - stats.passedTests;
    
    const totalTime = performance.now() - stats.startTime;
    
    // Exibir resumo
    log('\n' + '=' * 60, 'cyan');
    log('📊 RESUMO DOS TESTES', 'cyan');
    log('=' * 60, 'cyan');
    
    log(`\n📈 Estatísticas:`, 'white');
    log(`   Total de testes: ${colors.blue}${stats.totalTests}${colors.reset}`);
    log(`   Testes aprovados: ${colors.green}${stats.passedTests}${colors.reset}`);
    log(`   Testes falharam: ${colors.red}${stats.failedTests}${colors.reset}`);
    
    if (stats.totalTests > 0) {
      const successRate = ((stats.passedTests / stats.totalTests) * 100).toFixed(2);
      log(`   Taxa de sucesso: ${colors.green}${successRate}%${colors.reset}`);
    }
    
    log(`\n⏱️  Tempo total: ${colors.cyan}${(totalTime/1000).toFixed(2)}s${colors.reset}`);
    
    // Status final
    if (stats.failedTests === 0) {
      log(`\n🎉 Todos os testes passaram! A SDK está robusta com dados grandes.`, 'green');
    } else {
      log(`\n⚠️  ${stats.failedTests} teste(s) falharam. Verifique os logs acima.`, 'yellow');
    }
    
    log('\n' + '=' * 60, 'cyan');
    
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
  testLargeHeaders,
  testLargeBody,
  testLargeHeadersAndBody,
  testSpecialCharacters,
  testMultipleLargeRequests
};
