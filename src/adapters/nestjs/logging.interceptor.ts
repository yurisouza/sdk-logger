import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Logger } from '../../logger/logger';
import { SigNozConfig, LogLevel } from '../../types';
import { trace } from '@opentelemetry/api';
import { getSpanDuration, spanDurations } from './span-duration-tracker';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger: Logger;
  private maxBodySize: number;
  private maxHeadersSize: number;

  constructor(config: SigNozConfig) {
    // Configuração do logger
    const loggerConfig = {
      ...config,
      logLevel: LogLevel.INFO,
      enableConsole: true,
    };

    this.logger = new Logger(loggerConfig);
    
    // Limites de tamanho para evitar quebra da API
    this.maxBodySize = 1024 * 1024; // 1MB para body
    this.maxHeadersSize = 64 * 1024; // 64KB para headers
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    try {
      // Validação básica do context
      if (!context || !context.switchToHttp) {
        return next.handle();
      }

      const request = context.switchToHttp().getRequest();
      const response = context.switchToHttp().getResponse();
      
      // Validação básica do request
      if (!request || typeof request !== 'object') {
        return next.handle();
      }
      
      const { method, url, headers, body } = request;
      
      // Verificar tamanho dos dados antes de processar
      const bodySize = this.calculateDataSize(body);
      const headersSize = this.calculateDataSize(headers);
      
      if (bodySize > this.maxBodySize || headersSize > this.maxHeadersSize) {
        // Log de aviso para dados muito grandes
        console.warn(`[LoggingInterceptor] Dados muito grandes detectados - Body: ${bodySize} bytes, Headers: ${headersSize} bytes`);
        
        // Continuar com a requisição mas com dados truncados
        const userAgent = headers?.['user-agent'] || '';
        const ip = headers?.['x-user-ip'] || request.ip || request.connection?.remoteAddress || 'unknown';
        
        // Gerar IDs únicos para rastreamento
        const requestId = this.generateRequestId();
        const userId = this.extractUserId(request);
        
        // Log simplificado para dados grandes
        this.logger.warn(`${method} ${url} - Dados muito grandes (Body: ${bodySize} bytes, Headers: ${headersSize} bytes)`, {
          request: {
            method,
            url,
            userAgent,
            ip,
            requestId,
            userId,
            body: bodySize > this.maxBodySize ? '[TRUNCATED - TOO LARGE]' : body,
            headers: headersSize > this.maxHeadersSize ? '[TRUNCATED - TOO LARGE]' : headers,
          },
          performance: {
            durationMs: 0, // Não medimos duração para dados grandes
          }
        });
        
        return next.handle();
      }
      
      const userAgent = headers?.['user-agent'] || '';
      const ip = headers?.['x-user-ip'] || request.ip || request.connection?.remoteAddress || 'unknown';
      
      // Gerar IDs únicos para rastreamento
      const requestId = this.generateRequestId();
      const userId = this.extractUserId(request);
      
      // Usar contexto ativo do OpenTelemetry para correlacionar logs e traces
      let traceId = '';
      let spanId = '';
      
      try {
        const activeSpan = trace.getActiveSpan();
        if (activeSpan) {
          const spanContext = activeSpan.spanContext();
          traceId = spanContext.traceId;
          spanId = spanContext.spanId;
        } else {
          // Se não houver contexto ativo, gerar IDs em formato hexadecimal válido
          traceId = this.generateHexId(32); // 32 caracteres hexadecimais para traceId
          spanId = this.generateHexId(16);  // 16 caracteres hexadecimais para spanId
        }
      } catch (traceError) {
        traceId = this.generateHexId(32);
        spanId = this.generateHexId(16);
      }
      
      // Usar performance.now() para sincronizar com OpenTelemetry
      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    
    return next.handle().pipe(
      tap((data) => {
        // Logging assíncrono - não bloqueia a resposta
        setImmediate(() => {
          try {
            // Buscar o span HTTP principal (que tem o nome do método HTTP)
            let duration: number | undefined;
            const httpSpanName = `${method} ${url}`;
            
            // Procurar o span HTTP principal no Map
            for (const [spanId, spanDuration] of spanDurations.entries()) {
              // Verificar se é o span HTTP principal (nome contém método e URL)
              if (spanId && spanDuration !== undefined) {
                // Usar o span com maior duração que provavelmente é o principal
                if (duration === undefined || spanDuration > duration) {
                  duration = spanDuration;
                }
              }
            }

            // Fallback: medir tempo do interceptor se não encontrar duração do span
            if (duration === undefined) {
              const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
              duration = endTime - startTime;
            }
            
            const statusCode = response?.statusCode || 200;
            
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
          } catch (logError) {
            // Erro silencioso - não quebra a aplicação
          }
        });
      }),
      catchError((error) => {
        // Logging assíncrono - não bloqueia a resposta
        setImmediate(() => {
          try {
            // Buscar o span HTTP principal (que tem o nome do método HTTP)
            let duration: number | undefined;
            const httpSpanName = `${method} ${url}`;
            
            // Procurar o span HTTP principal no Map
            for (const [spanId, spanDuration] of spanDurations.entries()) {
              // Verificar se é o span HTTP principal (nome contém método e URL)
              if (spanId && spanDuration !== undefined) {
                // Usar o span com maior duração que provavelmente é o principal
                if (duration === undefined || spanDuration > duration) {
                  duration = spanDuration;
                }
              }
            }

            // Fallback: medir tempo do interceptor se não encontrar duração do span
            if (duration === undefined) {
              const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
              duration = endTime - startTime;
            }
            
            const statusCode = error?.status || 500;
          
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
              message: error?.message || 'Unknown error',
              stack: error?.stack || '',
              statusCode,
            },
            performance: {
              durationMs: duration,
            },
            traceId,
            spanId,
          });
          } catch (logError) {
            // Erro silencioso - não quebra a aplicação
          }
        });
        
        throw error;
      })
    );
    } catch (interceptError) {
      // Retorna o Observable original sem logging
      return next.handle();
    }
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
    
    // Verificar tamanho do body
    const bodySize = this.calculateDataSize(body);
    if (bodySize > this.maxBodySize) {
      return {
        '[TRUNCATED]': `Body muito grande (${bodySize} bytes). Tamanho máximo: ${this.maxBodySize} bytes`,
        '[ORIGINAL_SIZE]': bodySize
      };
    }
    
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
    
    // Verificar tamanho dos headers
    const headersSize = this.calculateDataSize(headers);
    if (headersSize > this.maxHeadersSize) {
      return {
        '[TRUNCATED]': `Headers muito grandes (${headersSize} bytes). Tamanho máximo: ${this.maxHeadersSize} bytes`,
        '[ORIGINAL_SIZE]': headersSize
      };
    }
    
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

  private calculateDataSize(data: any): number {
    if (!data) return 0;
    
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
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