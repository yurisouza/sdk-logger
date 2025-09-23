import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ParentBasedSampler, TraceIdRatioBasedSampler, BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { SpanDurationTracker } from './span-duration-tracker';
import { ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { LoggerConfig } from '../../types';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator, W3CBaggagePropagator, CompositePropagator } from '@opentelemetry/core';

let sdk: NodeSDK | null = null;

// Desabilitar logs de diagnóstico do OpenTelemetry
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.NONE);

/**
 * Configura o OpenTelemetry com métricas essenciais para API
 * Foca apenas em métricas HTTP importantes
 */
export function setupTelemetry(config: LoggerConfig): void {
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

    // Configurar telemetria para Collector
    if (config.enableTracing === false && config.enableMetrics === false) {
      return; // Nenhuma telemetria habilitada
    }

    const resource = resourceFromAttributes({
      [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment || 'development',
    });

    const sdkConfig: any = {
      resource,
      contextManager: new AsyncLocalStorageContextManager(),
      textMapPropagator: new CompositePropagator({
        propagators: [
          new W3CTraceContextPropagator(),
          new W3CBaggagePropagator(),
        ],
      }),
    };

    // Configurar traces se habilitado
    if (config.enableTracing !== false) {
      const traceExporter = new OTLPTraceExporter({
        url: `${config.collectorEndpoint}/v1/traces`,
        headers: config.collectorHeaders || {},
        timeoutMillis: config.collectorTimeout || 5000,
      });

      // Criar processador de spans com o SpanDurationTracker
      const spanDurationTracker = new SpanDurationTracker();
      const batchSpanProcessor = new BatchSpanProcessor(traceExporter);
      
      // Registrar o SpanDurationTracker como processador adicional
      sdkConfig.traceExporter = traceExporter;
      sdkConfig.spanProcessor = batchSpanProcessor;
      
      // Registrar o SpanDurationTracker no SDK
      sdkConfig.spanProcessors = [spanDurationTracker, batchSpanProcessor];
      sdkConfig.sampler = new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(1.0), // 100% sampling
      });
    }

    // Configurar métricas se habilitado
    if (config.enableMetrics !== false) {
      const metricExporter = new OTLPMetricExporter({
        url: `${config.collectorEndpoint}/v1/metrics`,
        headers: config.collectorHeaders || {},
        timeoutMillis: config.collectorTimeout || 5000,
      });

      sdkConfig.metricReader = new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 10000, // 10 segundos
      });
    }

    // Configurar instrumentações automáticas
    sdkConfig.instrumentations = [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-express': {
          enabled: true,
          ignoreLayers: [ExpressLayerType.MIDDLEWARE],
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
        },
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Desabilitar para evitar spam
        },
      }),
    ];

    sdk = new NodeSDK(sdkConfig);
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
