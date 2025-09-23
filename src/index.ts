import { Logger } from './logger/logger';
import { LogLevel, LogEntry, LoggerConfig, NestLoggingConfig, shouldLogLevel } from './types';

export { Logger, LogLevel, LogEntry, LoggerConfig, NestLoggingConfig, shouldLogLevel };

// NestJS adapter
export { setupTelemetry, setupLogging } from './adapters/nestjs';

// Factory simples
export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}
