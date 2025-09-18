import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Logger } from '../../logger/logger';
import { SigNozConfig, LogLevel } from '../../types';
import { trace } from '@opentelemetry/api';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger: Logger;

  constructor(config: SigNozConfig) {
    // Configuração do logger
    const loggerConfig = {
      ...config,
      logLevel: LogLevel.INFO,
      enableConsole: true,
    };

    this.logger = new Logger(loggerConfig);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    const { method, url, headers, body } = request;
    const userAgent = headers['user-agent'] || '';
    const ip = headers['x-user-ip'] || request.ip || request.connection.remoteAddress;
    
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
      // Se não houver contexto ativo, gerar IDs em formato hexadecimal válido
      traceId = this.generateHexId(32); // 32 caracteres hexadecimais para traceId
      spanId = this.generateHexId(16);  // 16 caracteres hexadecimais para spanId
    }
    
    const startTime = Date.now();
    
    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;
        
        // Log estruturado no padrão de produção
        this.logger.info(`${method} ${url} (${duration}ms)`, {
          request: {
            method,
            url,
            userAgent,
            ip,
            requestId,
            userId,
            body: this.sanitizeBody(body),
            headers: this.sanitizeHeaders(headers),
          },
          response: {
            statusCode,
            body: this.sanitizeBody(data),
            responseSize: this.calculateResponseSize(data),
            headers: this.safeGetResponseHeaders(response),
          },
          performance: {
            durationMs: duration,
          },
          traceId,
          spanId,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || 500;
        
        // Log estruturado no padrão de produção
        this.logger.error(`${method} ${url} (${duration}ms)`, {
          request: {
            method,
            url,
            userAgent,
            ip,
            requestId,
            userId,
            body: this.sanitizeBody(body),
            headers: this.sanitizeHeaders(headers),
          },
          error: {
            message: error.message,
            stack: error.stack,
            statusCode,
          },
          performance: {
            durationMs: duration,
          },
          traceId,
          spanId,
        });
        
        throw error;
      })
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateHexId(length: number): string {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  private extractUserId(request: any): string | null {
    // Extrair user ID do token JWT ou header personalizado
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Aqui você pode decodificar o JWT para extrair o user ID
      // Por simplicidade, retornamos null
      return null;
    }
    
    // Verificar header personalizado
    return request.headers['x-user-id'] || null;
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;
    
    // Remover campos sensíveis
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const sanitized = { ...body };
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    if (!headers) return {};
    
    // Remover headers sensíveis
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
    const sanitized = { ...headers };
    
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private calculateResponseSize(data: any): number {
    if (!data) return 0;
    
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  private safeGetResponseHeaders(response: any): any {
    try {
      return response.getHeaders ? response.getHeaders() : {};
    } catch {
      return {};
    }
  }
}