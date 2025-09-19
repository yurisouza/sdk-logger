#!/usr/bin/env node

/**
 * Monitor de Performance em Tempo Real
 * 
 * Este script monitora a performance da SDK em tempo real:
 * - Uso de memória
 * - Latência das requisições
 * - Taxa de erro
 * - Throughput
 * - Status da API
 */

const http = require('http');
const { performance } = require('perf_hooks');

// Configurações
const CONFIG = {
  baseUrl: 'http://localhost:3000',
  monitorInterval: 1000, // 1 segundo
  requestInterval: 100, // 100ms entre requisições
  maxRequests: 1000 // Máximo de requisições por ciclo
};

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Estatísticas
let stats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalDuration: 0,
  minDuration: Infinity,
  maxDuration: 0,
  startTime: 0,
  lastReset: 0,
  memorySnapshots: [],
  errorCounts: new Map()
};

// Limpar tela
function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[0f');
}

// Log com timestamp
function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

// Formatar duração
function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Formatar memória
function formatMemory(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)}MB`;
}

// Obter uso de memória
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

// Verificar saúde da API
async function checkApiHealth() {
  try {
    const result = await makeRequest(`${CONFIG.baseUrl}/api/v1/todos`);
    return result.statusCode === 200;
  } catch (error) {
    return false;
  }
}

// Fazer requisição de teste
async function makeTestRequest() {
  const endpoints = [
    '/api/v1/todos',
    '/api/v1/todos?category=work',
    '/api/v1/todos?completed=true'
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  try {
    const result = await makeRequest(`${CONFIG.baseUrl}${endpoint}`);
    
    stats.totalRequests++;
    stats.successfulRequests++;
    stats.totalDuration += result.duration;
    
    if (result.duration < stats.minDuration) {
      stats.minDuration = result.duration;
    }
    
    if (result.duration > stats.maxDuration) {
      stats.maxDuration = result.duration;
    }
    
    return { success: true, duration: result.duration, statusCode: result.statusCode };
  } catch (error) {
    stats.totalRequests++;
    stats.failedRequests++;
    
    const errorKey = error.error || error.code || 'UNKNOWN';
    stats.errorCounts.set(errorKey, (stats.errorCounts.get(errorKey) || 0) + 1);
    
    return { success: false, duration: error.duration, error: errorKey };
  }
}

// Exibir dashboard
function displayDashboard() {
  clearScreen();
  
  const now = Date.now();
  const uptime = now - stats.startTime;
  const uptimeSeconds = Math.floor(uptime / 1000);
  
  // Cabeçalho
  console.log(`${colors.cyan}╔════════════════════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.cyan}║                           🚀 SDK Logger Monitor                              ║${colors.reset}`);
  console.log(`${colors.cyan}╚════════════════════════════════════════════════════════════════════════════════╝${colors.reset}`);
  
  // Status da API
  const apiStatus = stats.successfulRequests > 0 ? '🟢 ONLINE' : '🔴 OFFLINE';
  console.log(`\n${colors.white}📊 Status da API: ${apiStatus}${colors.reset}`);
  
  // Estatísticas de requisições
  console.log(`\n${colors.white}📈 Estatísticas de Requisições:${colors.reset}`);
  console.log(`   Total: ${colors.green}${stats.totalRequests}${colors.reset}`);
  console.log(`   Sucessos: ${colors.green}${stats.successfulRequests}${colors.reset}`);
  console.log(`   Falhas: ${colors.red}${stats.failedRequests}${colors.reset}`);
  
  if (stats.totalRequests > 0) {
    const successRate = ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2);
    console.log(`   Taxa de sucesso: ${colors.green}${successRate}%${colors.reset}`);
  }
  
  // Estatísticas de performance
  if (stats.successfulRequests > 0) {
    const avgDuration = stats.totalDuration / stats.successfulRequests;
    console.log(`\n${colors.white}⏱️  Performance:${colors.reset}`);
    console.log(`   Duração média: ${colors.blue}${formatDuration(avgDuration)}${colors.reset}`);
    console.log(`   Duração mínima: ${colors.green}${formatDuration(stats.minDuration)}${colors.reset}`);
    console.log(`   Duração máxima: ${colors.red}${formatDuration(stats.maxDuration)}${colors.reset}`);
  }
  
  // Throughput
  if (uptimeSeconds > 0) {
    const throughput = stats.totalRequests / uptimeSeconds;
    console.log(`\n${colors.white}🚀 Throughput:${colors.reset}`);
    console.log(`   Requisições/segundo: ${colors.magenta}${throughput.toFixed(2)}${colors.reset}`);
  }
  
  // Uso de memória
  const memory = getMemoryUsage();
  console.log(`\n${colors.white}🧠 Uso de Memória:${colors.reset}`);
  console.log(`   Heap usado: ${colors.yellow}${formatMemory(memory.heapUsed)}${colors.reset}`);
  console.log(`   Heap total: ${colors.yellow}${formatMemory(memory.heapTotal)}${colors.reset}`);
  console.log(`   RSS: ${colors.yellow}${formatMemory(memory.rss)}${colors.reset}`);
  
  // Erros mais comuns
  if (stats.errorCounts.size > 0) {
    console.log(`\n${colors.white}❌ Erros mais comuns:${colors.reset}`);
    const sortedErrors = Array.from(stats.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    sortedErrors.forEach(([error, count]) => {
      console.log(`   ${error}: ${colors.red}${count}${colors.reset}`);
    });
  }
  
  // Tempo de execução
  console.log(`\n${colors.white}⏰ Tempo de execução: ${colors.cyan}${formatDuration(uptime)}${colors.reset}`);
  
  // Instruções
  console.log(`\n${colors.yellow}💡 Pressione Ctrl+C para parar o monitor${colors.reset}`);
}

// Resetar estatísticas
function resetStats() {
  stats.totalRequests = 0;
  stats.successfulRequests = 0;
  stats.failedRequests = 0;
  stats.totalDuration = 0;
  stats.minDuration = Infinity;
  stats.maxDuration = 0;
  stats.lastReset = Date.now();
  stats.errorCounts.clear();
}

// Loop principal de monitoramento
async function monitorLoop() {
  let isRunning = true;
  
  // Verificar se a API está rodando
  const isApiHealthy = await checkApiHealth();
  if (!isApiHealthy) {
    log('❌ API não está rodando! Inicie a API antes de executar o monitor.', 'red');
    log('💡 Execute: cd api-todolist && npm run start:dev', 'yellow');
    process.exit(1);
  }
  
  log('✅ API está rodando! Iniciando monitoramento...', 'green');
  
  stats.startTime = Date.now();
  stats.lastReset = stats.startTime;
  
  // Loop de requisições
  const requestLoop = setInterval(async () => {
    if (!isRunning) return;
    
    await makeTestRequest();
  }, CONFIG.requestInterval);
  
  // Loop de exibição
  const displayLoop = setInterval(() => {
    if (!isRunning) return;
    
    displayDashboard();
  }, CONFIG.monitorInterval);
  
  // Handler para parar o monitor
  process.on('SIGINT', () => {
    log('\n🛑 Parando monitor...', 'yellow');
    isRunning = false;
    clearInterval(requestLoop);
    clearInterval(displayLoop);
    
    // Exibir estatísticas finais
    displayDashboard();
    log('\n📊 Monitor finalizado!', 'green');
    process.exit(0);
  });
}

// Função principal
async function main() {
  log('🧪 Iniciando Monitor de Performance da SDK', 'cyan');
  log('=' * 60, 'cyan');
  
  await monitorLoop();
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  makeTestRequest,
  checkApiHealth,
  displayDashboard,
  resetStats
};

