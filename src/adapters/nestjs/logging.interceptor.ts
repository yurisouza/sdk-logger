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
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const { method, url, headers, body } = request;
    const userAgent = headers['user-agent'] || '';
    const ip = request.ip || request.connection.remoteAddress;
    
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
        const logMessage = `${method} ${url} → ${response.statusCode} (${duration}ms)`;
        
        tracedLogger.info(logMessage, {
          // Informações principais da requisição
          method,
          url,
          statusCode: response.statusCode,
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
            query: request.query || {},
            params: request.params || {}
          },
          
          // Dados completos da resposta
          response: {
            statusCode: response.statusCode,
            headers: this.sanitizeHeaders(response.getHeaders()),
            body: this.sanitizeBody(data),
            size: JSON.stringify(data).length
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
        
        tracedLogger.error(errorMessage, {
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
            query: request.query || {},
            params: request.params || {}
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
    return request.user?.id || request.headers['x-user-id'] || undefined;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;
    
    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    
    return sanitized;
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
