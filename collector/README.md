# OpenTelemetry Collector para SigNoz Cloud

Este diretório contém a configuração otimizada do OpenTelemetry Collector para envio de dados para o SigNoz Cloud.

## Configuração

### 1. Variáveis de Ambiente

O collector está configurado para usar variáveis de ambiente. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais do SigNoz:

```bash
# Configuração do SigNoz Cloud
SIGNOZ_ENDPOINT=https://ingest.us.signoz.cloud:443
SIGNOZ_INGESTION_KEY=your-signoz-ingestion-key-here
```

### 2. Regiões Suportadas

- **US**: `https://ingest.us.signoz.cloud:443`
- **EU**: `https://ingest.eu.signoz.cloud:443`
- **IN**: `https://ingest.in.signoz.cloud:443`

### 3. Executar o Collector

```bash
# Iniciar o collector
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar o collector
docker-compose down
```

## Configuração Otimizada

### Performance
- **Memory Limiter**: 512MB limit com proteção contra picos
- **Batch Processors**: Otimizados por tipo de dados (logs, traces, metrics)
- **Retry Policy**: Configuração inteligente para garantir entrega
- **Queue**: 4 consumidores paralelos para máxima throughput

### Segurança
- **Data Sanitization**: Remove dados sensíveis automaticamente
- **Environment Variables**: Credenciais não hardcoded
- **Health Check**: Monitoramento automático do container

### Monitoramento
- **Debug Exporter**: Para desenvolvimento e troubleshooting
- **pprof/zpages**: Extensões para profiling e debugging
- **Structured Logs**: Logs estruturados para análise

## Endpoints

- **OTLP HTTP**: `http://localhost:4318`
- **OTLP gRPC**: `http://localhost:4317`
- **Health Check**: `http://localhost:4318/v1/traces`

## Troubleshooting

### Verificar se o collector está funcionando:
```bash
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[{"resource":{"attributes":[{"key":"service.name","value":{"stringValue":"test"}}]},"scopeSpans":[{"spans":[{"traceId":"12345678901234567890123456789012","spanId":"1234567890123456","name":"test","startTimeUnixNano":"1640995200000000000","endTimeUnixNano":"1640995201000000000"}]}]}]}'
```

### Verificar logs do collector:
```bash
docker logs opentelemetry-collector
```

### Verificar status do container:
```bash
docker ps | grep opentelemetry
```
