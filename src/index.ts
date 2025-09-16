import { Logger } from './logger/logger';
import { LogLevel, LogContext, LogEntry, SigNozConfig, LoggerConfig, TracedLoggerContext } from './types';
import { setupOpenTelemetry } from './opentelemetry/setup';
import { SigNozExporter } from './exporters/signoz-exporter';
import { SigNozTransport } from './transport/signoz-transport';

export { Logger, LogLevel, LogContext, LogEntry, SigNozConfig, LoggerConfig, TracedLoggerContext };
export { setupOpenTelemetry };
export { SigNozExporter };
export { SigNozTransport };

// Exportar adapters para NestJS
export * from './adapters/nestjs';

// Factory function para facilitar a criação do logger
export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}

// Função de conveniência para configuração rápida
export function createSigNozLogger(signozConfig: SigNozConfig, options?: Partial<LoggerConfig>): Logger {
  const config: LoggerConfig = {
    signoz: signozConfig,
    logLevel: LogLevel.INFO,
    enableConsole: true,
    enableFile: false,
    ...options,
  };
  
  return new Logger(config);
}
