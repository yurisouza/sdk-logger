import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Logger } from '../../logger/logger';
import { LoggerConfig } from '../../types';
import { initializeTelemetry } from './telemetry';
import { trace, context, SpanStatusCode, trace as traceAPI } from '@opentelemetry/api';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger: Logger;

  constructor(config?: Partial<LoggerConfig>) {
    // Configuração padrão com fallback para variáveis de ambiente
    const defaultConfig: LoggerConfig = {
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
      enableFile: process.env.LOG_ENABLE_FILE === 'true',
      signoz: {
        endpoint: process.env.SIGNOZ_ENDPOINT || 'https://ingest.us.signoz.cloud:443',
        apiKey: process.env.SIGNOZ_API_KEY || '',
        serviceName: process.env.SIGNOZ_SERVICE_NAME || 'app',
        serviceVersion: process.env.SIGNOZ_SERVICE_VERSION || '1.0.0',
        environment: process.env.SIGNOZ_ENVIRONMENT || 'production',
        enableLogs: process.env.SIGNOZ_ENABLE_LOGS !== 'false'
      }
    };

    // Merge com configuração fornecida
    const finalConfig = this.mergeConfig(defaultConfig, config);
    
    // Inicializar OpenTelemetry se tracing estiver habilitado
    if (finalConfig.signoz?.enableTracing) {
      console.log('🔧 Inicializando OpenTelemetry para tracing...');
      
      // Configurar variáveis de ambiente para o OpenTelemetry
      process.env.SIGNOZ_ENDPOINT = finalConfig.signoz.endpoint;
      process.env.SIGNOZ_API_KEY = finalConfig.signoz.apiKey;
      process.env.SIGNOZ_SERVICE_NAME = finalConfig.signoz.serviceName;
      process.env.SIGNOZ_SERVICE_VERSION = finalConfig.signoz.serviceVersion;
      process.env.SIGNOZ_ENVIRONMENT = finalConfig.signoz.environment;
      
      // Inicializar OpenTelemetry
      initializeTelemetry();
    } else {
      console.log('⚠️ Tracing desabilitado - apenas logs serão enviados');
    }
    
    this.logger = new Logger(finalConfig);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Wrapper de segurança para garantir que a aplicação nunca quebre
    try {
      return this.safeIntercept(context, next);
    } catch (error) {
      // Log do erro interno da SDK sem quebrar a aplicação
      console.error('[SDK-Logger] Erro interno no interceptor:', error);
      // Retorna o observable original para não impactar a aplicação
      return next.handle();
    }
  }

  private safeIntercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const { method, url, headers, body } = this.safeExtractRequestData(request);
    const userAgent = this.safeGetUserAgent(headers);
    const ip = this.safeGetIp(request);
    
    // Gerar IDs únicos para rastreamento
    const requestId = this.generateRequestId();
    const userId = this.extractUserId(request);
    
    // Usar contexto ativo do OpenTelemetry para correlacionar logs e traces
    const activeSpan = trace.getActiveSpan();
    let traceId = '';
    let spanId = '';
    
    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      traceId = spanContext.traceId;
      spanId = spanContext.spanId;
    } else {
      // Fallback: criar span manualmente se não houver contexto ativo
      const tracer = trace.getTracer('api-todolist', '1.0.0');
      const span = tracer.startSpan(`${method} ${url}`, {
        attributes: {
          'http.method': method,
          'http.url': url,
          'http.user_agent': userAgent,
          'http.client_ip': ip,
          'service.name': 'api-todolist',
          'service.version': '1.0.0',
          'request.id': requestId,
          'user.id': userId || '',
        }
      });
      
      const spanContext = span.spanContext();
      traceId = spanContext.traceId;
      spanId = spanContext.spanId;
    }
    
    // Logger com contexto de rastreamento
    const tracedLogger = this.logger
      .withTraceId(traceId)
      .withSpanId(spanId)
      .withRequestId(requestId);
    
    if (userId) {
      tracedLogger.withUserId(userId);
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap((data: any) => {
        const duration = Date.now() - startTime;
        
        // O span será finalizado automaticamente pelo OpenTelemetry
        
        // Log estruturado com nomenclatura clara
        const logMessage = `${method} ${url} → ${this.safeGetStatusCode(response)} (${duration}ms)`;
        
        this.safeLog(tracedLogger, 'info', logMessage, {
          // Informações principais da requisição
          method,
          url,
          statusCode: this.safeGetStatusCode(response),
          duration: `${duration}ms`,
          userAgent,
          ip,
          
          // IDs de rastreamento
          traceId,
          requestId,
          userId: userId || null,
          
          // Dados completos da requisição
          request: {
            method,
            url,
            headers: this.sanitizeHeaders(headers),
            body: this.sanitizeBody(body),
            query: this.safeGetQuery(request),
            params: this.safeGetParams(request)
          },
          
          // Dados completos da resposta
          response: {
            statusCode: this.safeGetStatusCode(response),
            headers: this.sanitizeHeaders(this.safeGetResponseHeaders(response)),
            body: this.sanitizeBody(data),
            size: this.safeCalculateSize(data)
          },
          
          // Metadados de performance
          performance: {
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
            memoryUsage: process.memoryUsage()
          }
        });
      }),
      catchError((error: any) => {
        const duration = Date.now() - startTime;
        
        // O span será finalizado automaticamente pelo OpenTelemetry
        
        // Log estruturado para erros com nomenclatura clara
        const errorMessage = `${method} ${url} → ${error.status || 500} (${duration}ms) - ${error.message}`;
        
        this.safeLog(tracedLogger, 'error', errorMessage, {
          // Informações principais da requisição
          method,
          url,
          statusCode: error.status || 500,
          duration: `${duration}ms`,
          userAgent,
          ip,
          
          // IDs de rastreamento
          traceId,
          requestId,
          userId: userId || null,
          
          // Dados completos da requisição
          request: {
            method,
            url,
            headers: this.sanitizeHeaders(headers),
            body: this.sanitizeBody(body),
            query: this.safeGetQuery(request),
            params: this.safeGetParams(request)
          },
          
          // Dados do erro
          error: {
            message: error.message,
            stack: error.stack,
            statusCode: error.status || 500,
            name: error.name
          },
          
          // Metadados de performance
          performance: {
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
            memoryUsage: process.memoryUsage()
          }
        });
        
        throw error;
      })
    );
  }

  private generateTraceId(): string {
    // Gerar traceId no formato OpenTelemetry (32 caracteres hex)
    const randomBytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
    return randomBytes.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSpanId(): string {
    // Gerar spanId no formato OpenTelemetry (16 caracteres hex)
    const randomBytes = Array.from({ length: 8 }, () => Math.floor(Math.random() * 256));
    return randomBytes.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private extractUserId(request: any): string | undefined {
    try {
      return request?.user?.id || request?.headers?.['x-user-id'] || undefined;
    } catch (error) {
      console.error('[SDK-Logger] Erro ao extrair userId:', error);
      return undefined;
    }
  }

  private safeCalculateSize(data: any): number {
    try {
      if (data === null || data === undefined) return 0;
      if (typeof data === 'string') return data.length;
      if (typeof data === 'number') return data.toString().length;
      if (typeof data === 'boolean') return data.toString().length;
      
      // Para objetos e arrays, tenta JSON.stringify
      const jsonString = JSON.stringify(data);
      return jsonString ? jsonString.length : 0;
    } catch (error) {
      console.error('[SDK-Logger] Erro ao calcular tamanho dos dados:', error);
      return 0;
    }
  }

  private safeExtractRequestData(request: any): { method: string; url: string; headers: any; body: any } {
    try {
      return {
        method: request?.method || 'UNKNOWN',
        url: request?.url || '/',
        headers: request?.headers || {},
        body: request?.body || null
      };
    } catch (error) {
      console.error('[SDK-Logger] Erro ao extrair dados do request:', error);
      return {
        method: 'UNKNOWN',
        url: '/',
        headers: {},
        body: null
      };
    }
  }

  private safeGetUserAgent(headers: any): string {
    try {
      return headers?.['user-agent'] || headers?.['User-Agent'] || '';
    } catch (error) {
      console.error('[SDK-Logger] Erro ao extrair user-agent:', error);
      return '';
    }
  }

  private safeGetIp(request: any): string {
    try {
      return request?.ip || 
             request?.connection?.remoteAddress || 
             request?.socket?.remoteAddress || 
             'unknown';
    } catch (error) {
      console.error('[SDK-Logger] Erro ao extrair IP:', error);
      return 'unknown';
    }
  }

  private safeGetStatusCode(response: any): number {
    try {
      return response?.statusCode || response?.status || 200;
    } catch (error) {
      console.error('[SDK-Logger] Erro ao extrair status code:', error);
      return 200;
    }
  }

  private safeGetResponseHeaders(response: any): any {
    try {
      if (typeof response?.getHeaders === 'function') {
        return response.getHeaders();
      }
      return response?.headers || {};
    } catch (error) {
      console.error('[SDK-Logger] Erro ao extrair headers da resposta:', error);
      return {};
    }
  }

  private safeGetQuery(request: any): any {
    try {
      return request?.query || {};
    } catch (error) {
      console.error('[SDK-Logger] Erro ao extrair query:', error);
      return {};
    }
  }

  private safeGetParams(request: any): any {
    try {
      return request?.params || {};
    } catch (error) {
      console.error('[SDK-Logger] Erro ao extrair params:', error);
      return {};
    }
  }

  private safeLog(logger: any, level: string, message: string, data?: any): void {
    try {
      if (logger && typeof logger[level] === 'function') {
        logger[level](message, data);
      } else {
        console.log(`[SDK-Logger] ${level.toUpperCase()}: ${message}`, data);
      }
    } catch (error) {
      console.error('[SDK-Logger] Erro ao fazer log:', error);
      console.log(`[SDK-Logger] FALLBACK: ${message}`, data);
    }
  }

  private sanitizeBody(body: any): any {
    try {
      if (!body || typeof body !== 'object') return body;
      
      const sanitized = { ...body };
      const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
      
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });
      
      return sanitized;
    } catch (error) {
      console.error('[SDK-Logger] Erro ao sanitizar body:', error);
      return body;
    }
  }

  private sanitizeHeaders(headers: any): any {
    try {
      if (!headers || typeof headers !== 'object') return {};
      const sanitized = { ...headers };
      const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
      
      sensitiveHeaders.forEach(header => {
        if (sanitized[header]) {
          sanitized[header] = '[REDACTED]';
        }
      });
      
      return sanitized;
    } catch (error) {
      console.error('[SDK-Logger] Erro ao sanitizar headers:', error);
      return {};
    }
  }

  private mergeConfig(defaultConfig: LoggerConfig, userConfig?: Partial<LoggerConfig>): LoggerConfig {
    if (!userConfig) return defaultConfig;

    return {
      ...defaultConfig,
      ...userConfig,
      signoz: {
        ...defaultConfig.signoz,
        ...userConfig.signoz
      }
    };
  }
}
