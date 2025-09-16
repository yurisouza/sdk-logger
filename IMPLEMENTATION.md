# 🔧 Guia de Implementação - SDK Logger SigNoz

## 📋 Visão Geral

Esta SDK permite integração automática de logs e traces com SigNoz Cloud, capturando automaticamente todos os requests e responses da API.

## 🚀 Instalação Rápida

### 1. Instalar Dependências

```bash
npm install @yurisouza/sdk-logger
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http
```

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env`:

```env
# SigNoz Cloud Configuration
SIGNOZ_ENDPOINT=https://ingest.us.signoz.cloud:443
SIGNOZ_API_KEY=seu-api-key-aqui
SIGNOZ_SERVICE_NAME=meu-servico
SIGNOZ_SERVICE_VERSION=1.0.0
SIGNOZ_ENVIRONMENT=production
```

## 🔧 Configuração com NestJS

### 1. Setup Automático (Recomendado)

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupMinimalLogging } from '@yurisouza/sdk-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Setup automático - apenas uma linha!
  setupMinimalLogging(app);
  
  await app.listen(3000);
}
bootstrap();
```

### 2. Setup com Configuração Personalizada

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupCompleteLogging } from '@yurisouza/sdk-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Setup com configuração personalizada
  setupCompleteLogging(
    app,
    'meu-servico',
    '1.0.0',
    'production',
    'https://ingest.us.signoz.cloud:443',
    'seu-api-key'
  );
  
  await app.listen(3000);
}
bootstrap();
```

### 3. Setup Avançado com Configuração Customizada

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupLogging } from '@yurisouza/sdk-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Setup com configuração customizada
  setupLogging(app, {
    service: 'meu-servico',
    version: '1.0.0',
    environment: 'production',
    logLevel: 'debug',
    enableConsole: true,
    enableFile: true,
    signoz: {
      endpoint: 'https://ingest.us.signoz.cloud:443',
      apiKey: 'seu-api-key',
      serviceName: 'meu-servico',
      serviceVersion: '1.0.0',
      environment: 'production',
      enableLogs: true
    }
  });
  
  await app.listen(3000);
}
bootstrap();
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

## 🚨 Troubleshooting

### Logs não aparecem no SigNoz
- Verificar API key
- Verificar endpoint
- Verificar conectividade de rede

### Traces não aparecem
- Verificar se OpenTelemetry está inicializado
- Verificar se interceptor está registrado
- Verificar se requests estão sendo feitos

## 📞 Suporte

Para dúvidas ou problemas:
- 📧 Email: yuri.souza@example.com
- 🐛 Issues: https://github.com/yurisouza/sdk-logger/issues