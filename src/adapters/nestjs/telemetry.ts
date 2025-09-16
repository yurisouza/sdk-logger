import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;

/**
 * Inicializa o OpenTelemetry automaticamente
 * Deve ser chamado antes de qualquer outra coisa na aplicação
 */
export function initializeTelemetry(): void {
  if (sdk) {
    console.warn('OpenTelemetry já foi inicializado');
    return;
  }

  const endpoint = process.env.SIGNOZ_ENDPOINT || 'https://ingest.us.signoz.cloud:443';
  const apiKey = process.env.SIGNOZ_API_KEY;
  const serviceName = process.env.SIGNOZ_SERVICE_NAME || 'app';
  const serviceVersion = process.env.SIGNOZ_SERVICE_VERSION || '1.0.0';
  const environment = process.env.SIGNOZ_ENVIRONMENT || 'production';

  if (!apiKey) {
    console.warn('SIGNOZ_API_KEY não encontrada. Traces não serão enviados para SigNoz.');
    return;
  }

  try {
    const traceExporter = new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
      headers: {
        'signoz-access-token': apiKey,
      },
    });

    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
      }),
      traceExporter,
      instrumentations: [getNodeAutoInstrumentations()],
    });

    sdk.start();
    console.log(`✅ OpenTelemetry inicializado para ${serviceName} v${serviceVersion}`);
  } catch (error) {
    console.error('❌ Erro ao inicializar OpenTelemetry:', error);
  }
}

/**
 * Finaliza o OpenTelemetry
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    console.log('🛑 OpenTelemetry finalizado');
  }
}

// Auto-inicialização se as variáveis de ambiente estiverem configuradas
if (process.env.SIGNOZ_AUTO_INIT !== 'false' && process.env.SIGNOZ_API_KEY) {
  initializeTelemetry();
}
