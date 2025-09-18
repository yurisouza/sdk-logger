# 🚀 SDK Logger SigNoz

SDK para padronização de logs e integração automática com SigNoz Cloud, capturando automaticamente todos os requests e responses da API.

## ⚡ Instalação Rápida

```bash
npm install @psouza.yuri/sdk-logger
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

## 🔍 Criando Traces Customizados

Para rastrear operações específicas do seu negócio, você pode criar spans customizados que aparecerão no trace distribuído.

### 1. Importar o Tracer

```typescript
import { trace } from '@opentelemetry/api';

// Obter o tracer
const tracer = trace.getTracer('meu-servico', '1.0.0');
```

### 2. Criar Spans Customizados

```typescript
// Exemplo: Rastrear operação de negócio
async function processarPagamento(pagamento: Pagamento) {
  // Criar span customizado
  const span = tracer.startSpan('processar-pagamento', {
    attributes: {
      'payment.id': pagamento.id,
      'payment.amount': pagamento.valor,
      'payment.method': pagamento.metodo,
      'business.operation': 'payment_processing'
    }
  });

  try {
    // Sua lógica de negócio aqui
    const resultado = await validarPagamento(pagamento);
    
    // Adicionar atributos de sucesso
    span.setAttributes({
      'payment.status': 'success',
      'payment.processed_at': new Date().toISOString()
    });

    return resultado;
  } catch (error) {
    // Marcar span como erro
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    // Sempre finalizar o span
    span.end();
  }
}
```

### 3. Spans Aninhados (Hierárquicos)

```typescript
async function processarPedido(pedido: Pedido) {
  const span = tracer.startSpan('processar-pedido', {
    attributes: {
      'order.id': pedido.id,
      'order.total': pedido.total
    }
  });

  try {
    // Span filho: validação
    const validacaoSpan = tracer.startSpan('validar-pedido', {
      parent: span
    });
    
    await validarPedido(pedido);
    validacaoSpan.end();

    // Span filho: processamento de pagamento
    const pagamentoSpan = tracer.startSpan('processar-pagamento', {
      parent: span,
      attributes: {
        'payment.method': pedido.metodoPagamento
      }
    });
    
    await processarPagamento(pedido.pagamento);
    pagamentoSpan.end();

    // Span filho: envio de email
    const emailSpan = tracer.startSpan('enviar-email-confirmacao', {
      parent: span
    });
    
    await enviarEmailConfirmacao(pedido);
    emailSpan.end();

    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    span.end();
  }
}
```

### 4. Usando com Decorators

```typescript
// decorator para traces customizados
export function TraceOperation(operationName: string, attributes?: Record<string, any>) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const span = tracer.startSpan(operationName, {
        attributes: {
          'method.name': propertyName,
          'class.name': target.constructor.name,
          ...attributes
        }
      });

      try {
        const result = await method.apply(this, args);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        throw error;
      } finally {
        span.end();
      }
    };
  };
}

// Uso do decorator
class PedidoService {
  @TraceOperation('calcular-frete', { 'business.operation': 'shipping_calculation' })
  async calcularFrete(endereco: Endereco) {
    // Lógica de cálculo de frete
    return await this.freteService.calcular(endereco);
  }
}
```

### 5. Integração com Logger

```typescript
import { Logger } from '@psouza.yuri/sdk-logger';

class PedidoService {
  private logger = new Logger({
    service: 'pedido-service',
    version: '1.0.0',
    environment: 'production',
    signoz: {
      endpoint: process.env.SIGNOZ_ENDPOINT!,
      apiKey: process.env.SIGNOZ_API_KEY!,
      serviceName: 'pedido-service',
      serviceVersion: '1.0.0',
      environment: 'production'
    }
  });

  async processarPedido(pedido: Pedido) {
    const span = tracer.startSpan('processar-pedido');
    
    try {
      // Log com contexto de trace
      this.logger.info('Iniciando processamento do pedido', {
        orderId: pedido.id,
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId
      });

      const resultado = await this.processar(pedido);
      
      this.logger.info('Pedido processado com sucesso', {
        orderId: pedido.id,
        result: resultado
      });

      return resultado;
    } catch (error) {
      this.logger.error('Erro ao processar pedido', {
        orderId: pedido.id,
        error: error.message
      });
      throw error;
    } finally {
      span.end();
    }
  }
}
```

### 6. Tipos de Spans Recomendados

```typescript
// Operações de negócio
tracer.startSpan('criar-usuario')
tracer.startSpan('processar-pagamento')
tracer.startSpan('enviar-notificacao')

// Operações de integração
tracer.startSpan('chamar-api-externa')
tracer.startSpan('consultar-banco-dados')
tracer.startSpan('enviar-email')

// Operações de sistema
tracer.startSpan('validar-dados')
tracer.startSpan('transformar-dados')
tracer.startSpan('gerar-relatorio')
```

### 7. Atributos Recomendados

```typescript
// Identificadores
'user.id': '12345'
'order.id': 'ORD-2024-001'
'payment.id': 'PAY-789'

// Categorização
'business.operation': 'payment_processing'
'business.domain': 'ecommerce'
'business.action': 'create_order'

// Performance
'operation.duration_ms': 150
'operation.retry_count': 2

// Status
'operation.status': 'success'
'operation.error_code': 'VALIDATION_ERROR'
```

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

## 🤖 Automação e Releases

Este projeto usa GitHub Actions para automatizar a publicação no NPM:

- **CI/CD**: Testes automáticos em cada PR
- **Publishing**: Publicação automática quando uma tag é criada
- **Releases**: Criação automática de releases no GitHub

### Criar um Release

```bash
# Usar o script automatizado
./scripts/release.sh patch "Descrição da mudança"

# Ou manualmente
npm version patch
git push origin main --tags
```

📚 **Documentação completa**: [RELEASE.md](./RELEASE.md)

## 📄 Licença

MIT