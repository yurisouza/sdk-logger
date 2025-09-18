# 🔧 Guia de Implementação - SDK Logger SigNoz

## 📋 Visão Geral

Esta SDK permite integração automática de logs e traces com SigNoz Cloud, capturando automaticamente todos os requests e responses da API com uma API simplificada e consistente.

## 🚀 Instalação Rápida

### 1. Instalar Dependências

```bash
npm install @yurisouza/sdk-logger
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http
```

## 🔧 Configuração com NestJS

### 1. Setup Simplificado (Recomendado)

```typescript
// src/main.ts
import { setupTelemetry, setupLogging } from '@yurisouza/sdk-logger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Configuração única
const config = {
  endpoint: 'https://ingest.us.signoz.cloud:443',
  apiKey: 'seu-api-key-aqui',
  serviceName: 'meu-servico',
  serviceVersion: '1.0.0',
  environment: 'production'
};

// 1. Setup telemetry ANTES do NestJS
setupTelemetry(config);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 2. Setup logging DEPOIS do NestJS
  setupLogging(app, config);
  
  await app.listen(3000);
}
bootstrap();
```

### 2. Setup com Variáveis de Ambiente

```typescript
// src/main.ts
import { setupTelemetry, setupLogging } from '@yurisouza/sdk-logger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Configuração via variáveis de ambiente
const config = {
  endpoint: process.env.SIGNOZ_ENDPOINT || 'https://ingest.us.signoz.cloud:443',
  apiKey: process.env.SIGNOZ_API_KEY || '',
  serviceName: process.env.SIGNOZ_SERVICE_NAME || 'app',
  serviceVersion: process.env.SIGNOZ_SERVICE_VERSION || '1.0.0',
  environment: process.env.SIGNOZ_ENVIRONMENT || 'production'
};

// 1. Setup telemetry ANTES do NestJS
setupTelemetry(config);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 2. Setup logging DEPOIS do NestJS
  setupLogging(app, config);
  
  await app.listen(3000);
}
bootstrap();
```

### 3. Setup com Logger Personalizado

```typescript
// src/main.ts
import { setupTelemetry, setupLogging, createLogger, LogLevel } from '@yurisouza/sdk-logger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const config = {
  endpoint: 'https://ingest.us.signoz.cloud:443',
  apiKey: 'seu-api-key-aqui',
  serviceName: 'meu-servico',
  serviceVersion: '1.0.0',
  environment: 'production',
  logLevel: LogLevel.DEBUG,
  enableConsole: true
};

// 1. Setup telemetry ANTES do NestJS
setupTelemetry(config);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 2. Setup logging DEPOIS do NestJS
  setupLogging(app, config);
  
  // 3. Logger personalizado para uso manual
  const logger = createLogger(config);
  logger.info('Aplicação iniciada com sucesso!');
  
  await app.listen(3000);
}
bootstrap();
```

## 📊 Estrutura da SDK

### Interfaces Principais

```typescript
// Configuração unificada
interface SigNozConfig {
  endpoint: string;
  apiKey: string;
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  enableTracing?: boolean;
  enableLogs?: boolean;
}

// Configuração do Logger (estende SigNozConfig)
interface LoggerConfig extends SigNozConfig {
  logLevel?: LogLevel;
  enableConsole?: boolean;
}

// Para NestJS - alias para SigNozConfig
type NestLoggingConfig = SigNozConfig;
```

### Funções Principais

```typescript
// Setup de telemetry (ANTES do NestJS)
setupTelemetry(config: SigNozConfig): void

// Setup de logging (DEPOIS do NestJS)
setupLogging(app: any, config: SigNozConfig): void

// Criação de logger personalizado
createLogger(config: LoggerConfig): Logger
```

## ✅ Pronto!

Agora todos os requests e responses da sua API serão automaticamente logados e rastreados no SigNoz Cloud!

## 🔍 Verificar no SigNoz

1. **Logs**: Filtre por `service.name = "meu-servico"`
2. **Traces**: Veja a árvore de spans completa
3. **Dashboards**: Configure métricas personalizadas
4. **Alertas**: Configure notificações de erro

## 🎯 O que será capturado automaticamente:

- ✅ **Todos os requests** (GET, POST, PUT, DELETE)
- ✅ **Todas as responses** (sucesso e erro)
- ✅ **Tempo de resposta** de cada endpoint
- ✅ **Erros** com stack trace
- ✅ **Contexto de usuário** (se disponível)
- ✅ **Traces distribuídos** completos
- ✅ **Spans hierárquicos** do NestJS

## 🚨 Troubleshooting

### Logs não aparecem no SigNoz
- Verificar API key
- Verificar endpoint
- Verificar conectividade de rede

### Traces não aparecem
- Verificar se `setupTelemetry()` foi chamado ANTES do NestJS
- Verificar se `setupLogging()` foi chamado DEPOIS do NestJS
- Verificar se requests estão sendo feitos

### Erro de compilação
- Verificar se todas as dependências estão instaladas
- Verificar se as interfaces estão sendo importadas corretamente

## 📈 Melhorias da Versão Simplificada

### ✅ Simplificações Implementadas:
- **Interfaces unificadas**: `SigNozConfig` + `LoggerConfig` + `NestLoggingConfig`
- **Funções padronizadas**: `setupTelemetry()` + `setupLogging()`
- **Arquivos removidos**: 7 arquivos desnecessários eliminados
- **API consistente**: Nomes padronizados e responsabilidades claras
- **Configuração única**: Uma interface para tudo

### ❌ Removido (desnecessário):
- `LogEntry`, `LogContext`, `TracedLoggerContext`
- `setupCompleteLogging()` (confuso)
- `initializeTelemetry()` (inconsistente)
- `opentelemetry/setup.ts` (não usado)
- `exporters/signoz-exporter.ts` (muito complexo)
- `transport/signoz-transport.ts` (redundante)

## 📞 Suporte

Para dúvidas ou problemas:
- 📧 Email: yuri.souza@example.com
- 🐛 Issues: https://github.com/yurisouza/sdk-logger/issues