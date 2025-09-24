import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Logger } from '../../logger/logger';
import { LoggerConfig, LogLevel } from '../../types';
import { trace } from '@opentelemetry/api';
import { getSpanDuration, spanDurations } from './span-duration-tracker';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger: Logger;
  private maxBodySize: number;
  private maxHeadersSize: number;

  constructor(config: LoggerConfig) {
    // Configuração do logger
    const loggerConfig = {
      ...config,
      logLevel: config.minLogLevel || LogLevel.INFO,
      // Usar enableConsole da config original
    };

    this.logger = new Logger(loggerConfig);
    
    // Limites de tamanho para evitar quebra da API
    this.maxBodySize = 1024 * 1024; // 1MB para body
    this.maxHeadersSize = 64 * 1024; // 64KB para headers
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    try {
      // Debug: verificar se o interceptor está sendo executado
      console.log('🔍 LoggingInterceptor: Interceptando request');
      
      // Validação básica do context
      if (!context || !context.switchToHttp) {
        console.log('❌ LoggingInterceptor: Context inválido');
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
        // Logging assíncrono - aguardar um pouco para o SpanDurationTracker processar
        setTimeout(() => {
          try {
            // Obter duração EXATA do span do OpenTelemetry
            let duration: number | undefined;
            
            try {
              const activeSpan = trace.getActiveSpan();
              if (activeSpan) {
                const spanContext = activeSpan.spanContext();
                // Buscar duração do span ativo no Map (capturada pelo SpanDurationTracker)
                duration = getSpanDuration(spanContext.spanId);
              }
            } catch (spanError) {
              // Ignorar erro de span
            }

            // Se não encontrou duração do span ativo, buscar no Map por spanId
            if (duration === undefined && spanId) {
              duration = getSpanDuration(spanId);
            }

            // Se ainda não encontrou, buscar o span com maior duração (provavelmente o principal)
            if (duration === undefined) {
              let maxDuration = 0;
              for (const [currentSpanId, spanDuration] of spanDurations.entries()) {
                if (currentSpanId && spanDuration !== undefined && spanDuration > maxDuration) {
                  maxDuration = spanDuration;
                }
              }
              if (maxDuration > 0) {
                duration = maxDuration;
              }
            }

            // Fallback: medir tempo do interceptor se não encontrar duração do span
            if (duration === undefined) {
              const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
              duration = endTime - startTime;
            }
            
            const statusCode = response?.statusCode || 200;
            
            // Log estruturado no padrão de produção
            this.logger.info(`${method} ${url} (${duration.toFixed(2)}ms)`, {
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
        // Logging assíncrono - aguardar um pouco para o SpanDurationTracker processar
        setTimeout(() => {
          try {
            // Obter duração EXATA do span do OpenTelemetry
            let duration: number | undefined;
            
            try {
              const activeSpan = trace.getActiveSpan();
              if (activeSpan) {
                const spanContext = activeSpan.spanContext();
                // Buscar duração do span ativo no Map (capturada pelo SpanDurationTracker)
                duration = getSpanDuration(spanContext.spanId);
              }
            } catch (spanError) {
              // Ignorar erro de span
            }

            // Se não encontrou duração do span ativo, buscar no Map por spanId
            if (duration === undefined && spanId) {
              duration = getSpanDuration(spanId);
            }

            // Se ainda não encontrou, buscar o span com maior duração (provavelmente o principal)
            if (duration === undefined) {
              let maxDuration = 0;
              for (const [currentSpanId, spanDuration] of spanDurations.entries()) {
                if (currentSpanId && spanDuration !== undefined && spanDuration > maxDuration) {
                  maxDuration = spanDuration;
                }
              }
              if (maxDuration > 0) {
                duration = maxDuration;
              }
            }

            // Fallback: medir tempo do interceptor se não encontrar duração do span
            if (duration === undefined) {
              const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
              duration = endTime - startTime;
            }
            
            const statusCode = error?.status || 500;
          
            // Log estruturado no padrão de produção
            this.logger.error(`${method} ${url} (${duration.toFixed(2)}ms)`, {
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
      // Verificar se é um objeto muito grande ou circular
      if (typeof data === 'object') {
        // Limitar profundidade de recursão para evitar stack overflow
        const jsonString = JSON.stringify(data, null, 0);
        return jsonString.length;
      }
      
      return JSON.stringify(data).length;
    } catch (error) {
      // Se houver erro de serialização, estimar tamanho baseado no tipo
      if (typeof data === 'string') {
        return data.length;
      }
      if (typeof data === 'object' && data !== null) {
        return Object.keys(data).length * 100; // Estimativa conservadora
      }
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