import winston from 'winston';
import { LogLevel, LogEntry, LoggerConfig, LogContext, TracedLoggerContext } from '../types';
import { SigNozTransport } from '../transport/signoz-transport';

export class Logger {
  protected winston: winston.Logger;
  protected config: LoggerConfig;
  protected additionalContext?: TracedLoggerContext;

  constructor(config: LoggerConfig, additionalContext?: TracedLoggerContext) {
    this.config = config;
    this.additionalContext = additionalContext;
    this.winston = this.createWinstonLogger();
  }

  private createWinstonLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (this.config.enableConsole !== false) {
      transports.push(
        new winston.transports.Console({
          level: this.config.logLevel || LogLevel.INFO,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              // Filtrar campos específicos do Winston
              const { context, service, version, environment, traceId, requestId, userId, spanId, correlationId } = meta;
              
              // Construir mensagem principal
              let logMessage = `${timestamp} [${level}]: ${message}`;
              
              // Adicionar contexto se existir
              if (context) {
                logMessage += `\n${JSON.stringify(context, null, 2)}`;
              }
              
              // Adicionar metadados de rastreamento se existirem
              const trackingInfo = [];
              if (traceId) trackingInfo.push(`traceId: ${traceId}`);
              if (requestId) trackingInfo.push(`requestId: ${requestId}`);
              if (userId) trackingInfo.push(`userId: ${userId}`);
              if (spanId) trackingInfo.push(`spanId: ${spanId}`);
              if (correlationId) trackingInfo.push(`correlationId: ${correlationId}`);
              
              if (trackingInfo.length > 0) {
                logMessage += `\n[${trackingInfo.join(', ')}]`;
              }
              
              return logMessage;
            })
          ),
        })
      );
    }

    // File transport
    if (this.config.enableFile) {
      transports.push(
        new winston.transports.File({
          filename: this.config.filePath || 'logs/application.log',
          level: this.config.logLevel || LogLevel.INFO,
          maxsize: this.parseFileSize(this.config.maxFileSize || '128m'), // 128MB por padrão
          maxFiles: 1, // Apenas 1 arquivo (sobrescrever)
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          ),
        })
      );
    }

    // SigNoz transport
    if (this.config.signoz.enableLogs !== false) {
      transports.push(new SigNozTransport({
        signoz: this.config.signoz,
      }));
    }

    return winston.createLogger({
      level: this.config.logLevel || LogLevel.INFO,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports,
    });
  }

  private parseFileSize(size: string): number {
    const units: { [key: string]: number } = {
      b: 1,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
    };
    
    const match = size.match(/^(\d+)([bkmg])$/i);
    if (!match) return 128 * 1024 * 1024; // Default 128MB
    
    const [, value, unit] = match;
    return parseInt(value) * units[unit.toLowerCase()];
  }

  protected createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): LogEntry {
    const baseContext = {
      ...this.additionalContext?.context,
      ...context,
    };

    return {
      level,
      message,
      timestamp: new Date(),
      context: Object.keys(baseContext).length > 0 ? baseContext : undefined,
      service: this.config.signoz.serviceName,
      version: this.config.signoz.serviceVersion,
      environment: this.config.signoz.environment,
      traceId: this.additionalContext?.traceId,
      spanId: this.additionalContext?.spanId,
      userId: this.additionalContext?.userId,
      requestId: this.additionalContext?.requestId,
      correlationId: this.additionalContext?.correlationId,
    };
  }

  error(message: string, context?: LogContext): void {
    const logEntry = this.createLogEntry(LogLevel.ERROR, message, context);
    this.winston.error(logEntry);
  }

  warn(message: string, context?: LogContext): void {
    const logEntry = this.createLogEntry(LogLevel.WARN, message, context);
    this.winston.warn(logEntry);
  }

  info(message: string, context?: LogContext): void {
    const logEntry = this.createLogEntry(LogLevel.INFO, message, context);
    this.winston.info(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    const logEntry = this.createLogEntry(LogLevel.DEBUG, message, context);
    this.winston.debug(logEntry);
  }

  trace(message: string, context?: LogContext): void {
    const logEntry = this.createLogEntry(LogLevel.TRACE, message, context);
    this.winston.silly(logEntry);
  }

  // Métodos para adicionar contexto de rastreamento
  withTraceId(traceId: string): Logger {
    return new Logger(this.config, {
      ...this.additionalContext,
      traceId,
    });
  }

  withSpanId(spanId: string): Logger {
    return new Logger(this.config, {
      ...this.additionalContext,
      spanId,
    });
  }

  withUserId(userId: string): Logger {
    return new Logger(this.config, {
      ...this.additionalContext,
      userId,
    });
  }

  withRequestId(requestId: string): Logger {
    return new Logger(this.config, {
      ...this.additionalContext,
      requestId,
    });
  }

  withCorrelationId(correlationId: string): Logger {
    return new Logger(this.config, {
      ...this.additionalContext,
      correlationId,
    });
  }

  withContext(context: LogContext): Logger {
    return new Logger(this.config, {
      ...this.additionalContext,
      context: {
        ...this.additionalContext?.context,
        ...context,
      },
    });
  }

  // Método para criar child logger com contexto persistente
  child(defaultContext: LogContext): Logger {
    return new Logger(this.config, {
      ...this.additionalContext,
      context: {
        ...this.additionalContext?.context,
        ...defaultContext,
      },
    });
  }

  // Método para enviar logs para SigNoz manualmente
  async sendToSigNoz(logEntry: LogEntry): Promise<void> {
    if (this.config.signoz.enableLogs !== false) {
      const signozTransport = new SigNozTransport({
        signoz: this.config.signoz,
      });
      
      return new Promise((resolve, reject) => {
        signozTransport.log(logEntry, () => {
          resolve();
        });
      });
    }
  }

  async shutdown(): Promise<void> {
    await this.winston.close();
  }
}
