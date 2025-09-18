import winston, { format } from 'winston';
import Transport from 'winston-transport';
import { LogLevel, LoggerConfig } from '../types';
import { SigNozExporter } from '../exporters/signoz-exporter';

class SigNozWinstonTransport extends Transport {
  private exporter: SigNozExporter;

  constructor(exporter: SigNozExporter) {
    super();
    this.exporter = exporter;
  }

  log(info: any, callback: () => void) {
    console.log('🔍 SigNozWinstonTransport log chamado:', info.message);
    
    this.exporter.exportLog(info)
      .then(() => {
        console.log('✅ Log enviado para SigNoz com sucesso');
        callback();
      })
      .catch((error) => {
        console.warn('❌ Erro ao enviar log para SigNoz:', error);
        callback();
      });
  }
}

export class Logger {
  protected winston: winston.Logger;
  protected config: LoggerConfig;
  private signozExporter: SigNozExporter;

  constructor(config: LoggerConfig) {
    this.config = config;
    this.signozExporter = new SigNozExporter(config);
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
            winston.format.json()
          ),
        })
      );
    }

    // SigNoz transport personalizado
    transports.push(new SigNozWinstonTransport(this.signozExporter));

    return winston.createLogger({
      level: this.config.logLevel || LogLevel.INFO,
      transports,
    });
  }

  private parseFileSize(sizeStr: string): number {
    const units: { [key: string]: number } = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024,
    };

    const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
    if (!match) return 128 * 1024 * 1024; // 128MB padrão

    const value = parseFloat(match[1]);
    const unit = match[2] || 'mb';
    return Math.floor(value * (units[unit] || units['mb']));
  }

  private createLogEntry(level: LogLevel, message: string, context?: any): any {
    const entry: any = {
      level,
      message,
      timestamp: new Date(),
      service: this.config.serviceName,
      version: this.config.serviceVersion,
      environment: this.config.environment,
    };

    if (context) {
      entry.context = context;
    }

    return entry;
  }

  private log(level: LogLevel, message: string, context?: any): void {
    const logEntry = this.createLogEntry(level, message, context);
    this.winston.log(level, logEntry);
  }

  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, message, context);
  }

  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  // Método para logging com contexto de trace
  logWithTrace(level: LogLevel, message: string, traceContext?: any, additionalContext?: any): void {
    const context = {
      ...traceContext,
      ...additionalContext,
    };
    this.log(level, message, context);
  }
}