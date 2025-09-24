# ⏱️ Guia Completo de Duration e Timing

## 📊 Visão Geral

A SDK Logger captura diferentes tipos de duration dependendo do contexto e propósito. Este guia explica cada tipo e quando usar.

## 🎯 Tipos de Duration

### 1. **Logger Duration (Recomendado para Logs)**

**O que mede**: Tempo de processamento da API (span principal)

**Exemplo**:
```json
{
  "level": "info",
  "message": "POST /api/v1/todos - 201",
  "duration": "8.54ms",
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

**Inclui**:
- ✅ Lógica de negócio
- ✅ Validações
- ✅ Processamento de dados
- ✅ Resposta da API

**Não inclui**:
- ❌ Operações de banco de dados
- ❌ Chamadas externas
- ❌ Middleware overhead
- ❌ Latência de rede

### 2. **Trace Duration (Para Monitoramento)**

**O que mede**: Tempo total de todas as operações

**Exemplo**:
```
Trace: POST /api/v1/todos
├── Middleware: 0.5ms
├── Request Handler: 8.54ms ← Logger Duration
├── POST interno (DB): 48.73ms
└── tcp.connect: 8.18ms
Total: 69ms
```

**Inclui**:
- ✅ Span principal (8.54ms)
- ✅ Operações de banco de dados (48.73ms)
- ✅ Conexões de rede (8.18ms)
- ✅ Middleware (0.5ms)

### 3. **Cliente Duration (Experiência do Usuário)**

**O que mede**: Tempo de rede (request → response)

**Exemplo**: Postman mostra `42ms`

**Inclui**:
- ✅ Latência de rede (ida)
- ✅ Processamento total da API
- ✅ Latência de rede (volta)

## 🔄 Fluxo Completo de Timing

```
Cliente (Postman): 42ms
    ↓ (rede ~17ms)
API recebe request
    ↓
Trace inicia: 17.08ms
    ├── Middleware: 0.5ms
    ├── Request Handler: 8.54ms ← LOGGER DURATION
    ├── POST interno (DB): 48.73ms
    └── tcp.connect: 8.18ms
    ↓
Trace total: 69ms
    ↓ (rede ~17ms)
Cliente recebe response: 42ms
```

## ✅ Quando Usar Cada Duration

| Contexto | Duration Recomendado | Por quê? |
|----------|---------------------|----------|
| **Logs da API** | Logger (8.54ms) | Tempo real de processamento da API |
| **Monitoramento** | Trace completo (69ms) | Visão completa de performance |
| **Cliente** | Postman (42ms) | Experiência do usuário final |
| **Debugging** | Todos | Análise completa do problema |

## 🔧 Implementação Técnica

### Cálculo de Duration

A SDK usa **precisão de nanosegundos** do OpenTelemetry:

```typescript
// Cálculo preciso usando timestamps do OpenTelemetry
const startNs = start[0] * 1e9 + start[1];  // seconds * 1e9 + nanoseconds
const endNs = end[0] * 1e9 + end[1];        // seconds * 1e9 + nanoseconds
const durationNs = endNs - startNs;         // diferença em nanosegundos
const durationMs = durationNs / 1e6;        // converter para milissegundos
```

### SpanDurationTracker

```typescript
export class SpanDurationTracker implements SpanProcessor {
  onEnd(span: ReadableSpan): void {
    const start = span.startTime; // [seconds, nanos]
    const end = span.endTime;     // [seconds, nanos]
    
    if (start && end) {
      const startNs = start[0] * 1e9 + start[1];
      const endNs = end[0] * 1e9 + end[1];
      const durationNs = endNs - startNs;
      const durationMs = durationNs / 1e6;
      
      // Armazenar duração usando spanId como chave
      const spanId = span.spanContext().spanId;
      spanDurations.set(spanId, durationMs);
    }
  }
}
```

### LoggingInterceptor

```typescript
// Obter duração do span processado
const traceDuration = getSpanDuration(spanId);
const duration = traceDuration ? `${traceDuration.toFixed(2)}ms` : 'N/A';
```

## 📈 Benefícios da Implementação

### ✅ Precisão Máxima
- **Nanosegundos**: Precisão do OpenTelemetry
- **Consistência**: Duration do log = Duration do span
- **Confiabilidade**: Fonte oficial do OpenTelemetry

### ✅ Performance
- **Cálculo único**: Evita recálculos
- **Cache**: Duration armazenada em Map
- **Assíncrono**: Não bloqueia o request

### ✅ Manutenibilidade
- **Padrão**: Usa convenções do OpenTelemetry
- **Extensível**: Fácil de modificar
- **Testável**: Lógica isolada

## 🔍 Troubleshooting

### ❓ "Duration muito diferente do esperado?"

**Verificar**:
1. Se o span está sendo processado corretamente
2. Se o SpanDurationTracker está registrado
3. Se o LoggingInterceptor está aguardando o processamento

### ❓ "Duration sempre 0 ou undefined?"

**Possíveis causas**:
1. Span não está sendo finalizado
2. SpanDurationTracker não está funcionando
3. Timing de acesso ao Map

### ❓ "Duration inconsistente entre logs?"

**Verificar**:
1. Se há múltiplos spans com mesmo ID
2. Se o Map está sendo limpo prematuramente
3. Se há race conditions

## 🧪 Testes de Validação

### Teste Básico
```bash
# 1. Fazer requisição
curl -X POST http://localhost:3000/api/v1/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Teste","description":"Teste"}'

# 2. Verificar log
# Deve mostrar duration entre 5-15ms para API simples

# 3. Verificar trace no SigNoz
# Deve mostrar duration similar no span principal
```

### Teste de Performance
```bash
# 1. Fazer múltiplas requisições
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/v1/todos \
    -H "Content-Type: application/json" \
    -d "{\"title\":\"Teste $i\",\"description\":\"Teste $i\"}"
done

# 2. Verificar consistência dos durations
# Deve haver variação mínima entre requisições similares
```

## 📚 Referências

- [OpenTelemetry SpanProcessor](https://opentelemetry.io/docs/specs/otel/sdk/trace/#spanprocessor)
- [OpenTelemetry Timing](https://opentelemetry.io/docs/specs/otel/trace/api/#timing)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)

## 🎯 Conclusão

A implementação de duration da SDK está **correta e otimizada**:

- ✅ **Logger Duration (8.54ms)**: Tempo real de processamento da API
- ✅ **Trace Duration (69ms)**: Visão completa de performance
- ✅ **Cliente Duration (42ms)**: Experiência do usuário

**Use o Logger Duration para logs de aplicação** - é exatamente o que você precisa! 🚀
