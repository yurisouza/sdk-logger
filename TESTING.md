# 🧪 Testes de Carga e Stress da SDK Logger

Este diretório contém uma suíte completa de testes para verificar a robustez e performance da SDK Logger em cenários extremos.

## 📁 Arquivos de Teste

Os arquivos de teste estão localizados na pasta `test-files/`:

### `test-files/test-load-stress.js`
Testes de carga e stress para verificar performance:
- **Carga Normal**: 100 requisições com 10 de concorrência
- **Alta Carga**: 500 requisições com 50 de concorrência  
- **Stress Test**: 1000 requisições com 100 de concorrência
- **Teste de Memória**: 2000 requisições com 200 de concorrência
- **Dados Malformados**: Headers inválidos, body muito grande, etc.
- **Concorrência Extrema**: 500 requisições simultâneas

### `test-files/test-sdk-failures.js`
Testes de falhas específicas da SDK:
- **Falha de Rede**: Simula endpoint inválido para Collector
- **Memory Leak**: Monitora vazamentos no SpanProcessor
- **Dados Malformados**: Headers com caracteres especiais
- **Concorrência Extrema**: 1000 requisições simultâneas
- **Timeout de Exportação**: Simula timeout de 1ms

### `test-files/test-monitor.js`
Monitor de performance em tempo real:
- **Dashboard Live**: Uso de memória, latência, throughput
- **Estatísticas**: Taxa de sucesso, erros mais comuns
- **Monitoramento**: Requisições por segundo, duração média

### `test-files/test-runner.js`
Script principal para executar todos os testes:
- **Modo Interativo**: Menu com opções
- **Modo CLI**: Argumentos da linha de comando
- **Verificação de API**: Aguarda API ficar online
- **Resumo**: Estatísticas finais dos testes

## 🚀 Como Usar

### 1. Preparar o Ambiente

```bash
# 1. Iniciar a API (em outro terminal)
cd api-todolist
npm run start:dev

# 2. Compilar a SDK
cd ../sdk-logger
npm run build
```

### 2. Executar Testes

#### Modo Interativo
```bash
node test-files/test-runner.js
```

#### Modo CLI
```bash
# Todos os testes
node test-files/test-runner.js all

# Teste específico
node test-files/test-runner.js load      # Carga normal
node test-files/test-runner.js stress    # Stress test
node test-files/test-runner.js memory    # Teste de memória
node test-files/test-runner.js failures  # Testes de falhas
node test-files/test-runner.js monitor   # Monitor em tempo real
```

#### Testes Individuais
```bash
# Teste de carga
node test-files/test-load-stress.js

# Teste de falhas
node test-files/test-sdk-failures.js

# Monitor em tempo real
node test-files/test-monitor.js
```

## 📊 O Que os Testes Verificam

### ✅ Robustez da SDK
- **Falhas de Rede**: API continua funcionando mesmo com Collector offline
- **Dados Inválidos**: Headers malformados não quebram a aplicação
- **Timeouts**: Exportação com timeout não impacta performance
- **Memory Leaks**: SpanProcessor não vaza memória

### ✅ Performance
- **Alta Concorrência**: 1000+ requisições simultâneas
- **Throughput**: Requisições por segundo
- **Latência**: Duração média das requisições
- **Uso de Memória**: Monitoramento de vazamentos

### ✅ Duração Precisa
- **Log vs Trace**: Durações idênticas entre log e trace
- **SpanProcessor**: Captura correta de durações
- **Fallback**: Medição de fallback quando span não disponível

## 🎯 Cenários de Teste

### 1. Carga Normal
- **Objetivo**: Verificar funcionamento básico
- **Configuração**: 100 requisições, 10 concorrência
- **Métrica**: Taxa de sucesso > 95%

### 2. Alta Carga
- **Objetivo**: Testar performance sob carga
- **Configuração**: 500 requisições, 50 concorrência
- **Métrica**: Latência média < 100ms

### 3. Stress Test
- **Objetivo**: Limites da aplicação
- **Configuração**: 1000 requisições, 100 concorrência
- **Métrica**: Aplicação não quebra

### 4. Teste de Memória
- **Objetivo**: Detectar vazamentos
- **Configuração**: 2000 requisições, 200 concorrência
- **Métrica**: Aumento de memória < 50MB

### 5. Falhas de Rede
- **Objetivo**: Robustez com Collector offline
- **Configuração**: Endpoint inválido
- **Métrica**: API continua funcionando

### 6. Dados Malformados
- **Objetivo**: Robustez com dados inválidos
- **Configuração**: Headers grandes, caracteres especiais
- **Métrica**: API não quebra

## 📈 Interpretando Resultados

### ✅ Teste Aprovado
```
✅ Requisições: 1000/1000
⏱️  Duração média: 45.2ms
📊 Taxa de sucesso: 99.8%
🧠 Sem vazamento de memória detectado
```

### ⚠️ Teste com Avisos
```
✅ Requisições: 1000/1000
⏱️  Duração média: 45.2ms
📊 Taxa de sucesso: 99.8%
⚠️  POSSÍVEL VAZAMENTO DE MEMÓRIA: 75.2MB
```

### ❌ Teste Falhou
```
❌ Requisições: 500/1000
⏱️  Duração média: 250.5ms
📊 Taxa de sucesso: 50.0%
❌ Muitos erros de timeout
```

## 🔧 Configurações

### Variáveis de Ambiente
```bash
# Timeout para Collector (opcional)
export COLLECTOR_TIMEOUT=5000

# Endpoint do Collector (opcional)
export COLLECTOR_ENDPOINT=http://localhost:4318
```

### Personalizar Testes
Edite os arquivos de teste para ajustar:
- **Número de requisições**: `requests` em `testScenarios`
- **Concorrência**: `concurrency` em `testScenarios`
- **Intervalo**: `delay` em `testScenarios`
- **Duração**: `testDuration` em `test-sdk-failures.js`

## 🚨 Troubleshooting

### API Não Está Rodando
```
❌ API não está rodando! Inicie a API antes de executar os testes.
💡 Execute: cd api-todolist && npm run start:dev
```
**Solução**: Inicie a API em outro terminal

### Timeout de Requisições
```
❌ Erro na requisição 150: Request timeout
```
**Solução**: Verifique se a API está respondendo normalmente

### Vazamento de Memória
```
⚠️  POSSÍVEL VAZAMENTO DE MEMÓRIA: 75.2MB
```
**Solução**: Verifique o SpanProcessor e limpeza do Map

### Falhas de Rede
```
❌ Erro na requisição 50: ECONNREFUSED
```
**Solução**: Verifique se a API está rodando na porta 3000

## 📝 Logs de Debug

Para ativar logs de debug, adicione no início dos arquivos de teste:
```javascript
process.env.DEBUG = 'true';
```

## 🎉 Conclusão

Estes testes garantem que a SDK Logger é:
- **Robusta**: Não quebra com falhas de rede ou dados inválidos
- **Performática**: Suporta alta concorrência e carga
- **Precisa**: Durações idênticas entre log e trace
- **Estável**: Sem vazamentos de memória
- **Confiável**: Pronta para produção

Execute os testes regularmente para garantir a qualidade da SDK! 🚀

