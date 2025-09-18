import { Logger } from './logger/logger';
import { LogLevel, SigNozConfig, LoggerConfig, NestLoggingConfig } from './types';

export { Logger, LogLevel, SigNozConfig, LoggerConfig, NestLoggingConfig };

// NestJS adapter
export { setupTelemetry, setupLogging } from './adapters/nestjs';

// Factory simples
export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}
