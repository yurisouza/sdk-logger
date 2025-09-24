import { SpanProcessor, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { Context } from '@opentelemetry/api';

// Map global para armazenar durações dos spans
export const spanDurations = new Map<string, number>();

/**
 * SpanProcessor customizado para capturar durações dos spans
 * e disponibilizá-las para o LoggingInterceptor
 */
export class SpanDurationTracker implements SpanProcessor {
  onStart(span: ReadableSpan, parentContext: Context): void {
    // Não precisamos fazer nada no início do span
  }

  onEnd(span: ReadableSpan): void {
    try {
      const start = span.startTime; // [seconds, nanos]
      const end = span.endTime;     // [seconds, nanos]
      
      if (start && end) {
        // Calcular duração usando precisão de nanosegundos do OpenTelemetry
        // startTime e endTime são tuplas [seconds, nanoseconds]
        const startNs = start[0] * 1e9 + start[1];
        const endNs = end[0] * 1e9 + end[1];
        const durationNs = endNs - startNs;
        const durationMs = durationNs / 1e6;
        
        // Armazenar duração usando spanId como chave
        const spanId = span.spanContext().spanId;
        spanDurations.set(spanId, durationMs);
        
        // Limitar tamanho do Map para evitar vazamento de memória
        if (spanDurations.size > 100) {
          const firstKey = spanDurations.keys().next().value;
          if (firstKey) {
            spanDurations.delete(firstKey);
          }
        }
      }
    } catch (error) {
      // Erro silencioso - não queremos quebrar o processamento de spans
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    spanDurations.clear();
    return Promise.resolve();
  }
}

/**
 * Função para obter a duração de um span pelo seu ID
 */
export function getSpanDuration(spanId: string): number | undefined {
  return spanDurations.get(spanId);
}
