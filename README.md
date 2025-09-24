# 🚀 SDK Logger

SDK para padronização de logs e integração automática com OpenTelemetry Collector, capturando automaticamente todos os requests e responses da API.

## ⚡ Instalação Rápida

```bash
npm install @psouza.yuri/sdk-logger
```

## 🎯 Funcionalidades

- ✅ **Logs Estruturados**: Logs em formato JSON com contexto rico
- ✅ **Tracing Distribuído**: Rastreamento completo de requisições
- ✅ **Integração Automática**: Interceptors para NestJS
- ✅ **Exportador Collector**: Integração com OpenTelemetry Collector
- ✅ **Contexto de Usuário**: Rastreamento por usuário e sessão
- ✅ **Performance**: Logs assíncronos e otimizados
- ✅ **Nível Mínimo de Log**: Controle granular de quais logs são processados
- ✅ **Compatibilidade**: Suporte a configurações legadas

## ⏱️ Entendendo Duration e Timing

### 📊 Conceitos de Duration

A SDK captura diferentes tipos de duration dependendo do contexto:

#### **1. Duration do Logger (Recomendado)**
- **O que mede**: Tempo de processamento da API (span principal)
- **Exemplo**: `8.54ms` para um POST /api/v1/todos
- **Inclui**: Lógica de negócio, validações, processamento
- **Não inclui**: Operações de banco de dados, chamadas externas, middleware

#### **2. Duration do Trace Completo**
- **O que mede**: Tempo total de todas as operações
- **Exemplo**: `69ms` para o mesmo POST
- **Inclui**: 
  - Span principal (8.54ms)
  - Operações de banco de dados (48.73ms)
  - Conexões de rede (8.18ms)
  - Middleware (0.5ms)

#### **3. Duration do Postman/Cliente**
- **O que mede**: Tempo de rede (request → response)
- **Exemplo**: `42ms` para o mesmo POST
- **Inclui**: Latência de rede + processamento total

### 🎯 Por que Diferentes Durations?

```
Cliente (Postman): 42ms
    ↓ (rede)
API recebe request
    ↓
Trace inicia: 17.08ms (middleware + handler)
    ├── Middleware: 0.5ms
    ├── Request Handler: 8.54ms ← LOGGER DURATION
    ├── POST interno (DB): 48.73ms
    └── tcp.connect: 8.18ms
    ↓
Trace total: 69ms
    ↓ (rede)
Cliente recebe response: 42ms
```

### ✅ Qual Duration Usar?

| Contexto | Duration Recomendado | Por quê? |
|----------|---------------------|----------|
| **Logs da API** | Logger (8.54ms) | Tempo real de processamento da API |
| **Monitoramento** | Trace completo (69ms) | Visão completa de performance |
| **Cliente** | Postman (42ms) | Experiência do usuário final |

### 🔧 Implementação Técnica

A SDK usa **precisão de nanosegundos** do OpenTelemetry:

```typescript
// Cálculo preciso usando timestamps do OpenTelemetry
const startNs = start[0] * 1e9 + start[1];  // seconds * 1e9 + nanoseconds
const endNs = end[0] * 1e9 + end[1];        // seconds * 1e9 + nanoseconds
const durationNs = endNs - startNs;         // diferença em nanosegundos
const durationMs = durationNs / 1e6;        // converter para milissegundos
```

### 📈 Benefícios

- **Precisão máxima**: Nanosegundos de precisão
- **Consistência**: Duration do log = Duration do span
- **Performance**: Evita cálculos duplicados
- **Confiabilidade**: Usa fonte oficial do OpenTelemetry

## 🚀 Uso Básico

### OpenTelemetry Collector

```typescript
import { Logger } from '@psouza.yuri/sdk-logger';

const logger = new Logger({
  exporterType: 'collector',
  collector: {
    endpoint: 'http://localhost:4318', // Endpoint do collector
    protocol: 'http', // ou 'grpc'
    timeout: 5000,
    headers: {
      'X-Custom-Header': 'value'
    }
  },
  serviceName: 'meu-servico',
  serviceVersion: '1.0.0',
  environment: 'production'
});

logger.info('Aplicação iniciada');
logger.error('Erro ocorreu', { error: 'Detalhes' });
```


## 🔧 Integração Automática com NestJS

### Setup com OpenTelemetry Collector

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupLogging } from '@psouza.yuri/sdk-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Setup com Collector
  setupLogging(app, {
    exporterType: 'collector',
    collector: {
      endpoint: 'http://localhost:4318',
      protocol: 'http',
      timeout: 5000,
      headers: {
        'X-Custom-Header': 'value'
      }
    },
    serviceName: 'meu-servico',
    serviceVersion: '1.0.0',
    environment: 'production'
  });
  
  await app.listen(3000);
}
bootstrap();
```


## 🔧 Configuração do OpenTelemetry Collector

Para usar o Collector, você precisa configurar um arquivo `collector.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318
      grpc:
        endpoint: 0.0.0.0:4317

processors:
  batch:
    send_batch_size: 4096
    timeout: 5s

exporters:
  # Debug (opcional)
  debug:
    verbosity: basic

  # Envio para backend de observabilidade
  otlphttp/backend:
    endpoint: https://your-backend.com/v1/logs
    headers:
      authorization: Bearer ${API_KEY}
    compression: gzip
    timeout: 30s

service:
  pipelines:
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/backend, debug]
```

### Docker Compose para Collector

```yaml
version: '3.8'
services:
  collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/collector.yaml"]
    volumes:
      - ./collector.yaml:/etc/collector.yaml
    ports:
      - "4317:4317"   # gRPC
      - "4318:4318"   # HTTP
    environment:
      - API_KEY=your-api-key-here
```

### Vantagens do Collector

- ✅ **Processamento Local**: Reduz latência de rede
- ✅ **Batching**: Agrupa logs para melhor performance
- ✅ **Transformação**: Processa dados antes do envio
- ✅ **Retry**: Reenvia logs em caso de falha
- ✅ **Múltiplos Destinos**: Envia para vários sistemas
- ✅ **Sampling**: Controla volume de dados

## 🎛️ Controle de Nível Mínimo de Log

A SDK permite controlar quais logs são processados através da configuração `minLogLevel`. Por padrão, o nível mínimo é `INFO`.

### Níveis de Log Disponíveis

- `DEBUG`: Todos os logs (mais verboso)
- `INFO`: Logs informativos, avisos e erros (padrão)
- `WARN`: Apenas avisos e erros
- `ERROR`: Apenas erros (menos verboso)

### Exemplo de Uso

```typescript
import { Logger, LogLevel } from '@psouza.yuri/sdk-logger';

// Configuração com nível mínimo DEBUG (mostra todos os logs)
const debugLogger = new Logger({
  exporterType: 'collector',
  collector: {
    endpoint: 'http://localhost:4317'
  },
  serviceName: 'meu-servico',
  minLogLevel: LogLevel.DEBUG, // Mostra DEBUG, INFO, WARN, ERROR
  enableConsole: true
});

// Configuração com nível mínimo WARN (apenas avisos e erros)
const warnLogger = new Logger({
  exporterType: 'collector',
  collector: {
    endpoint: 'http://localhost:4317'
  },
  serviceName: 'meu-servico',
  minLogLevel: LogLevel.WARN, // Mostra apenas WARN e ERROR
  enableConsole: true
});

// Configuração sem minLogLevel (usa INFO como padrão)
const defaultLogger = new Logger({
  exporterType: 'collector',
  collector: {
    endpoint: 'http://localhost:4317'
  },
  serviceName: 'meu-servico',
  // minLogLevel não especificado - usa INFO como padrão
  enableConsole: true
});

// Testando os logs
debugLogger.debug('Este log aparece com DEBUG'); // ✅ Aparece
debugLogger.info('Este log aparece com DEBUG');  // ✅ Aparece

warnLogger.debug('Este log NÃO aparece com WARN'); // ❌ Não aparece
warnLogger.warn('Este log aparece com WARN');      // ✅ Aparece

defaultLogger.debug('Este log NÃO aparece (padrão INFO)'); // ❌ Não aparece
defaultLogger.info('Este log aparece (padrão INFO)');      // ✅ Aparece
```

### Configuração no NestJS

```typescript
// src/main.ts
import { setupLogging } from '@psouza.yuri/sdk-logger';
import { LogLevel } from '@psouza.yuri/sdk-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  setupLogging(app, {
    exporterType: 'collector',
    collector: {
      endpoint: 'http://localhost:4317'
    },
    serviceName: 'meu-servico',
    minLogLevel: LogLevel.WARN, // Apenas avisos e erros
    enableConsole: true
  });
  
  await app.listen(3000);
}
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
    exporterType: 'collector',
    collector: {
      endpoint: process.env.COLLECTOR_ENDPOINT || 'http://localhost:4318',
      protocol: 'http'
    },
    serviceName: 'pedido-service',
    serviceVersion: '1.0.0',
    environment: 'production'
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

## 🔧 Troubleshooting de Duration

### ❓ "Por que o duration do log é diferente do Postman?"

**Resposta**: São medições diferentes!

- **Logger (8.54ms)**: Tempo de processamento da API
- **Postman (42ms)**: Tempo total incluindo rede
- **Trace (69ms)**: Tempo de todas as operações internas

### ❓ "O duration do log está correto?"

**Resposta**: Sim! O logger mede o **span principal** da API, que é exatamente o que você quer para logs de aplicação.

### ❓ "Como validar se está funcionando?"

```bash
# 1. Fazer uma requisição
curl -X POST http://localhost:3000/api/v1/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Teste","description":"Teste"}'

# 2. Verificar logs no console (se habilitado)
# 3. Verificar traces no SigNoz
# 4. Comparar durations:
#    - Log: ~8ms (processamento da API)
#    - Trace: ~69ms (todas as operações)
#    - Postman: ~42ms (rede + processamento)
```

### ❓ "Duration muito alto no log?"

**Possíveis causas**:
- Lógica de negócio complexa
- Validações pesadas
- Processamento de dados
- **NÃO é problema da SDK** - é característica da sua API

### ❓ "Duration muito baixo no log?"

**Possíveis causas**:
- API muito simples
- Cache ativo
- Processamento mínimo
- **NÃO é problema da SDK** - sua API é eficiente!

## 📚 Documentação

- **[🔧 Guia de Implementação](IMPLEMENTATION.md)** - Documentação completa
- **[⏱️ Guia de Duration](DURATION_GUIDE.md)** - Entendendo timing e duration
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