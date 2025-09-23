import winston, { format } from 'winston';
import Transport from 'winston-transport';
import { LogLevel, LoggerConfig, shouldLogLevel } from '../types';
import { CollectorExporter } from '../exporters/collector-exporter';

class CollectorWinstonTransport extends Transport {
  private exporter: CollectorExporter;

  constructor(exporter: CollectorExporter) {
    super();
    this.exporter = exporter;
  }

  log(info: any, callback: () => void) {
    this.exporter.exportLog(info)
      .then(() => {
        callback();
      })
      .catch((error) => {
        callback();
      });
  }
}

export class Logger {
  protected winston: winston.Logger;
  protected config: LoggerConfig;
  private collectorExporter?: CollectorExporter;

  constructor(config: LoggerConfig) {
    this.config = config;
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

    // Configurar exportador collector
    if (this.config.collectorEndpoint) {
      const collectorConfig = {
        endpoint: this.config.collectorEndpoint,
        protocol: this.config.collectorProtocol || 'http',
        timeout: this.config.collectorTimeout || 5000,
        headers: this.config.collectorHeaders || {}
      };
      
      this.collectorExporter = new CollectorExporter(collectorConfig);
      transports.push(new CollectorWinstonTransport(this.collectorExporter));
    } else {
      throw new Error('collectorEndpoint é obrigatório.');
    }

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
    // Verificar se o nível de log deve ser processado baseado no nível mínimo configurado
    const minLevel = this.config.minLogLevel || LogLevel.INFO;
    if (!shouldLogLevel(level, minLevel)) {
      return; // Não processar logs abaixo do nível mínimo
    }

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
    // Verificar se o nível de log deve ser processado baseado no nível mínimo configurado
    const minLevel = this.config.minLogLevel || LogLevel.INFO;
    if (!shouldLogLevel(level, minLevel)) {
      return; // Não processar logs abaixo do nível mínimo
    }

    const context = {
      ...traceContext,
      ...additionalContext,
    };
    this.log(level, message, context);
  }
}