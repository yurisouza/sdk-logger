import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { SigNozConfig } from '../../types';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator, W3CBaggagePropagator, CompositePropagator } from '@opentelemetry/core';
import { ExpressLayerType } from '@opentelemetry/instrumentation-express';

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

    // Auto-instrumentations com configuração otimizada
    const instrumentations = getNodeAutoInstrumentations({
      // HTTP (SERVER) — principal criador do span de request
      '@opentelemetry/instrumentation-http': {
        // Ignore health/static e o próprio SigNoz exporter (evita loops)
        ignoreIncomingRequestHook: (req) => {
          const url = (req as any)?.originalUrl || (req as any)?.url || '';
          const clean = String(url).split('?')[0];
          return clean === '/favicon.ico' || clean === '/health' || clean === '/ready' || clean.startsWith('/static/') || clean.startsWith('/assets/');
        },
        ignoreOutgoingRequestHook: (opts) => {
          const host = (opts as any)?.hostname || (opts as any)?.host || '';
          return /signoz|ingest\.(us|eu|in)\.signoz\.cloud/i.test(host);
        },
        requestHook: (span, req) => {
          const route = (req as any).route?.path || (req as any).originalUrl?.split('?')[0] || (req as any).url;
          const method = String((req as any).method || 'GET').toUpperCase();
          if (route) {
            span.updateName(`${method} ${route}`);
            span.setAttribute('http.route', route);
          }
        },
        responseHook: (span, res) => {
          const code = (res as any).statusCode;
          if (typeof code === 'number') {
            span.setAttribute('http.status_code', code);
          }
        },
      },

      // EXPRESS — habilite, mas ignore camadas ruidosas
      '@opentelemetry/instrumentation-express': {
        enabled: true,
        ignoreLayersType: [ExpressLayerType.MIDDLEWARE, ExpressLayerType.ROUTER], // só mantém request_handler
        spanNameHook: (info, defaultName) => {
          const i: any = info as any;

          // `route` pode ser string, objeto { method, path } ou undefined
          const route = i?.route;
          let method: string | undefined;
          let path: string | undefined;

          if (typeof route === 'string') {
            path = route;
          } else if (route && typeof route === 'object') {
            path = route.path;
            const m = route.method;
            if (typeof m === 'string') method = m.toUpperCase();
          }

          // Fallbacks comuns expostos como attributes pela lib
          if (!path) {
            path = i?.attributes?.['express.route'] || i?.attributes?.['http.route'] || i?.attributes?.['express.name'];
          }

          if (method && path) return `${method} ${path}`;
          if (path) return path;
          return defaultName;
        },
      },

      // NestJS — pode ficar desabilitado se os spans HTTP + service/db já bastam
      '@opentelemetry/instrumentation-nestjs-core': { enabled: true },

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
      '@opentelemetry/instrumentation-router': { enabled: true }, // desabilite para evitar spans/traços duplicados
      '@opentelemetry/instrumentation-tedious': { enabled: false },
      '@opentelemetry/instrumentation-winston': { enabled: false },
    });

    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
      }),
      traceExporter,
      sampler,
      instrumentations,
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