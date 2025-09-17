import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ExportResult } from '@opentelemetry/core';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

let sdk: NodeSDK | null = null;

class DebugOTLPTraceExporter extends OTLPTraceExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    super.export(spans, (result) => {
      if (result.code === 0) {
        console.log(`✅ Spans enviados com sucesso para SigNoz`);
      } else {
        console.error(`❌ Erro ao enviar spans:`, result);
      }
      resultCallback(result);
    });
  }
}

/**
 * Configuração de amostragem baseada no ambiente
 */
function getSampler() {
  const environment = process.env.SIGNOZ_ENVIRONMENT || 'production';
  
  if (environment === 'development' || environment === 'staging') {
    // 100% de amostragem em dev/staging
    return new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(1.0)
    });
  } else {
    // 10% de amostragem em produção (configurável via env)
    const sampleRate = parseFloat(process.env.SIGNOZ_SAMPLE_RATE || '0.1');
    return new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(sampleRate)
    });
  }
}

/**
 * Configuração de instrumentações com filtros para reduzir ruído
 */
function getInstrumentations() {
  return [
    // HTTP instrumentation com configurações específicas
    new HttpInstrumentation({
      // Ignorar middlewares irrelevantes e requisições internas do SDK
      ignoreIncomingRequestHook: (req) => {
        const url = req.url || '';
        // Filtrar middlewares do Express e requisições internas
        return url.includes('/favicon.ico') || 
               url.includes('/health') ||
               url.includes('/metrics');
      },
      // Ignorar requisições de saída (outgoing) do SDK para SigNoz
      ignoreOutgoingRequestHook: (req) => {
        const hostname = req.hostname || '';
        const path = (req as any).path || '';
        // Ignorar requisições para SigNoz (logs e traces)
        return hostname.includes('signoz') || 
               hostname.includes('ingest.us.signoz.cloud') ||
               path.includes('/v1/logs') ||
               path.includes('/v1/traces');
      },
      // Configurar nomes de spans HTTP
      requestHook: (span, request) => {
        const method = request.method || 'UNKNOWN';
        const url = (request as any).url || '';
        
        // Extrair rota template (ex: /api/v1/todos/:id)
        const routeTemplate = extractRouteTemplate(url);
        (span as any).setName(`${method} ${routeTemplate}`);
        
        // Adicionar atributos mínimos
        span.setAttributes({
          'http.method': method,
          'http.route': routeTemplate,
          'url.path': url,
        });
      },
      responseHook: (span, response) => {
        if (response) {
          span.setAttributes({
            'http.status_code': response.statusCode,
          });
        }
      },
    })
  ];
}

/**
 * Extrai template de rota (ex: /api/v1/todos/:id)
 */
function extractRouteTemplate(url: string): string {
  // Remover query parameters
  const cleanUrl = url.split('?')[0];
  
  // Padrões genéricos para detectar IDs e parâmetros
  const genericPatterns = [
    // UUIDs: /api/v1/users/550e8400-e29b-41d4-a716-446655440000
    { pattern: /^(.+)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, replacement: '$1/:id' },
    
    // IDs numéricos: /api/v1/users/123
    { pattern: /^(.+)\/\d+$/, replacement: '$1/:id' },
    
    // IDs alfanuméricos: /api/v1/users/abc123
    { pattern: /^(.+)\/[a-zA-Z0-9_-]+$/, replacement: '$1/:id' },
    
    // Múltiplos parâmetros: /api/v1/users/123/posts/456
    { pattern: /^(.+)\/\d+\/(.+)\/\d+$/, replacement: '$1/:id/$2/:id2' },
    
    // Múltiplos parâmetros genéricos: /api/v1/users/123/posts/456/comments/789
    { pattern: /^(.+)\/\d+\/(.+)\/\d+\/(.+)\/\d+$/, replacement: '$1/:id/$2/:id2/$3/:id3' },
  ];
  
  // Aplicar padrões genéricos
  for (const { pattern, replacement } of genericPatterns) {
    if (pattern.test(cleanUrl)) {
      return cleanUrl.replace(pattern, replacement);
    }
  }
  
  // Se não encontrou padrão, retornar a URL original
  return cleanUrl;
}

/**
 * Inicializa o OpenTelemetry com boas práticas
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
    // Configurar exporter com header correto
    const traceExporter = new DebugOTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
      headers: {
        'signoz-ingestion-key': apiKey, // Header correto para SigNoz Cloud
        'Content-Type': 'application/json',
        'User-Agent': 'sdk-logger/1.0.0',
      },
    });

    // Configurar sampler baseado no ambiente
    const sampler = getSampler();
    
    // Configurar instrumentações com filtros
    const instrumentations = getInstrumentations();

    sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
      }),
      traceExporter,
      sampler,
      instrumentations,
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
