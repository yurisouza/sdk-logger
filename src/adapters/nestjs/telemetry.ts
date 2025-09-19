import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ParentBasedSampler, TraceIdRatioBasedSampler, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SpanDurationTracker } from './span-duration-tracker';
import { ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { SigNozConfig } from '../../types';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator, W3CBaggagePropagator, CompositePropagator } from '@opentelemetry/core';

let sdk: NodeSDK | null = null;

// Habilitar logs de diagnóstico
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

/**
 * Configura o OpenTelemetry com auto-instrumentations otimizadas
 * Garante 1 trace com múltiplos spans (HTTP + NestJS + Database)
 */
export function setupTelemetry(
  config: SigNozConfig
): void {
  if (sdk) {
    return;
  }

  try {
    // Validação básica da config
    if (!config || typeof config !== 'object') {
      return;
    }

    // Validação dos campos obrigatórios
    if (!config.serviceName || typeof config.serviceName !== 'string') {
      return;
    }

    if (!config.endpoint || typeof config.endpoint !== 'string') {
      return;
    }

    // Configurar exportador OTLP
    const traceExporter = new OTLPTraceExporter({
      url: `${config.endpoint}/v1/traces`,
      headers: {
        'signoz-ingestion-key': config.apiKey || '',
        'Content-Type': 'application/json',
      },
    });

    // Sampler: 100% em dev, 10% em prod
    const isDev = config.environment === 'development';
    const sampler = new ParentBasedSampler({ 
      root: new TraceIdRatioBasedSampler(isDev ? 1.0 : 0.1) 
    });

    // Auto-instrumentations sem filtros para validação
    const instrumentations = getNodeAutoInstrumentations({
      // HTTP (SERVER) — com configuração para tempo correto
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        // Ignorar chamadas internas para SigNoz (evita spans desnecessários)
        ignoreOutgoingRequestHook: (opts) => {
          const host = (opts as any)?.hostname || (opts as any)?.host || '';
          return /signoz|ingest\.(us|eu|in)\.signoz\.cloud/i.test(host);
        },
        requestHook: (span, request) => {
          // Garantir que o span tenha o nome correto
          const method = (request as any)?.method || 'GET';
          const url = (request as any)?.url || (request as any)?.path || '/';
          span.updateName(`${method} ${url}`);
        },
        responseHook: (span, response) => {
          // Adicionar status code
          const statusCode = (response as any)?.statusCode;
          if (statusCode) {
            span.setAttribute('http.status_code', statusCode);
          }
        }
      },

      // EXPRESS — habilitado para capturar spans de middleware
      '@opentelemetry/instrumentation-express': {
        enabled: true,
        // Configuração para capturar spans de middleware sem conflitos
        ignoreLayersType: [] // Capturar todos os tipos de middleware
      },

      // NestJS — habilitado
      '@opentelemetry/instrumentation-nestjs-core': { 
        enabled: true
      },

      // Databases
      '@opentelemetry/instrumentation-mongodb': { enabled: true },
      '@opentelemetry/instrumentation-mysql2': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enabled: true },

      // Outras
      '@opentelemetry/instrumentation-redis': { enabled: true },
      '@opentelemetry/instrumentation-graphql': { enabled: false },
      '@opentelemetry/instrumentation-aws-lambda': { enabled: false },
      '@opentelemetry/instrumentation-aws-sdk': { enabled: false },
      '@opentelemetry/instrumentation-bunyan': { enabled: false },
      '@opentelemetry/instrumentation-cassandra-driver': { enabled: false },
      '@opentelemetry/instrumentation-connect': { enabled: false },
      '@opentelemetry/instrumentation-cucumber': { enabled: false },
      '@opentelemetry/instrumentation-dataloader': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-fastify': { enabled: false },
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-generic-pool': { enabled: false },
      '@opentelemetry/instrumentation-hapi': { enabled: false },
      '@opentelemetry/instrumentation-ioredis': { enabled: false },
      '@opentelemetry/instrumentation-knex': { enabled: false },
      '@opentelemetry/instrumentation-koa': { enabled: false },
      '@opentelemetry/instrumentation-memcached': { enabled: true },
      '@opentelemetry/instrumentation-net': { enabled: false },
      '@opentelemetry/instrumentation-pino': { enabled: false },
      '@opentelemetry/instrumentation-restify': { enabled: false },
      '@opentelemetry/instrumentation-router': { enabled: false }, // Desabilitado para evitar duplicação
      '@opentelemetry/instrumentation-tedious': { enabled: false },
      '@opentelemetry/instrumentation-winston': { enabled: false },
    });

    // Criar span processors
    const spanDurationTracker = new SpanDurationTracker();
    const batchProcessor = new BatchSpanProcessor(traceExporter);

    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
      }),
      traceExporter,
      sampler,
      instrumentations,
      spanProcessors: [spanDurationTracker, batchProcessor],
      contextManager: new AsyncLocalStorageContextManager(),
      textMapPropagator: new CompositePropagator({
        propagators: [
          new W3CTraceContextPropagator(),
          new W3CBaggagePropagator(),
        ],
      }),
    });

    sdk.start();
  } catch (error) {
    // Não quebra a aplicação, apenas ignora a telemetria
  }
}

/**
 * Finaliza o OpenTelemetry
 */
export async function shutdownTelemetry(): Promise<void> {
  try {
    if (sdk) {
      await sdk.shutdown();
      sdk = null;
    }
  } catch (error) {
    // Erro silencioso
  }
}