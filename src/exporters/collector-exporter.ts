import { LogEntry, LogLevel } from '../types';
import axios from 'axios';

export interface CollectorConfig {
  endpoint: string;
  protocol?: 'http' | 'grpc';
  timeout?: number;
  headers?: Record<string, string>;
}

export class CollectorExporter {
  private config: CollectorConfig;
  private maxLogSize: number;

  constructor(config: CollectorConfig) {
    this.config = {
      protocol: 'http',
      timeout: 5000,
      ...config
    };
    this.maxLogSize = 1024 * 1024; // 1MB para logs
  }

  private parseDurationMs(raw: any): number | undefined {
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw === 'number' && isFinite(raw)) return raw; // already ms
    if (typeof raw !== 'string') return Number(raw);

    const s = raw.trim().toLowerCase();
    if (s.endsWith('ms')) return Number(s.slice(0, -2));
    if (s.endsWith('s'))  return Number(s.slice(0, -1)) * 1000;
    if (s.endsWith('us')) return Math.floor(Number(s.slice(0, -2)) / 1000); // micro → ms
    if (!isNaN(Number(s))) return Number(s); // assume ms
    return undefined;
  }

  private calculateDataSize(data: any): number {
    if (!data) return 0;
    
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  private truncateLargeData(data: any, maxSize: number): any {
    if (!data) return data;
    
    const size = this.calculateDataSize(data);
    if (size <= maxSize) return data;
    
    return {
      '[TRUNCATED]': `Dados muito grandes (${size} bytes). Tamanho máximo: ${maxSize} bytes`,
      '[ORIGINAL_SIZE]': size,
      '[TRUNCATED_AT]': new Date().toISOString()
    };
  }

  async exportLog(logEntry: LogEntry): Promise<void> {
    try {
      // Validação básica do logEntry
      if (!logEntry || typeof logEntry !== 'object') {
        return;
      }

      // Verificar tamanho do log antes de processar
      const logSize = this.calculateDataSize(logEntry);
      if (logSize > this.maxLogSize) {
        console.warn(`[CollectorExporter] Log muito grande (${logSize} bytes). Tamanho máximo: ${this.maxLogSize} bytes`);
        
        // Truncar dados grandes
        const truncatedLog = this.truncateLargeData(logEntry, this.maxLogSize);
        logEntry = truncatedLog as LogEntry;
      }

      // Validação do timestamp
      if (!logEntry.timestamp || !(logEntry.timestamp instanceof Date)) {
        logEntry.timestamp = new Date();
      }

      // Validação do level
      if (!logEntry.level || typeof logEntry.level !== 'string') {
        logEntry.level = LogLevel.INFO;
      }

      const timestampNs = String(logEntry.timestamp.getTime() * 1_000_000); // epoch ns (UTC-based)
      const durationMs: number | undefined =
        this.parseDurationMs((logEntry as any).durationMs ?? (logEntry as any)?.performance?.duration);

      const context = (logEntry as any).context || {};
      const traceId: string | undefined = 
        context.traceId || 
        context.trace_id || 
        (logEntry as any).traceId || 
        (logEntry as any).trace_id || 
        undefined;
      const spanId: string | undefined = 
        context.spanId || 
        context.span_id || 
        (logEntry as any).spanId || 
        (logEntry as any).span_id || 
        undefined;
      const traceFlags: number | undefined = 
        context.traceFlags ?? 
        context.trace_flags ?? 
        (logEntry as any).traceFlags ?? 
        (logEntry as any).trace_flags ?? 
        undefined;

      const payload = {
        resourceLogs: [{
          resource: {
            attributes: [
              { key: "service.name",            value: { stringValue: (logEntry as any).service || "unknown" } },
              { key: "service.version",         value: { stringValue: (logEntry as any).version || "1.0.0" } },
              { key: "deployment.environment",  value: { stringValue: (logEntry as any).environment || "production" } },
            ]
          },
          scopeLogs: [{
            scope: { name: "logger", version: "1.0.0" },
            logRecords: [{
              timeUnixNano: timestampNs,
              severityText: logEntry.level.toUpperCase(),
              severityNumber: this.getSeverityNumber(logEntry.level),
              body: this.toAnyValue(this.buildBodyObject(logEntry, durationMs)),
              attributes: this.buildAttributes(logEntry, durationMs),
              ...(traceId ? { traceId } : {}),
              ...(spanId  ? { spanId }  : {}),
              ...(typeof traceFlags === 'number' ? { traceFlags } : {}),
            }]
          }]
        }]
      };

      // Enviar para Collector
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.config.headers
      };

      const endpoint = this.config.protocol === 'grpc' 
        ? `${this.config.endpoint}/v1/logs` 
        : `${this.config.endpoint}/v1/logs`;

      await axios.post(endpoint, payload, {
        headers,
        timeout: this.config.timeout,
      });

    } catch (error) {
      // Erro silencioso - não quebra a aplicação
    }
  }

  private buildAttributes(logEntry: LogEntry, durationMs?: number): any[] {
    const attrs: any[] = [];

    // Deriva duration em ms de várias fontes
    let effectiveDurationMs: number | undefined = durationMs;

    if (effectiveDurationMs === undefined) {
      const perfDur = (logEntry as any)?.performance?.duration;
      const parsed = this.parseDurationMs(perfDur);
      if (typeof parsed === 'number' && isFinite(parsed)) {
        effectiveDurationMs = parsed;
      }
    }

    if (effectiveDurationMs === undefined) {
      const topDur = (logEntry as any)?.durationMs ?? (logEntry as any)?.duration;
      const parsed = this.parseDurationMs(topDur);
      if (typeof parsed === 'number' && isFinite(parsed)) {
        effectiveDurationMs = parsed;
      }
    }

    if (effectiveDurationMs === undefined && typeof (logEntry as any)?.message === 'string') {
      const msg = (logEntry as any).message.toLowerCase();
      const m = msg.match(/\((\d+(?:\.\d+)?)\s*(ms|s|us)\)/i);
      if (m) {
        const val = Number(m[1]);
        const unit = m[2];
        if (!isNaN(val)) {
          if (unit === 'ms') effectiveDurationMs = val;
          else if (unit === 's') effectiveDurationMs = val * 1000;
          else if (unit === 'us') effectiveDurationMs = Math.floor(val / 1000);
        }
      }
    }

    // Correlações
    const hasTopTrace = Boolean((logEntry as any).traceId || (logEntry as any).trace_id);
    const hasTopSpan  = Boolean((logEntry as any).spanId  || (logEntry as any).span_id);

    if (!hasTopTrace && (logEntry as any).traceId) {
      attrs.push({ key: 'trace.id', value: { stringValue: (logEntry as any).traceId } });
    }
    if (!hasTopSpan && (logEntry as any).spanId) {
      attrs.push({ key: 'span.id', value: { stringValue: (logEntry as any).spanId } });
    }

    // Request ID
    const requestId = (logEntry as any).requestId ?? (logEntry as any).request_id;
    if (requestId) attrs.push({ key: 'request.id', value: { stringValue: String(requestId) } });

    if ((logEntry as any).correlationId) attrs.push({ key: 'correlation.id', value: { stringValue: (logEntry as any).correlationId } });
    if ((logEntry as any).userId)        attrs.push({ key: 'user.id', value: { stringValue: (logEntry as any).userId } });

    // HTTP básicos
    const method = (logEntry as any)?.context?.request?.method;
    const urlPath = (logEntry as any)?.context?.request?.url;
    const statusCode = (logEntry as any)?.context?.response?.statusCode;
    const respSize = (logEntry as any)?.context?.response?.responseSize;

    if (method) attrs.push({ key: 'http.method', value: { stringValue: String(method) } });
    if (urlPath) attrs.push({ key: 'url.path', value: { stringValue: String(urlPath) } });
    if (Number.isFinite(Number(statusCode))) attrs.push({ key: 'http.status_code', value: { intValue: Number(statusCode) } });
    if (Number.isFinite(Number(respSize)))   attrs.push({ key: 'response.size', value: { intValue: Number(respSize) } });
    if (typeof effectiveDurationMs === 'number' && isFinite(effectiveDurationMs)) {
      attrs.push({ key: 'duration_ms', value: { intValue: Math.round(effectiveDurationMs) } });
    }

    // User Agent e IP
    const userAgent = (logEntry as any)?.context?.request?.userAgent;
    const ip = (logEntry as any)?.context?.request?.ip;

    if (userAgent) attrs.push({ key: 'user.agent', value: { stringValue: String(userAgent) } });
    if (ip) attrs.push({ key: 'client.ip', value: { stringValue: String(ip) } });

    // Message
    if ((logEntry as any).message) {
      attrs.push({ key: 'message', value: { stringValue: String((logEntry as any).message) } });
    }

    // Context primitivos
    const excludedFields = ['traceId', 'spanId', 'trace_id', 'span_id'];
    if ((logEntry as any).context && typeof (logEntry as any).context === 'object') {
      for (const [k, v] of Object.entries((logEntry as any).context)) {
        if (!excludedFields.includes(k) && this.isPrimitiveOrArrayOfPrimitives(v)) {
          let key = k === 'request_id' ? 'request.id' : k;
          if (k === 'date') key = 'date_utc';
          attrs.push({ key, value: this.toAnyValue(v) });
        }
      }
    }

    // Sanitize
    return attrs.filter(a => {
      const val = a.value;
      return (
        val?.stringValue !== '' ||
        typeof val?.boolValue === 'boolean' ||
        typeof val?.intValue === 'number' ||
        typeof val?.doubleValue === 'number' ||
        (val?.arrayValue?.values?.length ?? 0) > 0
      );
    });
  }

  private buildBodyObject(logEntry: LogEntry, durationMs?: number): Record<string, any> {
    const utcIso = (logEntry as any).timestamp instanceof Date
      ? (logEntry as any).timestamp.toISOString()
      : new Date(String((logEntry as any).timestamp ?? Date.now())).toISOString();

    const obj: Record<string, any> = {
      ip: (logEntry as any).context?.request?.ip,
      userAgent: (logEntry as any).context?.request?.userAgent,
      date_utc: utcIso,
    };

    if ((logEntry as any).performance) obj.performance = (logEntry as any).performance;
    if (Number.isFinite(Number(durationMs))) obj.duration_ms = Number(durationMs);

    if ((logEntry as any).request) obj.request = (logEntry as any).request;
    if ((logEntry as any).response) obj.response = (logEntry as any).response;

    // Context complexo
    if ((logEntry as any).context && typeof (logEntry as any).context === 'object') {
      const complex: Record<string, any> = {};
      for (const [k, v] of Object.entries((logEntry as any).context)) {
        if (!this.isPrimitiveOrArrayOfPrimitives(v)) {
          complex[k] = v;
        }
      }
      if (Object.keys(complex).length) obj.context = complex;
    }

    if ((logEntry as any).error) obj.error = (logEntry as any).error;

    if ('duration' in obj) delete (obj as any).duration;

    return obj;
  }

  private toAnyValue(v: any): any {
    if (v === null || v === undefined) return { stringValue: "" }

    switch (typeof v) {
      case "string":  return { stringValue: v }
      case "number":  return Number.isInteger(v) ? { intValue: v } : { doubleValue: v }
      case "boolean": return { boolValue: v }
      case "object":
        if (Array.isArray(v)) {
          return {
            arrayValue: { values: v.map((item: any) => this.toAnyValue(item)) }
          }
        }
        return {
          kvlistValue: {
            values: Object.entries(v).map(([k, val]) => ({ key: k, value: this.toAnyValue(val) }))
          }
        }
      default:
        return { stringValue: String(v) }
    }
  }

  private isPrimitiveOrArrayOfPrimitives(v: any): boolean {
    const isPrim = (x: any) => ['string', 'number', 'boolean'].includes(typeof x) || x === null || x === undefined;
    if (isPrim(v)) return true;
    if (Array.isArray(v)) return v.every(isPrim);
    return false;
  }

  private getSeverityNumber(level: string): number {
    const severityMap: { [key: string]: number } = {
      'trace': 1,
      'debug': 5,
      'info': 9,
      'warn': 13,
      'error': 17,
      'fatal': 21,
    };
    return severityMap[level.toLowerCase()] || 9;
  }

  async shutdown(): Promise<void> {
    // No-op
  }
}
