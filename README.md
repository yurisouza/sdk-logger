# 🚀 SDK Logger SigNoz

SDK para padronização de logs e integração automática com SigNoz Cloud, capturando automaticamente todos os requests e responses da API.

## ⚡ Instalação Rápida

```bash
npm install @yurisouza/sdk-logger
```

## 🎯 Funcionalidades

- ✅ **Logs Estruturados**: Logs em formato JSON com contexto rico
- ✅ **Tracing Distribuído**: Rastreamento completo de requisições
- ✅ **Integração Automática**: Interceptors para NestJS
- ✅ **SigNoz Cloud**: Envio automático para SigNoz
- ✅ **Contexto de Usuário**: Rastreamento por usuário e sessão
- ✅ **Performance**: Logs assíncronos e otimizados

## 🚀 Uso Básico

```typescript
import { Logger } from '@yurisouza/sdk-logger';

const logger = new Logger({
  service: 'meu-servico',
  version: '1.0.0',
  environment: 'production',
  signoz: {
    endpoint: 'https://ingest.us.signoz.cloud:443',
    apiKey: 'seu-api-key',
    serviceName: 'meu-servico',
    serviceVersion: '1.0.0',
    environment: 'production'
  }
});

logger.info('Aplicação iniciada');
logger.error('Erro ocorreu', { error: 'Detalhes' });
```

## 🔧 Integração Automática com NestJS

### 1. Configurar Variáveis de Ambiente

```env
SIGNOZ_ENDPOINT=https://ingest.us.signoz.cloud:443
SIGNOZ_API_KEY=seu-api-key
SIGNOZ_SERVICE_NAME=meu-servico
SIGNOZ_SERVICE_VERSION=1.0.0
SIGNOZ_ENVIRONMENT=production
```

### 2. Setup Automático (Recomendado)

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

### 3. Setup com Configuração Personalizada

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

## 🎨 Adicionando Contexto via Decorator

É possível enriquecer os logs dinamicamente usando **decorators** no NestJS para adicionar atributos extras (ex.: ação, categoria, etc.).  
Esses valores simples (string, número, boolean, arrays) irão automaticamente para **attributes** no SigNoz, ficando filtráveis.  
Objetos complexos irão para o **body.context**, ficando navegáveis no detalhe do log.

### Exemplo de uso

```typescript
// add-log-context.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const AddLogContext = (ctx: Record<string, any>) =>
  SetMetadata('logContext', ctx);
```

```typescript
// interceptor de logging
const extraCtx = this.reflector.get('logContext', context.getHandler());
const logEntry: LogEntry = {
  message: '...',
  level: 'info',
  timestamp: new Date(),
  context: {
    ...(extraCtx ?? {}),
    ...existingContext,
  },
};
```

```typescript
// controller
@Post()
@AddLogContext({ action: 'create_todo', category: createTodoDto.category })
async create(@Body() createTodoDto: CreateTodoDto) {
  return this.todoService.create(createTodoDto);
}
```

No SigNoz:
- `action` e `category` aparecerão como **attributes filtráveis**
- Qualquer objeto/array complexo adicionado irá para **body.context** como detalhe navegável

## ✅ Pronto!

Agora todos os requests e responses da sua API serão automaticamente logados e rastreados no SigNoz Cloud!

## 📚 Documentação

- **[🔧 Guia de Implementação](IMPLEMENTATION.md)** - Documentação completa
- **[📖 Exemplos de Uso](src/examples/)** - Exemplos práticos

## 🔍 O que será capturado automaticamente:

- ✅ **Todos os requests** (GET, POST, PUT, DELETE)
- ✅ **Todas as responses** (sucesso e erro)
- ✅ **Tempo de resposta** de cada endpoint
- ✅ **Erros** com stack trace
- ✅ **Contexto de usuário** (se disponível)
- ✅ **Traces distribuídos** completos

## 🎯 Próximos Passos

1. **Configurar alertas** no SigNoz
2. **Criar dashboards** personalizados
3. **Monitorar performance** da API
4. **Configurar retenção** de logs

## 📊 Estrutura dos Logs

Os logs enviados para o SigNoz seguem a estrutura OpenTelemetry:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "info",
  "message": "Mensagem do log",
  "service": "meu-servico",
  "version": "1.0.0",
  "environment": "production",
  "traceId": "trace-123",
  "spanId": "span-456",
  "userId": "user-123",
  "requestId": "req-789",
  "correlationId": "corr-abc",
  "context": {
    "customField": "valor"
  }
}
```

## 🛠️ Desenvolvimento

```bash
# Instalar dependências
npm install

# Build
npm run build

# Desenvolvimento com watch
npm run dev

# Testes
npm test

# Lint
npm run lint
```

## 📄 Licença

MIT