#!/usr/bin/env node

/**
 * Test Runner para SDK Logger
 * 
 * Este script executa todos os testes de carga e stress:
 * - Testes de carga normal
 * - Testes de alta carga
 * - Testes de stress
 * - Testes de memória
 * - Testes de falhas
 * - Monitor em tempo real
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configurações
const CONFIG = {
  testFiles: [
    'test-load-stress.js',
    'test-sdk-failures.js',
    'test-monitor.js'
  ],
  testTimeout: 300000, // 5 minutos
  apiCheckInterval: 5000, // 5 segundos
  maxApiCheckAttempts: 60 // 5 minutos
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
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  startTime: 0,
  endTime: 0
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Verificar se a API está rodando
async function checkApiHealth() {
  const http = require('http');
  
  return new Promise((resolve) => {
    const req = http.request('http://localhost:3000/api/v1/todos', (res) => {
      resolve(res.statusCode === 200);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

// Aguardar API ficar online
async function waitForApi() {
  log('🔍 Verificando se a API está rodando...', 'yellow');
  
  for (let i = 0; i < CONFIG.maxApiCheckAttempts; i++) {
    const isOnline = await checkApiHealth();
    
    if (isOnline) {
      log('✅ API está online!', 'green');
      return true;
    }
    
    log(`⏳ Aguardando API... (${i + 1}/${CONFIG.maxApiCheckAttempts})`, 'yellow');
    await new Promise(resolve => setTimeout(resolve, CONFIG.apiCheckInterval));
  }
  
  log('❌ API não ficou online dentro do tempo esperado!', 'red');
  log('💡 Execute: cd api-todolist && npm run start:dev', 'yellow');
  return false;
}

// Executar teste
async function runTest(testFile) {
  return new Promise((resolve) => {
    log(`\n🧪 Executando teste: ${testFile}`, 'cyan');
    log('=' * 60, 'cyan');
    
    const testPath = path.join(__dirname, testFile);
    
    if (!fs.existsSync(testPath)) {
      log(`❌ Arquivo de teste não encontrado: ${testFile}`, 'red');
      resolve({ success: false, error: 'File not found' });
      return;
    }
    
    const startTime = Date.now();
    const child = spawn('node', [testPath], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      log(`⏰ Teste ${testFile} excedeu o tempo limite`, 'yellow');
      resolve({ success: false, error: 'Timeout' });
    }, CONFIG.testTimeout);
    
    child.on('close', (code) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      
      if (code === 0) {
        log(`✅ Teste ${testFile} concluído com sucesso em ${formatDuration(duration)}`, 'green');
        resolve({ success: true, duration });
      } else {
        log(`❌ Teste ${testFile} falhou com código ${code} em ${formatDuration(duration)}`, 'red');
        resolve({ success: false, error: `Exit code ${code}`, duration });
      }
    });
    
    child.on('error', (error) => {
      clearTimeout(timeout);
      log(`❌ Erro ao executar teste ${testFile}: ${error.message}`, 'red');
      resolve({ success: false, error: error.message });
    });
  });
}

// Executar todos os testes
async function runAllTests() {
  log('🚀 Iniciando Testes de Carga e Stress da SDK Logger', 'cyan');
  log('=' * 80, 'cyan');
  
  stats.startTime = Date.now();
  
  // Verificar se a API está rodando
  const isApiOnline = await waitForApi();
  if (!isApiOnline) {
    process.exit(1);
  }
  
  // Executar cada teste
  for (const testFile of CONFIG.testFiles) {
    stats.totalTests++;
    
    const result = await runTest(testFile);
    
    if (result.success) {
      stats.passedTests++;
    } else {
      stats.failedTests++;
    }
  }
  
  stats.endTime = Date.now();
  
  // Exibir resumo
  displaySummary();
}

// Exibir resumo dos testes
function displaySummary() {
  const totalDuration = stats.endTime - stats.startTime;
  
  log('\n' + '=' * 80, 'cyan');
  log('📊 RESUMO DOS TESTES', 'cyan');
  log('=' * 80, 'cyan');
  
  log(`\n📈 Estatísticas:`, 'white');
  log(`   Total de testes: ${colors.blue}${stats.totalTests}${colors.reset}`);
  log(`   Testes aprovados: ${colors.green}${stats.passedTests}${colors.reset}`);
  log(`   Testes falharam: ${colors.red}${stats.failedTests}${colors.reset}`);
  
  if (stats.totalTests > 0) {
    const successRate = ((stats.passedTests / stats.totalTests) * 100).toFixed(2);
    log(`   Taxa de sucesso: ${colors.green}${successRate}%${colors.reset}`);
  }
  
  log(`\n⏱️  Tempo total: ${colors.cyan}${formatDuration(totalDuration)}${colors.reset}`);
  
  // Status final
  if (stats.failedTests === 0) {
    log(`\n🎉 Todos os testes passaram! A SDK está robusta e pronta para produção.`, 'green');
  } else {
    log(`\n⚠️  ${stats.failedTests} teste(s) falharam. Verifique os logs acima.`, 'yellow');
  }
  
  log('\n' + '=' * 80, 'cyan');
}

// Exibir menu de opções
function displayMenu() {
  log('\n🧪 Test Runner da SDK Logger', 'cyan');
  log('=' * 40, 'cyan');
  log('1. Executar todos os testes');
  log('2. Teste de carga normal');
  log('3. Teste de alta carga');
  log('4. Teste de stress');
  log('5. Teste de memória');
  log('6. Teste de falhas');
  log('7. Monitor em tempo real');
  log('8. Sair');
  log('=' * 40, 'cyan');
}

// Executar teste específico
async function runSpecificTest(testName) {
  const testMap = {
    '1': 'all',
    '2': 'test-load-stress.js',
    '3': 'test-load-stress.js',
    '4': 'test-load-stress.js',
    '5': 'test-load-stress.js',
    '6': 'test-sdk-failures.js',
    '7': 'test-monitor.js'
  };
  
  const testFile = testMap[testName];
  
  if (!testFile) {
    log('❌ Opção inválida!', 'red');
    return;
  }
  
  if (testFile === 'all') {
    await runAllTests();
  } else {
    const isApiOnline = await waitForApi();
    if (!isApiOnline) {
      process.exit(1);
    }
    
    await runTest(testFile);
  }
}

// Função principal
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // Executar com argumentos da linha de comando
    const command = args[0];
    
    switch (command) {
      case 'all':
        await runAllTests();
        break;
      case 'load':
        await runSpecificTest('2');
        break;
      case 'stress':
        await runSpecificTest('4');
        break;
      case 'memory':
        await runSpecificTest('5');
        break;
      case 'failures':
        await runSpecificTest('6');
        break;
      case 'monitor':
        await runSpecificTest('7');
        break;
      default:
        log('❌ Comando inválido!', 'red');
        log('💡 Comandos disponíveis: all, load, stress, memory, failures, monitor', 'yellow');
        process.exit(1);
    }
  } else {
    // Modo interativo
    displayMenu();
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', async (data) => {
      const choice = data.trim();
      
      if (choice === '8') {
        log('👋 Saindo...', 'yellow');
        process.exit(0);
      }
      
      await runSpecificTest(choice);
      displayMenu();
    });
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runAllTests,
  runSpecificTest,
  checkApiHealth,
  waitForApi
};

